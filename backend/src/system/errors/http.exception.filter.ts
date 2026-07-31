import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ErrorCode } from './error.code';
import { ErrorType, PlatchError, toPlatchError } from './platch.error';
import { errorStatuses } from './errors.statuses';
import { DEFAULT_STATUS_CODE_ON_ERROR } from '../config/constants';

const returnOriginal = (original: Error | undefined) =>
  original instanceof PlatchError
    ? {
        ...original,
        message: original.message,
        stack: original?.stack,
        original: returnOriginal(original.original),
      }
    : { ...original, stack: original?.stack, message: original?.message };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private logger: PinoLogger) {}

  private catchNestError(error: HttpException): PlatchError {
    const extraData = error.getResponse();

    const mappedErrors: Record<number, PlatchError> = {
      400: new PlatchError({
        type: ErrorType.CLIENT_UNEXPECTED,
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Nest`s error: Bad Request',
        extraData: typeof extraData === 'object' ? extraData : {},
      }),
      401: new PlatchError({
        type: ErrorType.COMMON,
        code: ErrorCode.UNAUTHORIZED,
        message: 'Unauthorized',
        original: error,
      }),
      404: new PlatchError({
        type: ErrorType.CLIENT_UNEXPECTED,
        code: ErrorCode.NOT_FOUND,
        message: 'Nest`s error: Not found',
        extraData: typeof extraData === 'object' ? extraData : {},
      }),
    };

    return mappedErrors[error.getStatus()] ?? toPlatchError(error);
  }

  async catch(rowException: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const preparedException: PlatchError =
      rowException instanceof HttpException
        ? this.catchNestError(rowException)
        : toPlatchError(rowException);

    const preparedStatus = preparedException.code
      ? errorStatuses[preparedException.code]
      : DEFAULT_STATUS_CODE_ON_ERROR;

    const logObject = {
      error: {
        ...preparedException,
        stack: preparedException.stack,
        original: returnOriginal(preparedException.original),
      },
    };

    this.logger.error(logObject);

    this.logToStdout(preparedException);

    return response
      .status(preparedStatus ?? DEFAULT_STATUS_CODE_ON_ERROR)
      .send(preparedException);
  }

  private logToStdout(error: PlatchError) {
    console.log(
      `\n${new Date().toISOString()} \x1b[4m\x1b[1m\x1b[31m${
        error.type
      }:\x1b[0m`,
    );
    if (error.type !== ErrorType.COMMON) {
      console.dir(error, { depth: null });
      console.log(`\x1b[1m\x1b[31m${'^'.repeat(90)}`);
      console.log(`${'='.repeat(90)}\x1b[0m`);
    } else console.log(`code:${error.code}\nmessage:${error.message}\n`);
  }
}
