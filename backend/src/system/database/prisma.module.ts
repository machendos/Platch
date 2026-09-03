import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionsService } from './transactions.service';

@Global()
@Module({
  providers: [PrismaService, TransactionsService],
  exports: [PrismaService, TransactionsService],
})
export class PrismaModule {}
