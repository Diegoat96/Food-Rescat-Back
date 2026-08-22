import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';

describe('BranchesService', () => {
  let branchesService: BranchesService;

  const ownerId = 'owner-uuid-1111111111111111111111111111';
  const otherOwnerId = 'other-uuid-2222222222222222222222222222';
  const branchId = 'branch-uuid-3333333333333333333333333333';

  const mockBranch = {
    id: branchId,
    businessId: ownerId,
    name: 'Main Branch',
    address: '123 Main Street',
    phone: null,
    openingHours: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const p2025Error = new Prisma.PrismaClientKnownRequestError(
    'Record not found',
    {
      code: 'P2025',
      clientVersion: 'test',
    },
  );

  const mockPrismaService = {
    branch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    branchesService = module.get<BranchesService>(BranchesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates the branch bound to the authenticated owner id', async () => {
      const dto: CreateBranchDto = {
        name: 'New Branch',
        address: '456 Oak Avenue',
      };
      mockPrismaService.branch.create.mockResolvedValue({
        ...mockBranch,
        ...dto,
        id: 'new-branch-id',
      });

      const result = await branchesService.create(dto, ownerId);

      expect(mockPrismaService.branch.create).toHaveBeenCalledWith({
        data: { ...dto, businessId: ownerId },
      });
      expect(result.businessId).toBe(ownerId);
    });
  });

  describe('findAll', () => {
    it('queries only branches belonging to the given owner', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([mockBranch]);

      const result = await branchesService.findAll(ownerId);

      expect(mockPrismaService.branch.findMany).toHaveBeenCalledWith({
        where: { businessId: ownerId },
      });
      expect(result).toEqual([mockBranch]);
    });
  });

  describe('findOne', () => {
    it('returns the branch when it belongs to the requesting owner', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);

      const result = await branchesService.findOne(branchId, ownerId);

      expect(mockPrismaService.branch.findFirst).toHaveBeenCalledWith({
        where: { id: branchId, businessId: ownerId },
      });
      expect(result).toEqual(mockBranch);
    });

    it('throws NotFound (never Forbidden) for a branch of another owner', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);

      await expect(
        branchesService.findOne(branchId, otherOwnerId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.branch.findFirst).toHaveBeenCalledWith({
        where: { id: branchId, businessId: otherOwnerId },
      });
    });
  });

  describe('update and remove ownership scoping', () => {
    // The service never compares owners manually: ownership lives inside the
    // Prisma where clause, so a foreign row is "not found" (P2025) which the
    // global PrismaExceptionFilter maps to 404 — not 403.
    it('update keeps businessId in the where clause so foreign rows resolve as not found', async () => {
      mockPrismaService.branch.update.mockRejectedValue(p2025Error);

      await expect(
        branchesService.update(branchId, { name: 'Hijacked' }, otherOwnerId),
      ).rejects.toMatchObject({ code: 'P2025' });

      expect(mockPrismaService.branch.update).toHaveBeenCalledWith({
        where: { id_businessId: { id: branchId, businessId: otherOwnerId } },
        data: { name: 'Hijacked' },
      });
    });

    it('remove keeps businessId in the where clause so foreign rows resolve as not found', async () => {
      mockPrismaService.branch.delete.mockRejectedValue(p2025Error);

      await expect(
        branchesService.remove(branchId, otherOwnerId),
      ).rejects.toMatchObject({ code: 'P2025' });

      expect(mockPrismaService.branch.delete).toHaveBeenCalledWith({
        where: { id_businessId: { id: branchId, businessId: otherOwnerId } },
      });
    });

    it('updates an own branch successfully', async () => {
      mockPrismaService.branch.update.mockResolvedValue({
        ...mockBranch,
        name: 'Renamed Branch',
      });

      const result = await branchesService.update(
        branchId,
        { name: 'Renamed Branch' },
        ownerId,
      );

      expect(mockPrismaService.branch.update).toHaveBeenCalledWith({
        where: { id_businessId: { id: branchId, businessId: ownerId } },
        data: { name: 'Renamed Branch' },
      });
      expect(result.name).toBe('Renamed Branch');
    });

    it('deletes an own branch returning the removed entity', async () => {
      mockPrismaService.branch.delete.mockResolvedValue(mockBranch);

      const result = await branchesService.remove(branchId, ownerId);

      expect(mockPrismaService.branch.delete).toHaveBeenCalledWith({
        where: { id_businessId: { id: branchId, businessId: ownerId } },
      });
      expect(result).toEqual(mockBranch);
    });
  });
});
