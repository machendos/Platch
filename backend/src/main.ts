import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './system/config/config.service';
import { envBootstrapValidation } from './system/config/env-bootstrap-validation';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  envBootstrapValidation();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.128:5173',
      'capacitor://localhost',
      'ionic://localhost',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = ConfigService.port ? Number(ConfigService.port) : 3001;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
