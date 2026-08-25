import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CategoriesService', () => {
  let categoriesService: CategoriesService;

  const categoryId = 'category-uuid-11111111111111111111111111';

  const mockCategory = {
    id: categoryId,
    name: 'Bakery',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    categoriesService = module.get<CategoriesService>(CategoriesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a category with the given name', async () => {
      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await categoriesService.create({ name: 'Bakery' });

      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: { name: 'Bakery' },
      });
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('lists categories ordered by name', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);

      const result = await categoriesService.findAll();

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('update', () => {
    it('updates a category by id', async () => {
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        name: 'Pastry',
      });

      const result = await categoriesService.update(categoryId, {
        name: 'Pastry',
      });

      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { name: 'Pastry' },
      });
      expect(result.name).toBe('Pastry');
    });
  });

  describe('remove', () => {
    it('deletes a category by id', async () => {
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await categoriesService.remove(categoryId);

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
      expect(result).toEqual(mockCategory);
    });
  });
});
