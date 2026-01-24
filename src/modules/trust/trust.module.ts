import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TrustService } from "./trust.service";
import { User } from "../../entities/user.entity";
import { TrustHistory } from "../../entities/trust-history.entity";
import { RecycleAction } from "../../entities/recycle-action.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, TrustHistory, RecycleAction])],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
