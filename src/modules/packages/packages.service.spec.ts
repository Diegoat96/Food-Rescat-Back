import { Test, TestingModule } from '@nestjs/testing';
import { FoodPackage, PackageStatus, Prisma } from '@prisma/client';
import { PackagesService, PackageWithRelations } from './packages.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPackage(overrides: Partial<PackageWithRelations>): PackageWithRelations {
  return {
    id: 'package-uuid-1111111111111111111111111111',
    name: 'Day leftovers',
    description: null,
    originalPrice: new Prisma.Decimal(50),
    discountedPrice: new Prisma.Decimal(25),
    estimatedWeightKg: new Prisma.Decimal(2.5),
    quantity: 1,
    pickupDeadline: new Date(),
    status: PackageStatus.AVAILABLE,
    publishedAt: new Date(),
    branchId: 'branch-uuid',
    categoryId: 'category-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: {
      id: 'branch-uuid',
      name: 'Branch',
      city: 'Guatemala',
      address: 'Main St 1',
    },
    category: { id: 'category-uuid', name: 'Bakery' },
    ...overrides,
  } as unknown as PackageWithRelations;
}

describe('PackagesService - urgent and discountPercentage', () => {
  let service: PackagesService;

  const mockPrismaService = {
    branch: { findFirst: jest.fn() },
    category: { findUnique: jest.fn() },
    foodPackage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes discountPercentage rounded to integer', async () => {
    const pkg = buildPackage({
      originalPrice: new Prisma.Decimal(50),
      discountedPrice: new Prisma.Decimal(25),
    });
    mockPrismaService.foodPackage.findUnique.mockResolvedValue(pkg);

    const result = await service.findOne(pkg.id);
    expect(result.discountPercentage).toBe(50);
  });

  it('returns discountPercentage 0 when original price is 0', async () => {
    const pkg = buildPackage({
      originalPrice: new Prisma.Decimal(0),
      discountedPrice: new Prisma.Decimal(0),
    });
    mockPrismaService.foodPackage.findUnique.mockResolvedValue(pkg);

    const result = await service.findOne(pkg.id);
    expect(result.discountPercentage).toBe(0);
  });

  it('urgent is true when exactly 60 minutes remain', async () => {
    const pkg = buildPackage({
      pickupDeadline: new Date('2026-08-28T13:00:00.000Z'),
    });
    mockPrismaService.foodPackage.findUnique.mockResolvedValue(pkg);

    const result = await service.findOne(pkg.id);
    expect(result.urgent).toBe(true);
  });

  it('urgent is true when the deadline already passed', async () => {
    const pkg = buildPackage({
      pickupDeadline: new Date('2026-08-28T11:00:00.000Z'),
    });
    mockPrismaService.foodPackage.findUnique.mockResolvedValue(pkg);

    const result = await service.findOne(pkg.id);
    expect(result.urgent).toBe(true);
  });

  it('urgent is false when more than 60 minutes remain', async () => {
    const pkg = buildPackage({
      pickupDeadline: new Date('2026-08-28T13:01:00.000Z'),
    });
    mockPrismaService.foodPackage.findUnique.mockResolvedValue(pkg);

    const result = await service.findOne(pkg.id);
    expect(result.urgent).toBe(false);
  });
});
