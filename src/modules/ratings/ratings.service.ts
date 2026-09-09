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
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        package: { select: { branchId: true } },
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

    try {
      return await this.prisma.rating.create({
        data: {
          score: dto.score,
          comment: dto.comment,
          reservationId: dto.reservationId,
          clientId,
          branchId: reservation.branchId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This reservation has already been rated');
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
}
