import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './system/config/config.service';
import { envBootstrapValidation } from './system/config/env-bootstrap-validation';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  envBootstrapValidation();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    /* A dev server's port is not a constant. Worktrees run side by side and
       Vite takes whatever is free, so a list pinned to 5173 serves the first
       branch and silently CORS-blocks every other one — the failure reads as
       "the backend is down" from the browser, which is what makes it worth
       the function. Locally any loopback or LAN origin is allowed; everywhere
       else the list stays exact. */
    origin: (origin, callback) => {
      const allowed = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.1.128:5173',
        'capacitor://localhost',
        'ionic://localhost',
      ];

      // No Origin header at all: curl, the native shell, same-origin.
      if (!origin || allowed.includes(origin)) return callback(null, true);

      const isLocal =
        /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        );

      callback(
        isLocal && ConfigService.env === 'local'
          ? null
          : new Error(`Origin not allowed: ${origin}`),
        isLocal && ConfigService.env === 'local',
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = ConfigService.port ? Number(ConfigService.port) : 3001;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
