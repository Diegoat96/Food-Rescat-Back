import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cron from 'node-cron';
import { PackageStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

    this.logger.log(
      `Expired ${packages.count} packages and ${reservations.count} reservations`,
    );
    return { packages: packages.count, reservations: reservations.count };
  }
}