export interface DtoClass<T> {
  __validate: (value: T) => string | void;
}

export const validateEach = <T>(
  values: NoInfer<T>[],
  dtoClass: DtoClass<T>,
  fieldName: string,
) => {
  const errors = values
    .map((value, index) => {
      const error = dtoClass.__validate(value);
      return error ? `${index}: ${error}` : undefined;
    })
    .filter((error) => error !== undefined);

  if (errors.length) return `Error in ${fieldName}: ${errors.join(', ')}`;
};
