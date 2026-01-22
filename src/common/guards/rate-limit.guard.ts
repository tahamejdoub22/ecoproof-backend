import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerException } from "@nestjs/throttler";
import { Request, Response } from "express";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get throttler options
    const throttlerOptions = this.options;
    const limit = throttlerOptions[0]?.limit || 100;
    const ttl = throttlerOptions[0]?.ttl || 60000;

    // Set rate limit headers
    response.setHeader("X-RateLimit-Limit", limit.toString());
    response.setHeader("X-RateLimit-Remaining", "0");
    response.setHeader(
      "X-RateLimit-Reset",
      new Date(Date.now() + ttl).toISOString(),
    );

    throw new ThrottlerException(
      `Rate limit exceeded. Maximum ${limit} requests per minute. Please try again in ${Math.ceil(ttl / 1000)} seconds.`,
    );
  }
}
