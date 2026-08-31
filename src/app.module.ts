import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PackagesModule } from './modules/packages/packages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    BranchesModule,
    CategoriesModule,
    PackagesModule,
  ],
})
export class AppModule {}
