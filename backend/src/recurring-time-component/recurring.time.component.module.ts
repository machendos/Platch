import { Module } from '@nestjs/common';
import { RecurringTimeComponentsController } from './recurring.time.component.controller';
import { RecurringTimeComponentsRepository } from './recurring.time.component.repository';
import { RecurringTimeComponentsService } from './recurring.time.component.service';

@Module({
  controllers: [RecurringTimeComponentsController],
  providers: [
    RecurringTimeComponentsService,
    RecurringTimeComponentsRepository,
  ],
  exports: [RecurringTimeComponentsService, RecurringTimeComponentsRepository],
})
export class RecurringTimeComponentsModule {}
