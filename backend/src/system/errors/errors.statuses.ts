import { ErrorCode } from './error.code';

export const errorStatuses: { [key in ErrorCode]?: number } = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.SERVER_ERROR]: 500,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.USERNAME_ALREADY_EXIST]: 400,
};
