import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cron from 'node-cron';
import { PackageStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const EXPIRING_WINDOW_MINUTES = 30;

interface ExpireResult {
  packages: number;
  reservations: number;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private task?: cron.ScheduledTask;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    const rawMinutes = this.configService.get<number>('CRON_EXPIRACION_CADA_MINUTOS', 5);
    const minutes =
      Number.isInteger(rawMinutes) && rawMinutes >= 1 ? rawMinutes : 5;
    const expression = `*/${minutes} * * * *`;
    this.logger.log(`Expiration scheduler started (${expression})`);
    this.task = cron.schedule(expression, () => {
      void this.expireOverdue();
    });
  }

  onModuleDestroy(): void {
    this.task?.stop();
  }

  async expireOverdue(): Promise<ExpireResult> {
    const now = new Date();

    const [packages, reservations] = await this.prisma.$transaction([
      this.prisma.foodPackage.updateMany({
        where: {
          status: { in: [PackageStatus.AVAILABLE, PackageStatus.RESERVED] },
          pickupDeadline: { lt: now },
        },
        data: { status: PackageStatus.EXPIRED },
      }),
      this.prisma.reservation.updateMany({
        where: {
          status: ReservationStatus.PENDING,
          package: { pickupDeadline: { lt: now } },
        },
        data: { status: ReservationStatus.EXPIRED },
      }),
    ]);

    await this.notifyExpiringReservations(now);

    this.logger.log(
      `Expired ${packages.count} packages and ${reservations.count} reservations`,
    );
    return { packages: packages.count, reservations: reservations.count };
  }

  private async notifyExpiringReservations(now: Date): Promise<void> {
    const windowEnd = new Date(now.getTime() + EXPIRING_WINDOW_MINUTES * 60 * 1000);

    const expiringReservations = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        notifiedExpiring: false,
        package: {
          pickupDeadline: { gt: now, lte: windowEnd },
        },
      },
      include: {
        package: { select: { name: true } },
        branch: { select: { name: true } },
        client: { select: { id: true } },
      },
    });

    if (expiringReservations.length === 0) {
      return;
    }

    const ids = expiringReservations.map((r) => r.id);

    await this.prisma.reservation.updateMany({
      where: { id: { in: ids } },
      data: { notifiedExpiring: true },
    });

    await Promise.all(
      expiringReservations.map((reservation) =>
        this.notificationsService.createForUser({
          userId: reservation.client.id,
          type: 'PACKAGE_EXPIRING',
          title: 'Tu paquete está por vencer',
          message: `Tu paquete reservado "${reservation.package.name}" en ${reservation.branch.name} vence en menos de 30 minutos.`,
        }),
      ),
    );

    this.logger.log(
      `Sent ${expiringReservations.length} expiring notifications`,
    );
  }
}
