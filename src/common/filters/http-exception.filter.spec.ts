
import { Test, TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from './http-exception.filter';
import { validationExceptionFactory } from '../utils/validation-exception.factory';
import { ValidationError } from 'class-validator';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('HttpExceptionFilter & Validation Logic', () => {
  let filter: HttpExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
  });

  // Helper to mock ArgumentsHost
  function mockArgumentsHost() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      headers: {},
      url: '/test',
      method: 'POST',
    };
    const httpArgumentsHost = {
      getResponse: () => response,
      getRequest: () => request,
    };
    const host = {
      switchToHttp: () => httpArgumentsHost,
    };
    return { host, response, request };
  }

  it('should correctly process validation exception from factory', () => {
    // 1. Create a real validation error
    const validationError = new ValidationError();
    validationError.property = 'email';
    validationError.constraints = { isEmail: 'Invalid email address provided' };

    // 2. Generate exception using the REAL factory
    const exception = validationExceptionFactory([validationError]);

    // 3. Process with filter
    const { host, response } = mockArgumentsHost();
    filter.catch(exception, host as unknown as ArgumentsHost);

    // 4. Verify response
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const jsonArgs = response.json.mock.calls[0][0];

    // Verify structure
    expect(jsonArgs.success).toBe(false);
    expect(jsonArgs.error.code).toBe('VALIDATION_ERROR');

    // Verify field extraction
    const fieldError = jsonArgs.error.details.fields[0];
    expect(fieldError.field).toBe('email');
    expect(fieldError.message).toBe('Invalid email address provided');
  });

  it('should process standard messages correctly', () => {
     const validationError = new ValidationError();
     validationError.property = 'password';
     validationError.constraints = { minLength: 'password must be longer than 8 chars' };

     const exception = validationExceptionFactory([validationError]);

     const { host, response } = mockArgumentsHost();
     filter.catch(exception, host as unknown as ArgumentsHost);

     const jsonArgs = response.json.mock.calls[0][0];
     const fieldError = jsonArgs.error.details.fields[0];

     expect(fieldError.field).toBe('password');
     expect(fieldError.message).toBe('password must be longer than 8 chars');
  });
});
