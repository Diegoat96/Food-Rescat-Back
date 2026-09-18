import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TodayStatsResponse {
  kgRescuedToday: number;
  ordersCompletedToday: number;
  revenueToday: number;
}

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayStats(businessId: string): Promise<TodayStatsResponse> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // The DB aggregates COMPLETED reservations per package, so only distinct
    // packages are transferred instead of one row per reservation. Each
    // completed reservation rescues one package unit, hence the count is
    // multiplied by the package weight/price.
    const completedByPackage = await this.prisma.reservation.groupBy({
      by: ['packageId'],
      where: {
        status: ReservationStatus.COMPLETED,
        updatedAt: { gte: startOfDay, lt: endOfDay },
        branch: { businessId },
      },
      _count: { _all: true },
    });

    const ordersCompletedToday = completedByPackage.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );

    const packageIds = completedByPackage.map((row) => row.packageId);
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

    const kgRescuedToday = completedByPackage.reduce(
      (sum, row) =>
        sum + (weightByPackage.get(row.packageId) ?? 0) * row._count._all,
      0,
    );
    const revenueToday = completedByPackage.reduce(
      (sum, row) =>
        sum + (priceByPackage.get(row.packageId) ?? 0) * row._count._all,
      0,
    );

    return {
      kgRescuedToday: Number(kgRescuedToday.toFixed(2)),
      ordersCompletedToday,
      revenueToday: Number(revenueToday.toFixed(2)),
    };
  }
}