import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const validationExceptionFactory = (errors: ValidationError[]) => {
  const messages = errors.map((error) => {
    const constraints = Object.values(error.constraints || {});
    return `${error.property}|${constraints.join(', ')}`;
  });
  return new BadRequestException(messages);
};
