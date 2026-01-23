import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FilterDto } from './filter.dto';
import { MaterialType } from '../../entities/recycling-point.entity';
import { ActionStatus } from '../../entities/recycle-action.entity';

export class RecycleActionFilterDto extends FilterDto {
  @ApiProperty({ description: 'Filter by action status', enum: ActionStatus, required: false })
  @IsOptional()
  @IsEnum(ActionStatus)
  status?: ActionStatus;

  @ApiProperty({ description: 'Filter by object type', enum: MaterialType, required: false })
  @IsOptional()
  @IsEnum(MaterialType)
  objectType?: MaterialType;
}
