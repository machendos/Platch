import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from 'nestjs-pino';
import { Prisma } from '../../../prisma-client';
import { ErrorCode } from '../errors/error.code';
import { ErrorType, PlatchError } from '../errors/platch.error';
import { fnv1aHash } from '../common/fnv1a.hash';
import { PrismaService } from './prisma.service';

export type TransactionOptions = {
  maxWaitForConnectionMilliseconds?: number;
  totalTimeoutMilliseconds?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

@Injectable()
export class TransactionsService {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: Logger,
  ) {}

  getTransaction(): Prisma.TransactionClient | null {
    return this.storage.getStore() ?? null;
  }

  async executeInTransaction<T>(
    options: TransactionOptions,
    callback: () => Promise<T>,
  ): Promise<T> {
    if (this.getTransaction()) {
      this.logger.warn(
        new PlatchError({
          type: ErrorType.SERVER_UNEXPECTED,
          code: ErrorCode.SERVER_ERROR,
          message: 'Attempt to create a nested transaction',
        }),
      );
    }

    return this.runWithinTransaction(options, callback);
  }

  /* pg_advisory_xact_lock is released when its transaction commits, so one
     taken in a transaction of its own would be gone before the caller used
     it. */
  async acquireLock(lockId: string): Promise<void> {
    const transaction = this.getTransaction();

    if (!transaction) {
      throw new PlatchError({
        type: ErrorType.SERVER_UNEXPECTED,
        code: ErrorCode.SERVER_ERROR,
        message: 'Attempt to take a lock outside a transaction',
      });
    }

    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${fnv1aHash(
      lockId,
    )}::bigint);`;
  }

  private async runWithinTransaction<T>(
    options: TransactionOptions,
    callback: () => Promise<T>,
  ): Promise<T> {
    const current = this.getTransaction();
    if (current) return callback();

    return this.prismaService.$transaction(
      (transaction) => this.storage.run(transaction, callback),
      {
        maxWait: options.maxWaitForConnectionMilliseconds,
        timeout: options.totalTimeoutMilliseconds,
        isolationLevel: options.isolationLevel,
      },
    );
  }
}
