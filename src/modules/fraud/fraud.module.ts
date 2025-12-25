import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudService } from './fraud.service';
import { RecycleAction } from '../../entities/recycle-action.entity';
import { TrustModule } from '../trust/trust.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecycleAction]), TrustModule],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
