import { Injectable, NotFoundException } from '@nestjs/common';
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
    // Ownership is enforced inside the query itself, so a branch belonging to
    // another business is simply "not found" instead of forbidden.
    const branch = await this.prisma.branch.findFirst({
      where: { id, businessId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  // Same scoping strategy via the compound unique (id, businessId): a single
  // statement fails with P2025, mapped to 404 by PrismaExceptionFilter.
  update(
    id: string,
    dto: UpdateBranchDto,
    businessId: string,
  ): Promise<Branch> {
    return this.prisma.branch.update({
      where: { id_businessId: { id, businessId } },
      data: dto,
    });
  }

  remove(id: string, businessId: string): Promise<Branch> {
    return this.prisma.branch.delete({
      where: { id_businessId: { id, businessId } },
    });
  }
}
