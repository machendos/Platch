import { Module } from '@nestjs/common';
import { EventsController } from './event.controller';
import { EventsRepository } from './event.repository';
import { EventsService } from './event.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsRepository],
  exports: [EventsService, EventsRepository],
})
export class EventsModule {}
