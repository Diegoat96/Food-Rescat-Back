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

    const [activePackages, pendingToday] = await Promise.all([
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
    ]);

    // kgRescuedToday / weeklyRevenue: estimatedWeightKg and discountedPrice live
    // on FoodPackage (relation of Reservation). Prisma aggregate() only sums
    // scalar fields of the queried model, so it cannot reach these relation
    // fields in one call — same reason CustomersService and BusinessesService
    // use findMany + include + reduce. No raw SQL.
    const [kgRows, revenueRows] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          branch: { businessId: merchantId },
          status: ReservationStatus.COMPLETED,
          updatedAt: { gte: startOfDay },
        },
        select: { package: { select: { estimatedWeightKg: true } } },
      }),
      this.prisma.reservation.findMany({
        where: {
          branch: { businessId: merchantId },
          status: ReservationStatus.COMPLETED,
          updatedAt: { gte: weekAgo },
        },
        select: { package: { select: { discountedPrice: true } } },
      }),
    ]);

    const kgRescuedToday = kgRows.reduce(
      (sum, r) => sum + Number(r.package.estimatedWeightKg),
      0,
    );
    const weeklyRevenue = revenueRows.reduce(
      (sum, r) => sum + Number(r.package.discountedPrice),
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