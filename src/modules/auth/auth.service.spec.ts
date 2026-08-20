import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../../common/enums/user-role.enum';

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'test-uuid-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12',
    role: UserRole.CLIENT,
    phone: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { passwordHash: _hash, ...mockUserSafe } = mockUser;

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByEmailWithPassword: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto: RegisterDto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        ...mockUserSafe,
        name: dto.name,
        email: dto.email,
      });

      const result = await authService.register(dto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(result.email).toBe(dto.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto: RegisterDto = {
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.register(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return accessToken and user on valid login', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);

      jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true as never);

      const result = await authService.login(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(dto.email);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const dto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(authService.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUser);

      jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(false as never);

      await expect(authService.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('should return user by id without passwordHash', async () => {
      mockUsersService.findById.mockResolvedValue(mockUserSafe);

      const result = await authService.getMe(mockUser.id);

      expect(result).toEqual(mockUserSafe);
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
