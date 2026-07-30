import { EnvModel } from './env.model';
import { config } from 'dotenv';

config();
const env: EnvModel = process.env as unknown as EnvModel;

export const ConfigService = {
  host: env.HOST,
  port: env.PORT,
  redisHost: env.REDIS_HOST,
  redisPort: env.REDIS_PORT,
  redisPassword: env.REDIS_PASSWORD,

  logDirPath: env.LOG_DIR_PATH,
  logFileName: env.LOG_FILE_NAME,

  accessTokenTtlSeconds: parseInt(env.ACCESS_TOKEN_TTL_SECONDS),
  refreshTokenTtlSeconds: parseInt(env.REFRESH_TOKEN_TTL_SECONDS),
};
