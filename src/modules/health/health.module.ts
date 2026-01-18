import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { AIVerificationModule } from "../ai-verification/ai-verification.module";

@Module({
  imports: [AIVerificationModule],
  controllers: [HealthController],
})
export class HealthModule {}
