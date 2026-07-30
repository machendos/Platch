import { validate } from 'typia';
import { EnvModel } from './env.model';

export const envBootstrapValidation = () => {
  const envValidationErrors = validate<EnvModel>(process.env);

  if (!envValidationErrors.success) {
    console.log({
      type: 'FATAL_BOOTSTRAP_ERROR',
      description: 'Environment variables validation error',
      details: envValidationErrors.errors,
    });
    process.exit(1);
  }
};
