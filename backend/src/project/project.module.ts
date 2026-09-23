import { Module } from '@nestjs/common';
import { ProjectsController } from './project.controller';
import { ProjectsRepository } from './project.repository';
import { ProjectDragService } from './project.drag.service';
import { ProjectsService } from './project.service';
import { RecurringTimeComponentsModule } from '../recurring-time-component/recurring.time.component.module';
import { EventsModule } from '../event/event.module';

@Module({
  imports: [RecurringTimeComponentsModule, EventsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectDragService, ProjectsRepository],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
