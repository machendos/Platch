import { Injectable } from '@nestjs/common';
import { PrismaService } from '../system/database/prisma.service';
import { Prisma } from '../../prisma-client';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findUSerWithoutPassword(where: Prisma.UserWhereUniqueInput) {
    return this.prismaService.user.findUniqueOrThrow({
      where,
      omit: { hashedPassword: true },
    });
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.prismaService.user.create({
      data,
      omit: { hashedPassword: true },
    });
  }
}
