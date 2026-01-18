import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecycleActionsService } from "./recycle-actions.service";
import { RecycleAction } from "../../entities/recycle-action.entity";
import { RecyclingPoint } from "../../entities/recycling-point.entity";
import { User } from "../../entities/user.entity";
import { StorageModule } from "../storage/storage.module";
import { VerificationModule } from "../verification/verification.module";
import { TrustModule } from "../trust/trust.module";
import { RewardsModule } from "../rewards/rewards.module";
import { FraudModule } from "../fraud/fraud.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([RecycleAction, RecyclingPoint, User]),
    StorageModule,
    VerificationModule,
    TrustModule,
    RewardsModule,
    FraudModule,
    AuditModule,
  ],
  providers: [RecycleActionsService],
  exports: [RecycleActionsService],
})
export class RecycleActionsModule {}
