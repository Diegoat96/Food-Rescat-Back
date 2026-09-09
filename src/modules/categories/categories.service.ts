import { Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({ data: { name: dto.name } });
  }

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    // P2025 (category not found) is mapped to 404 by PrismaExceptionFilter.
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  remove(id: string): Promise<Category> {
    return this.prisma.category.delete({ where: { id } });
  }
}
