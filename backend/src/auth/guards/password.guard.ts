import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../system/database/prisma.service';
import UserService from '../../user/user.service';

@Injectable()
export class PasswordGuard implements CanActivate {
  constructor(
    private prismaService: PrismaService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { username, password } = request.body as {
      username: string;
      password: string;
    };

    const user = await this.prismaService.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const status = await this.userService.comparePassword(
      password,
      user.hashedPassword,
    );

    if (!status) {
      throw new UnauthorizedException();
    }

    request.user = user;

    return true;
  }
}
