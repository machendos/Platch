import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma-client';
import { PrismaService } from './prisma.service';
import { TransactionsService } from './transactions.service';

/**
 * The client half of the ambient-transaction arrangement: a repository reaches
 * for `this.db` and gets the transaction currently in scope, or the plain
 * client when there is none.
 *
 * The point is that joining a transaction is not something a call site can
 * forget to do. Reaching past this for `prismaService` directly is what breaks
 * that, so repositories should not.
 */
@Injectable()
export class Repository {
  constructor(
    protected readonly prismaService: PrismaService,
    protected readonly transactionsService: TransactionsService,
  ) {}

  protected get db(): Prisma.TransactionClient | PrismaService {
    return this.transactionsService.getTransaction() ?? this.prismaService;
  }
}
