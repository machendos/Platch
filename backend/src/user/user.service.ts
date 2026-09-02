import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import { ErrorCode } from '../system/errors/error.code';
import { DEFAULT_EVEN_LENGTH_MINUTES } from '../system/config/constants';
import { UserRepository } from './user.repository';

const scrypt = promisify(crypto.scrypt);

@Injectable()
class UserService {
  constructor(private userRepository: UserRepository) {}

  async getUser(userId: string) {
    return this.userRepository.findUSerWithoutPassword({ id: userId });
  }

  async createUser(username: string, unhashedPassword: string) {
    const hashedPassword = await this.hashPassword(unhashedPassword);
    try {
      return this.userRepository.createUser({
        hashedPassword,
        username,
        defaultEvenLengthMinutes: DEFAULT_EVEN_LENGTH_MINUTES,
      });
    } catch (e) {
      throw new PlatchError({
        type: ErrorType.COMMON,
        code: ErrorCode.USERNAME_ALREADY_EXIST,
        original: e,
      });
    }
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
