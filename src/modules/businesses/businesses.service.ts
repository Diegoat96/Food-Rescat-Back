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

    const completed = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.COMPLETED,
        updatedAt: { gte: startOfDay, lt: endOfDay },
        branch: { businessId },
      },
      select: {
        package: {
          select: { estimatedWeightKg: true, discountedPrice: true },
        },
      },
    });

    const kgRescuedToday = completed.reduce(
      (sum, reservation) => sum + Number(reservation.package.estimatedWeightKg),
      0,
    );
    const revenueToday = completed.reduce(
      (sum, reservation) => sum + Number(reservation.package.discountedPrice),
      0,
    );

    return {
      kgRescuedToday: Number(kgRescuedToday.toFixed(2)),
      ordersCompletedToday: completed.length,
      revenueToday: Number(revenueToday.toFixed(2)),
    };
  }
}