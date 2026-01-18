import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VerificationService } from "./verification.service";
import { RecycleAction } from "../../entities/recycle-action.entity";
import { RecyclingPoint } from "../../entities/recycling-point.entity";
import { User } from "../../entities/user.entity";
import { AIVerificationModule } from "../ai-verification/ai-verification.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([RecycleAction, RecyclingPoint, User]),
    AIVerificationModule,
    StorageModule,
  ],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
