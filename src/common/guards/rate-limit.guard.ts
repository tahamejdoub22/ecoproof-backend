import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(context: ExecutionContext): void {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    
    // Set rate limit headers
    const limit = this.getLimitValue(context);
    const ttl = this.getTracker(context).getTimeToExpire();
    
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl).toISOString());
    
    throw new ThrottlerException(
      `Rate limit exceeded. Maximum ${limit} requests per minute. Please try again in ${Math.ceil(ttl / 1000)} seconds.`,
    );
  }
}

