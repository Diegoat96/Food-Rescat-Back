import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessRequest,
  BusinessRequestStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBusinessRequestDto } from './dto/create-business-request.dto';
import { ListBusinessRequestsDto } from './dto/list-business-requests.dto';
import { RejectBusinessRequestDto } from './dto/reject-business-request.dto';

export interface BusinessRequestFileUrls {
  businessLicenseUrl: string;
  photoUrl: string | null;
}

export interface BusinessRequestListResponse {
  data: BusinessRequest[];
  total: number;
  skip: number;
  take: number;
}

@Injectable()
export class BusinessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateBusinessRequestDto,
    userId: string,
    urls: BusinessRequestFileUrls,
  ): Promise<BusinessRequest> {
    const pending = await this.prisma.businessRequest.findFirst({
      where: { userId, status: BusinessRequestStatus.PENDING },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a pending business request',
      );
    }

    return this.prisma.businessRequest.create({
      data: {
        userId,
        businessName: dto.businessName,
        address: dto.address,
        businessLicenseUrl: urls.businessLicenseUrl,
        photoUrl: urls.photoUrl,
      },
    });
  }

  findLatestByUser(userId: string): Promise<BusinessRequest | null> {
    return this.prisma.businessRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminList(
    query: ListBusinessRequestsDto,
  ): Promise<BusinessRequestListResponse> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.businessRequest.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async approve(
    id: string,
    adminId: string,
  ): Promise<BusinessRequest> {
    const approved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.businessRequest.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException('Business request not found');
      }
      if (existing.status !== BusinessRequestStatus.PENDING) {
        throw new ConflictException(
          `Request cannot be approved: it is ${existing.status.toLowerCase()}`,
        );
      }

      const updated = await tx.businessRequest.update({
        where: { id },
        data: {
          status: BusinessRequestStatus.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: existing.userId },
        data: { role: UserRole.BUSINESS },
      });

      return updated;
    });

    await this.tryNotify(
      approved.userId,
      'BUSINESS_REQUEST_APPROVED',
      'Solicitud de negocio aprobada',
      `Tu negocio "${approved.businessName}" ha sido aprobado. Ya puedes crear tus sucursales.`,
    );

    return approved;
  }

  async reject(
    id: string,
    adminId: string,
    dto: RejectBusinessRequestDto,
  ): Promise<BusinessRequest> {
    const existing = await this.prisma.businessRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Business request not found');
    }
    if (existing.status !== BusinessRequestStatus.PENDING) {
      throw new ConflictException(
        `Request cannot be rejected: it is ${existing.status.toLowerCase()}`,
      );
    }

    const rejected = await this.prisma.businessRequest.update({
      where: { id },
      data: {
        status: BusinessRequestStatus.REJECTED,
        reason: dto.reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    await this.tryNotify(
      rejected.userId,
      'BUSINESS_REQUEST_REJECTED',
      'Solicitud de negocio rechazada',
      `Tu solicitud "${rejected.businessName}" fue rechazada: ${dto.reason}`,
    );

    return rejected;
  }

  private async tryNotify(
    userId: string,
    type: 'BUSINESS_REQUEST_APPROVED' | 'BUSINESS_REQUEST_REJECTED',
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.notifications.createForUser({
        userId,
        type,
        title,
        message,
      });
    } catch (error) {
      console.warn('Notification creation failed after review:', error);
    }
  }
}