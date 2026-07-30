import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../system/database/prisma.service';

const scrypt = promisify(crypto.scrypt);

@Injectable()
class UserService {
  constructor(private prismaService: PrismaService) {}

  getUser(userId: string) {
    return this.prismaService.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async createUser(username: string, unhashedPassword: string) {
    const hashedPassword = await this.hashPassword(unhashedPassword);
    await this.prismaService.user.create({
      data: { hashedPassword, username },
    });
  }

  async comparePassword(password: string, hash: string) {
    const [salt, key] = hash.split(':');
    const saltBuffer = Buffer.from(salt, 'hex');
    const keyBuffer = Buffer.from(key, 'hex');

    const derivedKey = (await scrypt(password, saltBuffer, 64)) as Buffer;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  private async hashPassword(unhashedPassword: string) {
    const salt = randomBytes(16);
    const key = (await scrypt(unhashedPassword, salt, 64)) as Buffer;
    return salt.toString('hex') + ':' + key.toString('hex');
  }
}

export default UserService;
