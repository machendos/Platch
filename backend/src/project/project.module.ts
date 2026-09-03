import { Module } from '@nestjs/common';
import { ProjectsController } from './project.controller';
import { ProjectsRepository } from './project.repository';
import { ProjectDragService } from './project.drag.service';
import { ProjectsService } from './project.service';
import { TimeComponentsModule } from '../time-component/time.component.module';

@Module({
  imports: [TimeComponentsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectDragService, ProjectsRepository],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
