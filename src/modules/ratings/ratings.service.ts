import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRatingDto, clientId: string) {
    let reservationId: string | null = null;
    let packageId: string;
    let branchId: string;

    if (dto.reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: dto.reservationId },
        include: {
          package: { select: { id: true, branchId: true } },
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.clientId !== clientId) {
        throw new ForbiddenException('You can only rate your own reservations');
      }

      if (reservation.status !== ReservationStatus.COMPLETED) {
        throw new BadRequestException(
          'Only completed reservations can be rated',
        );
      }

      reservationId = reservation.id;
      packageId = reservation.package.id;
      branchId = reservation.branchId;
    } else if (dto.packageId) {
      const foodPackage = await this.prisma.foodPackage.findUnique({
        where: { id: dto.packageId },
      });

      if (!foodPackage) {
        throw new NotFoundException('Package not found');
      }

      packageId = foodPackage.id;
      branchId = foodPackage.branchId;
    } else {
      throw new BadRequestException(
        'Either reservationId or packageId is required',
      );
    }

    try {
      return await this.prisma.rating.create({
        data: {
          score: dto.score,
          comment: dto.comment,
          reservationId,
          clientId,
          branchId,
          packageId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already rated this package');
      }
      throw error;
    }
  }

  async findByBranch(branchId: string) {
    const [ratings, aggregate] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where: { branchId },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rating.aggregate({
        where: { branchId },
        _avg: { score: true },
        _count: true,
      }),
    ]);

    return {
      ratings,
      average: aggregate._avg.score ?? 0,
      total: aggregate._count,
    };
  }

  async findByPackage(packageId: string) {
    const [ratings, aggregate] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where: { packageId },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rating.aggregate({
        where: { packageId },
        _avg: { score: true },
        _count: true,
      }),
    ]);

    return {
      ratings,
      average: aggregate._avg.score ?? 0,
      total: aggregate._count,
    };
  }

  async findUnratedCompletedReservationForPackage(
    packageId: string,
    clientId: string,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        packageId,
        clientId,
        status: ReservationStatus.COMPLETED,
        rating: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    return reservation ? { reservationId: reservation.id } : { reservationId: null };
  }
}
