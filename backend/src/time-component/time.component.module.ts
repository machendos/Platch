import { Module } from '@nestjs/common';
import { TimeComponentsController } from './time.component.controller';
import { TimeComponentsRepository } from './time.component.repository';
import { TimeComponentsService } from './time.component.service';

@Module({
  controllers: [TimeComponentsController],
  providers: [TimeComponentsService, TimeComponentsRepository],
  exports: [TimeComponentsService, TimeComponentsRepository],
})
export class TimeComponentsModule {}
