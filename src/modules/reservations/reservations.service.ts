import { Injectable, NotFoundException } from '@nestjs/common';
import { PackageStatus, Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(verificationCode: string, businessId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        verificationCode,
        status: ReservationStatus.PENDING,
        branch: { businessId },
      },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            estimatedWeightKg: true,
            discountedPrice: true,
            quantity: true,
            pickupDeadline: true,
            status: true,
          },
        },
        branch: {
          select: { id: true, name: true, city: true, address: true },
        },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  async complete(id: string, businessId: string): Promise<Reservation> {
    return this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findFirst({
          where: {
            id,
            status: ReservationStatus.PENDING,
            branch: { businessId },
          },
        });
        if (!reservation) {
          throw new NotFoundException('Reservation not found');
        }

        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: ReservationStatus.COMPLETED },
        });

        const remainingPending = await tx.reservation.count({
          where: {
            packageId: reservation.packageId,
            status: ReservationStatus.PENDING,
          },
        });
        const foodPackage = await tx.foodPackage.findUnique({
          where: { id: reservation.packageId },
        });

        if (
          remainingPending === 0 &&
          foodPackage &&
          foodPackage.quantity === 0
        ) {
          await tx.foodPackage.update({
            where: { id: reservation.packageId },
            data: { status: PackageStatus.PICKED_UP },
          });
        }

        return updatedReservation;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findPending(businessId: string) {
    return this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        branch: { businessId },
      },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            estimatedWeightKg: true,
            discountedPrice: true,
            quantity: true,
            pickupDeadline: true,
            status: true,
          },
        },
        branch: {
          select: { id: true, name: true, city: true, address: true },
        },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}