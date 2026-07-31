export type EnvModel = {
  HOST: string;
  PORT: string;

  DATABASE_URL: string;

  ENV: 'local' | 'prod';

  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD: string;

  LOG_DIR_PATH: string;
  LOG_FILE_NAME: string;

  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
};
