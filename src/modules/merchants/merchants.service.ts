import { Injectable } from '@nestjs/common';
import { PackageStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface MerchantKpisResponse {
  activePackages: number;
  pendingToday: number;
  weeklyRevenue: number;
}

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(merchantId: string): Promise<MerchantKpisResponse> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [activePackages, pendingToday, revenueByPackage] =
      await Promise.all([
        this.prisma.foodPackage.count({
          where: {
            branch: { businessId: merchantId },
            status: PackageStatus.AVAILABLE,
          },
        }),
        this.prisma.reservation.count({
          where: {
            branch: { businessId: merchantId },
            status: ReservationStatus.PENDING,
            createdAt: { gte: startOfDay },
          },
        }),
        this.prisma.reservation.groupBy({
          by: ['packageId'],
          where: {
            branch: { businessId: merchantId },
            status: ReservationStatus.COMPLETED,
            updatedAt: { gte: weekAgo },
          },
          _count: { _all: true },
        }),
      ]);

    const packageIds = revenueByPackage.map((row) => row.packageId);
    const packages = packageIds.length
      ? await this.prisma.foodPackage.findMany({
          where: { id: { in: packageIds } },
          select: {
            id: true,
            discountedPrice: true,
          },
        })
      : [];
    const priceByPackage = new Map(
      packages.map((p) => [p.id, Number(p.discountedPrice)]),
    );

    const weeklyRevenue = revenueByPackage.reduce(
      (sum, row) =>
        sum + (priceByPackage.get(row.packageId) ?? 0) * row._count._all,
      0,
    );

    return {
      activePackages,
      pendingToday,
      weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
    };
  }
}