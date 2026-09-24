import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

export interface UserListResponse {
  data: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  skip: number;
  take: number;
}

export interface AdminStatisticsResponse {
  topBranches: Array<{
    branchId: string;
    name: string;
    completedReservations: number;
  }>;
  packagesByStatus: Array<{
    status: string;
    count: number;
  }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersDto): Promise<UserListResponse> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, skip, take };
  }

  async updateUserStatus(
    userId: string,
    adminId: string,
    dto: UpdateUserStatusDto,
  ) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot change your own status');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.role === UserRole.ADMIN && !dto.isActive) {
      throw new ForbiddenException('You cannot suspend another administrator');
    }

    if (target.isActive === dto.isActive) {
      throw new BadRequestException(
        `User is already ${dto.isActive ? 'active' : 'suspended'}`,
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getStatistics(): Promise<AdminStatisticsResponse> {
    // topBranches: groupBy is a perfect fit — count COMPLETED reservations
    // grouped by branchId, ordered desc and truncated to 5 by the DB.
    const topRaw = await this.prisma.reservation.groupBy({
      by: ['branchId'],
      where: { status: ReservationStatus.COMPLETED },
      _count: { _all: true },
      orderBy: { _count: { branchId: 'desc' } },
      take: 5,
    });

    const branchIds = topRaw.map((row) => row.branchId);
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [];
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    const topBranches = topRaw.map((row) => ({
      branchId: row.branchId,
      name: branchNameById.get(row.branchId) ?? 'Unknown',
      completedReservations: row._count._all,
    }));

    // packagesByStatus: groupBy on the FoodPackage status enum.
    const packagesByStatusRaw = await this.prisma.foodPackage.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const packagesByStatus = packagesByStatusRaw.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));

    return {
      topBranches,
      packagesByStatus,
    };
  }
}