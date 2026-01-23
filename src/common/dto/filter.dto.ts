import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class FilterDto extends PaginationDto {
  @ApiProperty({ description: 'Sort field', required: false, example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ description: 'Sort order', enum: SortOrder, required: false, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiProperty({ description: 'Filter by start date (ISO)', required: false, example: '2023-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ description: 'Filter by end date (ISO)', required: false, example: '2023-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
