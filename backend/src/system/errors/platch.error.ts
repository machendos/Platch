import { ErrorCode } from './error.code';

export enum ErrorType {
  COMMON = 'COMMON',
  CLIENT_UNEXPECTED = 'CLIENT_UNEXPECTED',
  SERVER_UNEXPECTED = 'SERVER_UNEXPECTED',
}

class ErrorOption {
  type?: ErrorType;
  code?: ErrorCode;
  extraData?: object;
  message?: string;
  original?: Error;
  clearStack?: boolean;
}

export class PlatchError extends Error {
  type: ErrorType;
  code?: ErrorCode;
  extraData: object = {};
  message: string;
  original?: Error;

  constructor(options: ErrorOption) {
    super();

    this.type = options.type ?? ErrorType.SERVER_UNEXPECTED;
    this.code = options.code;
    this.extraData = options.extraData ?? {};
    this.message = options.message ?? '';
    this.original = options.original;
    if (options.clearStack) {
      this.stack = undefined;
    }
  }
}

export const toPlatchError = (error: Error): PlatchError =>
  error instanceof PlatchError
    ? error
    : new PlatchError({
        type: ErrorType.SERVER_UNEXPECTED,
        code: ErrorCode.SERVER_ERROR,
        message: error.message,
        original: error,
        clearStack: true,
      });
