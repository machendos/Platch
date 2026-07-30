import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { pinoLoggerOptions } from './pino.logger.options';
import * as pino from 'pino';
import { ConfigService } from '../config/config.service';
import { join } from 'path';
console.log(join(ConfigService.logDirPath, ConfigService.logFileName));
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
              join(ConfigService.logDirPath, ConfigService.logFileName),
            ),
          ],
        };
      },
    }),
  ],
})
export class LoggerModule {}
