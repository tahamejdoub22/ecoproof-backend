import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RewardsService } from "./rewards.service";
import { Reward } from "../../entities/reward.entity";
import { RecycleAction } from "../../entities/recycle-action.entity";
import { User } from "../../entities/user.entity";
import { RecyclingPoint } from "../../entities/recycling-point.entity";
import { TrustModule } from "../trust/trust.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward, RecycleAction, User, RecyclingPoint]),
    TrustModule,
  ],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
