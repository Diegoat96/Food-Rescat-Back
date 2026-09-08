import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto, businessId: string): Promise<Branch> {
    return this.prisma.branch.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        phone: dto.phone,
        openingHours: dto.openingHours,
        businessId,
      },
    });
  }

  findAll(businessId: string): Promise<Branch[]> {
    return this.prisma.branch.findMany({ where: { businessId } });
  }

  async findOne(id: string, businessId: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.businessId !== businessId) {
      throw new ForbiddenException('Branch does not belong to this business');
    }
    return branch;
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    businessId: string,
  ): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.businessId !== businessId) {
      throw new ForbiddenException('Branch does not belong to this business');
    }
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string, businessId: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.businessId !== businessId) {
      throw new ForbiddenException('Branch does not belong to this business');
    }
    return this.prisma.branch.delete({ where: { id } });
  }
}
