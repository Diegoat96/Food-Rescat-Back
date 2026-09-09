import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  FoodPackage,
  PackageStatus,
  PaymentMethod,
  Prisma,
  Reservation,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';

export type PackageWithRelations = FoodPackage & {
  branch: { id: string; name: string; city: string; address: string };
  category: { id: string; name: string };
};

export interface PackageResponse {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number;
  discountedPrice: number;
  estimatedWeightKg: number;
  quantity: number;
  pickupDeadline: Date;
  status: PackageStatus;
  publishedAt: Date;
  branchId: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  branch: PackageWithRelations['branch'];
  category: PackageWithRelations['category'];
  urgent: boolean;
  discountPercentage: number;
}

export interface PackageListResponse {
  data: PackageResponse[];
  total: number;
  skip: number;
  take: number;
}

const URGENT_THRESHOLD_MS = 60 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 3;

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePackageDto, businessId: string): Promise<PackageResponse> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.businessId !== businessId) {
      throw new ForbiddenException('Branch does not belong to this business');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const foodPackage = await this.prisma.foodPackage.create({
      data: {
        name: dto.name,
        description: dto.description,
        originalPrice: dto.originalPrice,
        discountedPrice: dto.discountedPrice,
        estimatedWeightKg: dto.estimatedWeightKg,
        quantity: dto.quantity ?? 1,
        pickupDeadline: new Date(dto.pickupDeadline),
        status: PackageStatus.AVAILABLE,
        branchId: dto.branchId,
        categoryId: dto.categoryId,
      },
      include: {
        branch: { select: { id: true, name: true, city: true, address: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return this.toResponse(foodPackage as unknown as PackageWithRelations);
  }

  async findAll(query: QueryPackagesDto): Promise<PackageListResponse> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const status = query.status ?? PackageStatus.AVAILABLE;

    const where: Prisma.FoodPackageWhereInput = {
      status,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.city
        ? { branch: { city: { contains: query.city, mode: 'insensitive' } } }
        : {}),
    };

    const [foodPackages, total] = await this.prisma.$transaction([
      this.prisma.foodPackage.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, city: true, address: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.foodPackage.count({ where }),
    ]);

    return {
      data: foodPackages.map((p) =>
        this.toResponse(p as unknown as PackageWithRelations),
      ),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string): Promise<PackageResponse> {
    const foodPackage = await this.prisma.foodPackage.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, city: true, address: true } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!foodPackage) {
      throw new NotFoundException('Package not found');
    }
    return this.toResponse(foodPackage as unknown as PackageWithRelations);
  }

  async reserve(
    packageId: string,
    clientId: string,
    paymentMethod: PaymentMethod,
  ): Promise<Reservation> {
    for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Single-statement conditional UPDATE decrements the stock atomically.
            // Only one of the concurrent requests can win the row lock; the others
            // re-evaluate the predicate after it commits and affect 0 rows.
            const result = await tx.foodPackage.updateMany({
              where: {
                id: packageId,
                status: PackageStatus.AVAILABLE,
                quantity: { gt: 0 },
              },
              data: { quantity: { decrement: 1 } },
            });

            if (result.count === 0) {
              throw new ConflictException('Package is no longer available');
            }

            const foodPackage = await tx.foodPackage.findUnique({
              where: { id: packageId },
            });

            if (!foodPackage) {
              throw new NotFoundException('Package not found');
            }

            if (foodPackage.quantity === 0) {
              await tx.foodPackage.update({
                where: { id: packageId },
                data: { status: PackageStatus.RESERVED },
              });
            }

            return tx.reservation.create({
              data: {
                verificationCode: this.generateVerificationCode(),
                status: ReservationStatus.PENDING,
                paymentMethod,
                clientId,
                packageId,
                branchId: foodPackage.branchId,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        );
      } catch (error) {
        const isCodeCollision =
          attempt < MAX_VERIFICATION_ATTEMPTS - 1 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('verificationCode');
        if (!isCodeCollision) {
          throw error;
        }
      }
    }
    throw new InternalServerErrorException(
      'Could not generate a unique verification code',
    );
  }

  private generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 4; i += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `RC-${suffix}`;
  }

  async update(
    id: string,
    dto: UpdatePackageDto,
    businessId: string,
  ): Promise<PackageResponse> {
    const foodPackage = await this.prisma.foodPackage.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!foodPackage) {
      throw new NotFoundException('Package not found');
    }
    if (foodPackage.branch.businessId !== businessId) {
      throw new ForbiddenException('Package does not belong to this business');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (branch.businessId !== businessId) {
        throw new ForbiddenException('Branch does not belong to this business');
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const data: Prisma.FoodPackageUpdateInput = { ...dto };
    if (dto.pickupDeadline) {
      data.pickupDeadline = new Date(dto.pickupDeadline);
    }

    const updated = await this.prisma.foodPackage.update({
      where: { id },
      data,
      include: {
        branch: { select: { id: true, name: true, city: true, address: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return this.toResponse(updated as unknown as PackageWithRelations);
  }

  private toResponse(foodPackage: PackageWithRelations): PackageResponse {
    const original = Number(foodPackage.originalPrice);
    const discounted = Number(foodPackage.discountedPrice);
    const discountPercentage =
      original > 0 ? Math.round(((original - discounted) / original) * 100) : 0;

    const remainedMs = foodPackage.pickupDeadline.getTime() - Date.now();
    const urgent = remainedMs <= URGENT_THRESHOLD_MS;

    return {
      id: foodPackage.id,
      name: foodPackage.name,
      description: foodPackage.description,
      originalPrice: original,
      discountedPrice: discounted,
      estimatedWeightKg: Number(foodPackage.estimatedWeightKg),
      quantity: foodPackage.quantity,
      pickupDeadline: foodPackage.pickupDeadline,
      status: foodPackage.status,
      publishedAt: foodPackage.publishedAt,
      branchId: foodPackage.branchId,
      categoryId: foodPackage.categoryId,
      createdAt: foodPackage.createdAt,
      updatedAt: foodPackage.updatedAt,
      branch: foodPackage.branch,
      category: foodPackage.category,
      urgent,
      discountPercentage,
    };
  }
}
