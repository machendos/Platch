import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ErrorCode } from '../errors/error.code';
import { ErrorType, PlatchError } from '../errors/platch.error';
import { DtoClass } from './validate.each';

@Injectable()
export class ValidateBodyPipe implements PipeTransform {
  transform(value: unknown, { metatype }: ArgumentMetadata) {
    if (!metatype || typeof value !== 'object' || value === null) return value;

    const validate = (metatype as Partial<DtoClass<never>>).__validate;
    if (!validate) return value;

    const errorMessage = validate(value as never);

    if (errorMessage)
      throw new PlatchError({
        type: ErrorType.CLIENT_UNEXPECTED,
        code: ErrorCode.VALIDATION_FAILED,
        message: errorMessage,
      });

    return value;
  }
}
