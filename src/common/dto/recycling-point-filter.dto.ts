import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { FilterDto } from './filter.dto';
import { MaterialType } from '../../entities/recycling-point.entity';

export class RecyclingPointFilterDto extends FilterDto {
  @ApiProperty({ description: 'Filter by material type', enum: MaterialType, required: false })
  @IsOptional()
  @IsEnum(MaterialType)
  materialType?: MaterialType;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiProperty({ description: 'Search by name', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
