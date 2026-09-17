import { Injectable } from '@nestjs/common';
import { PackageStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface MerchantKpisResponse {
  activePackages: number;
  pendingToday: number;
  kgRescuedToday: number;
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

    const [activePackages, pendingToday, kgByPackage, revenueByPackage] =
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
        // The DB aggregates COMPLETED reservations per package, so only distinct
        // packages are transferred instead of one row per reservation. Each
        // completed reservation rescues one package unit, hence the count below
        // is multiplied by the package weight/price.
        this.prisma.reservation.groupBy({
          by: ['packageId'],
          where: {
            branch: { businessId: merchantId },
            status: ReservationStatus.COMPLETED,
            updatedAt: { gte: startOfDay },
          },
          _count: { _all: true },
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

    const packageIds = [
      ...new Set([
        ...kgByPackage.map((row) => row.packageId),
        ...revenueByPackage.map((row) => row.packageId),
      ]),
    ];
    const packages = packageIds.length
      ? await this.prisma.foodPackage.findMany({
          where: { id: { in: packageIds } },
          select: {
            id: true,
            estimatedWeightKg: true,
            discountedPrice: true,
          },
        })
      : [];
    const weightByPackage = new Map(
      packages.map((p) => [p.id, Number(p.estimatedWeightKg)]),
    );
    const priceByPackage = new Map(
      packages.map((p) => [p.id, Number(p.discountedPrice)]),
    );

    const kgRescuedToday = kgByPackage.reduce(
      (sum, row) =>
        sum + (weightByPackage.get(row.packageId) ?? 0) * row._count._all,
      0,
    );
    const weeklyRevenue = revenueByPackage.reduce(
      (sum, row) =>
        sum + (priceByPackage.get(row.packageId) ?? 0) * row._count._all,
      0,
    );

    return {
      activePackages,
      pendingToday,
      kgRescuedToday: Math.round(kgRescuedToday * 100) / 100,
      weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
    };
  }
}