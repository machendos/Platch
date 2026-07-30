import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { pinoLoggerOptions } from './pino.logger.options';
import * as pino from 'pino';
import { join } from '@prisma/client/runtime/edge';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [LoggerModule],
      inject: [],
      useFactory: () => {
        return {
          pinoHttp: [
            pinoLoggerOptions,
            pino.destination(
              // process.stdout,
              join([ConfigService.logDirPath, ConfigService.logFileName]),
            ),
          ],
        };
      },
    }),
  ],
})
export class LoggerModule {}
