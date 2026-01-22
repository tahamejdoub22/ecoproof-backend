import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    statusCode: number;
  };
  meta: {
    timestamp: string;
    requestId?: string;
    path: string;
    method: string;
    version?: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request as any).id || request.headers["x-request-id"] || "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL_ERROR";
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        details = responseObj.details || responseObj.errors || undefined;

        // Extract validation errors
        if (Array.isArray(responseObj.message)) {
          message = "Validation failed";
          details = {
            fields: responseObj.message.map((msg: string) => {
              const match = msg.match(/^(\w+)\s/);
              return {
                field: match ? match[1] : "unknown",
                message: msg,
              };
            }),
          };
        }
      }

      // Map status codes to error codes
      code = this.getErrorCode(status, message);
    } else if (exception instanceof Error) {
      message = exception.message;
      code = "INTERNAL_ERROR";
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message: this.getUserFriendlyMessage(message, code),
        details,
        statusCode: status,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        path: request.url,
        method: request.method,
        version: "v1",
      },
    };

    // Log error for debugging
    if (status >= 500) {
      this.logger.error(
        `Error ${status}: ${message}`,
        JSON.stringify({
          requestId,
          path: request.url,
          method: request.method,
          body: request.body,
        }),
      );
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number, message: string): string {
    if (status === 400) {
      if (message.toLowerCase().includes("validation"))
        return "VALIDATION_ERROR";
      return "BAD_REQUEST";
    }
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 404) return "NOT_FOUND";
    if (status === 409) return "CONFLICT";
    if (status === 429) return "RATE_LIMIT_EXCEEDED";
    if (status === 422) return "UNPROCESSABLE_ENTITY";
    return "INTERNAL_ERROR";
  }

  private getUserFriendlyMessage(message: string, code: string): string {
    // Map technical errors to user-friendly messages
    const friendlyMessages: Record<string, string> = {
      VALIDATION_ERROR: "Please check your input and try again",
      UNAUTHORIZED: "Please log in to continue",
      FORBIDDEN: "You do not have permission to perform this action",
      NOT_FOUND: "The requested resource was not found",
      CONFLICT: "This action has already been processed",
      RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later",
      UNPROCESSABLE_ENTITY: "Unable to process your request",
      INTERNAL_ERROR: "Something went wrong. Please try again later",
    };

    return friendlyMessages[code] || message;
  }
}
