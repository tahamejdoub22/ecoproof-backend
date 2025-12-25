import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecyclingPointsService } from './recycling-points.service';
import { RecyclingPoint } from '../../entities/recycling-point.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecyclingPoint])],
  providers: [RecyclingPointsService],
  exports: [RecyclingPointsService],
})
export class RecyclingPointsModule {}
