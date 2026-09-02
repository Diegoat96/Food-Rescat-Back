import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'net';
import * as bcrypt from 'bcrypt';
import {
  FoodPackage,
  PackageStatus,
  PaymentMethod,
  Prisma,
  Reservation,
  UserRole,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

interface ReserveResult {
  status: number;
}

describe('Concurrency: reserve last stock (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let packageId: string;
  let token: string;
  let clientId: string;
  let businessId: string;
  let branchId: string;
  let categoryId: string;

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaExceptionFilter(),
    );
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();

    const server = app.getHttpServer();
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash('password123', 10);

    const business = await prisma.user.create({
      data: {
        name: `Business ${uniqueSuffix}`,
        email: `business-${uniqueSuffix}@example.com`,
        passwordHash,
        role: UserRole.BUSINESS,
      },
    });
    businessId = business.id;

    const client = await prisma.user.create({
      data: {
        name: `Client ${uniqueSuffix}`,
        email: `client-${uniqueSuffix}@example.com`,
        passwordHash,
        role: UserRole.CLIENT,
      },
    });
    clientId = client.id;

    const branch = await prisma.branch.create({
      data: {
        name: 'Main Branch',
        address: '123 Main Street',
        businessId: business.id,
      },
    });
    branchId = branch.id;

    const category = await prisma.category.create({
      data: { name: `Category ${uniqueSuffix}` },
    });
    categoryId = category.id;

    const foodPackage: FoodPackage = await prisma.foodPackage.create({
      data: {
        name: 'Last unit package',
        description: null,
        originalPrice: new Prisma.Decimal(50),
        discountedPrice: new Prisma.Decimal(25),
        estimatedWeightKg: new Prisma.Decimal(2.5),
        quantity: 1,
        pickupDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: PackageStatus.AVAILABLE,
        branchId: branch.id,
        categoryId: category.id,
      },
    });
    packageId = foodPackage.id;

    const jwtService = app.get(JwtService);
    token = jwtService.sign({
      sub: client.id,
      email: client.email,
      role: client.role,
    });
  });

  afterAll(async () => {
    if (prisma && packageId) {
      await prisma.reservation.deleteMany({ where: { packageId } });
      await prisma.foodPackage.deleteMany({ where: { id: packageId } });
    }
    if (prisma && branchId) {
      await prisma.branch.deleteMany({ where: { id: branchId } });
    }
    if (prisma && categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    if (prisma && clientId && businessId) {
      await prisma.user.deleteMany({
        where: { id: { in: [clientId, businessId] } },
      });
    }
    if (app) {
      await new Promise<void>((resolve) => {
        app.getHttpServer().close(() => resolve());
      });
      await app.close();
    }
  });

  it('5 truly concurrent reserves against quantity=1: 1 success, 4 conflicts, 0 server errors', async () => {
    const fireReserve = async (): Promise<ReserveResult> => {
      const response = await fetch(`${baseUrl}/api/packages/${packageId}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethod: PaymentMethod.CASH }),
      });
      return { status: response.status };
    };

    const results = await Promise.all(Array.from({ length: 5 }, fireReserve));

    const successful = results.filter((r) => r.status === 201).length;
    const conflicts = results.filter((r) => r.status === 409).length;
    const serverErrors = results.filter((r) => r.status === 500).length;

    const reservations: Reservation[] = await prisma.reservation.findMany({
      where: { packageId },
    });
    const packageAfter: FoodPackage | null = await prisma.foodPackage.findUnique({
      where: { id: packageId },
    });

    const verificationCodes = reservations.map((r) => r.verificationCode);
    const uniqueCodes = new Set(verificationCodes);

    console.log('=== CONCURRENCY TEST ===');
    console.log(`Successful (201): ${successful}/5`);
    console.log(`Conflict (409):    ${conflicts}/5`);
    console.log(`Server error (500): ${serverErrors}/5`);
    console.log(`Reservations created: ${reservations.length}`);
    console.log(`Final stock: ${packageAfter?.quantity}`);
    console.log(`Final status: ${packageAfter?.status}`);
    console.log(`Duplicate verification codes: ${uniqueCodes.size !== verificationCodes.length}`);

    expect(successful).toBe(1);
    expect(conflicts).toBe(4);
    expect(serverErrors).toBe(0);
    expect(reservations).toHaveLength(1);
    expect(packageAfter?.quantity).toBe(0);
    expect(packageAfter?.status).toBe(PackageStatus.RESERVED);
    expect(uniqueCodes.size).toBe(reservations.length);
  });
});