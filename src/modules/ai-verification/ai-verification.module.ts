import { Module } from '@nestjs/common';
import { AIVerificationService } from './ai-verification.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AIVerificationService],
  exports: [AIVerificationService],
})
export class AIVerificationModule {}
