import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RecyclingPointsService } from './recycling-points.service';
import { RecyclingPointDto } from '../../common/dto/recycling-point.dto';
import { RecyclingPointFilterDto } from '../../common/dto/recycling-point-filter.dto';
import { PaginatedResponse } from '../../common/dto/pagination.dto';

@ApiTags('Recycling Points')
@Controller('api/v1/recycling-points')
export class RecyclingPointsController {
  constructor(private pointsService: RecyclingPointsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all recycling points', description: 'Retrieve all recycling points with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of recycling points' })
  async findAll(@Query() filter: RecyclingPointFilterDto): Promise<PaginatedResponse<RecyclingPointDto>> {
    return this.pointsService.findAll(filter);
  }

  @Get('nearest')
  @ApiOperation({ summary: 'Find nearest recycling points', description: 'Find recycling points near a location' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: 40.7128, type: Number })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: -74.0060, type: Number })
  @ApiQuery({ name: 'radius', description: 'Search radius in kilometers', example: 5, required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of nearest recycling points', type: [RecyclingPointDto] })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  async findNearest(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.pointsService.findNearest(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 5,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recycling point by ID', description: 'Retrieve a specific recycling point by its ID' })
  @ApiParam({ name: 'id', description: 'Recycling point UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Recycling point details', type: RecyclingPointDto })
  @ApiResponse({ status: 404, description: 'Recycling point not found' })
  async findOne(@Param('id') id: string) {
    return this.pointsService.findOne(id);
  }
}
