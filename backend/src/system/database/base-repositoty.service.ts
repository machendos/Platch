import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma-client';
import { PrismaService } from './prisma.service';
import { TransactionsService } from './transactions.service';

@Injectable()
export class BaseRepository {
  constructor(
    protected readonly prismaService: PrismaService,
    protected readonly transactionsService: TransactionsService,
  ) {}

  protected get db(): Prisma.TransactionClient | PrismaService {
    return this.transactionsService.getTransaction() ?? this.prismaService;
  }
}
