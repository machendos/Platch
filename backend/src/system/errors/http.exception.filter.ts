import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  async catch(rowException: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    console.dir(rowException, { depth: 4 });

    return response
      .status(rowException instanceof UnauthorizedException ? 401 : 500)
      .send(rowException);
  }
}
