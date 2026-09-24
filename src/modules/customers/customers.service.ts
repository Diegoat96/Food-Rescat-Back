import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CustomerStatistics {
  totalRescues: number;
  totalSaved: number;
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
            originalPrice: true,
            discountedPrice: true,
          },
        },
      },
    });

    let totalRescues = 0;
    let totalSaved = 0;

    for (const reservation of reservations) {
      totalRescues += 1;
      totalSaved +=
        Number(reservation.package.originalPrice) -
        Number(reservation.package.discountedPrice);
    }

    return {
      totalRescues,
      totalSaved: Math.round(totalSaved * 100) / 100,
    };
  }
}
