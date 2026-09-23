import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessType,
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
import { ListMyPackagesDto } from './dto/list-my-packages.dto';

export type PackageWithRelations = FoodPackage & {
  branch: {
    id: string;
    name: string;
    city: string;
    address: string;
    businessType: BusinessType;
  };
  category: { id: string; name: string };
};

export interface PackageResponse {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
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
  ratingAverage: number;
  ratingCount: number;
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
        imageUrl: dto.imageUrl,
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
        branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
        category: { select: { id: true, name: true } },
      },
    });

    return this.toResponse(
      foodPackage as unknown as PackageWithRelations,
      { average: 0, count: 0 },
    );
  }

  async findAll(query: QueryPackagesDto): Promise<PackageListResponse> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const status = query.status ?? PackageStatus.AVAILABLE;

    const branchFilter: Prisma.BranchWhereInput = {};
    if (query.city) {
      branchFilter.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.businessType) {
      branchFilter.businessType = query.businessType;
    }

    const where: Prisma.FoodPackageWhereInput = {
      status,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(Object.keys(branchFilter).length > 0 ? { branch: branchFilter } : {}),
    };

    const [foodPackages, total] = await this.prisma.$transaction([
      this.prisma.foodPackage.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
          category: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.foodPackage.count({ where }),
    ]);

    const summaryByPackage =
      foodPackages.length === 0
        ? new Map<string, { average: number; count: number }>()
        : await this.getRatingSummary(foodPackages.map((p) => p.id));

    return {
      data: foodPackages.map((p) =>
        this.toResponse(
          p as unknown as PackageWithRelations,
          summaryByPackage.get(p.id) ?? { average: 0, count: 0 },
        ),
      ),
      total,
      skip,
      take,
    };
  }

  async findAllForBusiness(
    businessId: string,
    filters: ListMyPackagesDto,
  ): Promise<PackageListResponse> {
    const skip = filters.skip ?? 0;
    const take = filters.take ?? 20;

    if (filters.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: filters.branchId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (branch.businessId !== businessId) {
        throw new ForbiddenException('Branch does not belong to this business');
      }
    }

    const where: Prisma.FoodPackageWhereInput = {
      branch: { businessId },
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [foodPackages, total] = await this.prisma.$transaction([
      this.prisma.foodPackage.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.foodPackage.count({ where }),
    ]);

    const summaryByPackage =
      foodPackages.length === 0
        ? new Map<string, { average: number; count: number }>()
        : await this.getRatingSummary(foodPackages.map((p) => p.id));

    return {
      data: foodPackages.map((p) =>
        this.toResponse(
          p as unknown as PackageWithRelations,
          summaryByPackage.get(p.id) ?? { average: 0, count: 0 },
        ),
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
        branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
        category: { select: { id: true, name: true } },
      },
    });
    if (!foodPackage) {
      throw new NotFoundException('Package not found');
    }
    const summary = (await this.getRatingSummary([id])).get(id) ?? {
      average: 0,
      count: 0,
    };
    return this.toResponse(
      foodPackage as unknown as PackageWithRelations,
      summary,
    );
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
                packageName: foodPackage.name,
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

  async cancel(id: string, businessId: string): Promise<PackageResponse> {
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

    const cancellable =
      foodPackage.status === PackageStatus.AVAILABLE ||
      foodPackage.status === PackageStatus.RESERVED;
    if (!cancellable) {
      throw new ConflictException(
        'Only AVAILABLE or RESERVED packages can be cancelled',
      );
    }

    const updated = await this.prisma.foodPackage.update({
      where: { id },
      data: { status: PackageStatus.CANCELLED },
      include: {
        branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
        category: { select: { id: true, name: true } },
      },
    });

    return this.toResponse(updated as unknown as PackageWithRelations);
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
        branch: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              businessType: true,
            },
          },
        category: { select: { id: true, name: true } },
      },
    });

    return this.toResponse(updated as unknown as PackageWithRelations);
  }

  private toResponse(
    foodPackage: PackageWithRelations,
    ratingSummary?: { average: number; count: number },
  ): PackageResponse {
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
      imageUrl: foodPackage.imageUrl,
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
      ratingAverage: ratingSummary?.average ?? 0,
      ratingCount: ratingSummary?.count ?? 0,
    };
  }

  private async getRatingSummary(
    packageIds: string[],
  ): Promise<Map<string, { average: number; count: number }>> {
    const grouped = await this.prisma.rating.groupBy({
      by: ['packageId'],
      where: { packageId: { in: packageIds } },
      _avg: { score: true },
      _count: true,
    });

    return new Map(
      grouped.map((row) => [
        row.packageId,
        {
          average: row._avg.score ? Number(row._avg.score) : 0,
          count: row._count,
        },
      ]),
    );
  }
}