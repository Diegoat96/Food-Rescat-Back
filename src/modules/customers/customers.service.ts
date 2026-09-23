import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CustomerStatistics {
  totalRescues: number;
  kgSaved: number;
  totalSaved: number;
}

export interface CustomerReservationHistoryItem {
  id: string;
  status: ReservationStatus;
  createdAt: Date;
  completedAt: Date | null;
  package: {
    id: string;
    name: string;
    category: { id: string; name: string };
  };
  branch: { id: string; name: string; address: string };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics(customerId: string): Promise<CustomerStatistics> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        clientId: customerId,
        status: ReservationStatus.COMPLETED,
      },
      include: {
        package: {
          select: {
            estimatedWeightKg: true,
            originalPrice: true,
            discountedPrice: true,
          },
        },
      },
    });

    let totalRescues = 0;
    let kgSaved = 0;
    let totalSaved = 0;

    for (const reservation of reservations) {
      totalRescues += 1;
      kgSaved += Number(reservation.package.estimatedWeightKg);
      totalSaved +=
        Number(reservation.package.originalPrice) -
        Number(reservation.package.discountedPrice);
    }

    return {
      totalRescues,
      kgSaved: Math.round(kgSaved * 100) / 100,
      totalSaved: Math.round(totalSaved * 100) / 100,
    };
  }

  async getReservations(
    customerId: string,
  ): Promise<CustomerReservationHistoryItem[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { clientId: customerId },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
        branch: { select: { id: true, name: true, address: true } },
      },
    });

    return reservations
      .map((reservation) => ({
        id: reservation.id,
        status: reservation.status,
        createdAt: reservation.createdAt,
        completedAt:
          reservation.status === ReservationStatus.COMPLETED
            ? reservation.updatedAt
            : null,
        package: reservation.package,
        branch: reservation.branch,
      }))
      .sort((a, b) => {
        const dateA = (a.completedAt ?? a.createdAt).getTime();
        const dateB = (b.completedAt ?? b.createdAt).getTime();
        return dateB - dateA;
      });
  }
}
