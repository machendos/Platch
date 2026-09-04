import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { CreateProjectDto, toCreateProject } from './dto/create.project.dto';
import { UpdateProjectDto, toUpdateProject } from './dto/update.project.dto';
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

  @Patch()
  updateProject(
    @GetUser() user: UserDescriptor,
    @TypedBody() body: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(toUpdateProject(body), user.id);
  }

  @Delete()
  deleteProject(@TypedQuery() query: { id: string }) {}
}
