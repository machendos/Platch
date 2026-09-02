import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { CreateProjectDto, toCreateProject } from './dto/create.project.dto';
import { MoveProjectDto } from './dto/move.project.dto';
import { UpdateProjectDto } from './dto/update.project.dto';
import { ProjectsService } from './project.service';

@Controller('project')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  getProjectsByUser(@GetUser() user: UserDescriptor) {
    return this.projectsService.getProjectsByUser(user.id);
  }

  @Get('colors')
  getColors(@GetUser() user: UserDescriptor) {
    return this.projectsService.getProjectColors(user.id);
  }

  @Post()
  createProject(
    @GetUser() user: UserDescriptor,
    @TypedBody() body: CreateProjectDto,
  ) {
    return this.projectsService.createProject(toCreateProject(body), user.id);
  }

  /* Returns nothing on purpose. The client applies the move optimistically and
     already holds the result; a body would only be a second copy of it to keep
     in step. It also keeps the route clear of nestia's response cloning, which
     has no shape to synthesise from void. */
  @Post('move')
  async moveProject(
    @GetUser() user: UserDescriptor,
    @TypedBody() body: MoveProjectDto,
  ): Promise<void> {
    await this.projectsService.moveProject(body, user.id);
  }

  @Patch()
  updateProject(@TypedBody() body: UpdateProjectDto) {}

  @Delete()
  deleteProject(@TypedQuery() query: { id: string }) {}
}
