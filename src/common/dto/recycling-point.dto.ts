import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '../../entities/recycling-point.entity';

export class RecyclingPointDto {
  @ApiProperty({ description: 'Recycling point ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Point name', example: 'Downtown Recycling Center' })
  name: string;

  @ApiProperty({ description: 'Latitude', example: 40.7128 })
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: -74.0060 })
  longitude: number;

  @ApiProperty({ description: 'Radius in meters', example: 50 })
  radius: number;

  @ApiProperty({
    description: 'Allowed material types',
    enum: MaterialType,
    isArray: true,
    example: [MaterialType.PLASTIC, MaterialType.PAPER],
  })
  allowedMaterials: MaterialType[];

  @ApiProperty({ description: 'Location multiplier', example: 1.2 })
  multiplier: number;

  @ApiProperty({ description: 'Is active', example: true })
  isActive: boolean;
}

