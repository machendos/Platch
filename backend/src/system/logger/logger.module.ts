import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { pinoLoggerOptions } from './pino.logger.options';
import * as pino from 'pino';
import { ConfigService } from '../config/config.service';
import { join } from 'path';

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
              ConfigService.env === 'local'
                ? join(ConfigService.logDirPath, ConfigService.logFileName)
                : process.stdout,
            ),
          ],
        };
      },
    }),
  ],
})
export class LoggerModule {}
