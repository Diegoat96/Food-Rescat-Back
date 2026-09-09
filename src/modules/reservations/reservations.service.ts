import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PackageStatus, Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async verify(verificationCode: string, businessId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        verificationCode,
        status: ReservationStatus.PENDING,
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
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            businessId: true,
          },
        },
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.branch.businessId !== businessId) {
      throw new ForbiddenException(
        'Reservation does not belong to this business',
      );
    }

    await this.notificationsService.createForUser({
      userId: reservation.client.id,
      type: 'RESERVATION_CONFIRMED',
      title: 'Reservation confirmed',
      message: `Your reservation for ${reservation.package.name} at ${reservation.branch.name} has been confirmed.`,
    });

    return reservation;
  }

  async complete(id: string, businessId: string): Promise<Reservation> {
    return this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findFirst({
          where: {
            id,
            status: ReservationStatus.PENDING,
          },
          include: {
            package: { select: { name: true } },
            branch: { select: { businessId: true } },
          },
        });
        if (!reservation) {
          throw new NotFoundException('Reservation not found');
        }
        if (reservation.branch.businessId !== businessId) {
          throw new ForbiddenException(
            'Reservation does not belong to this business',
          );
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
    ).then(async (reservation) => {
      const fullReservation = await this.prisma.reservation.findUnique({
        where: { id },
        include: {
          package: { select: { name: true } },
          client: { select: { id: true } },
        },
      });

      if (fullReservation) {
        await this.notificationsService.createForUser({
          userId: fullReservation.client.id,
          type: 'RESERVATION_COMPLETED',
          title: 'Reservation completed',
          message: `Your reservation for ${fullReservation.package.name} has been marked as completed.`,
        });
      }

      return reservation;
    });
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
