import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export interface ApiResponseOptions {
  status: number;
  description: string;
  example?: any;
  isArray?: boolean;
}

export const ApiStandardResponse = <TModel extends Type<any>>(
  model: TModel,
  options: ApiResponseOptions,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: options.isArray
            ? {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              }
            : {
                $ref: getSchemaPath(model),
              },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-15T10:30:00Z',
              },
              requestId: {
                type: 'string',
                example: '550e8400-e29b-41d4-a716-446655440000',
              },
              version: {
                type: 'string',
                example: 'v1',
              },
            },
          },
        },
      },
      ...(options.example && { example: options.example }),
    }),
  );
};

export const ApiErrorResponse = (status: number, description: string, example?: any) => {
  return ApiResponse({
    status,
    description,
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: false,
        },
        error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
            },
            message: {
              type: 'string',
              example: 'Please check your input and try again',
            },
            details: {
              type: 'object',
            },
            statusCode: {
              type: 'number',
              example: status,
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            requestId: {
              type: 'string',
            },
            path: {
              type: 'string',
            },
            method: {
              type: 'string',
            },
            version: {
              type: 'string',
              example: 'v1',
            },
          },
        },
      },
    },
    ...(example && { example }),
  });
};

