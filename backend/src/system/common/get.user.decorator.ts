import { createParamDecorator } from '@nestjs/common';

export const GetUser = createParamDecorator((_, request) => {
  const user = request.switchToHttp().getRequest().user;
  if (!user)
    throw new Error(
      'use @GetUser decorator on endpoint where no user provided',
    );
  return user;
});
