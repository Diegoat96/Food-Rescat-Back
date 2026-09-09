import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(customerId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const existing = await this.prisma.favorite.findUnique({
      where: { customerId_branchId: { customerId, branchId } },
    });

    if (existing) {
      throw new ConflictException('Already favorited');
    }

    try {
      await this.prisma.favorite.create({
        data: { customerId, branchId },
      });
      return { favorited: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already favorited');
      }
      throw error;
    }
  }

  async remove(customerId: string, branchId: string) {
    await this.prisma.favorite.delete({
      where: { customerId_branchId: { customerId, branchId } },
    });
  }

  async findAllByCustomer(customerId: string) {
    return this.prisma.favorite.findMany({
      where: { customerId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            openingHours: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
