import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecyclingPointsService } from './recycling-points.service';

@Controller('api/v1/recycling-points')
export class RecyclingPointsController {
  constructor(private pointsService: RecyclingPointsService) {}

  @Get()
  async findAll() {
    return this.pointsService.findAll();
  }

  @Get('nearest')
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
  async findOne(@Param('id') id: string) {
    return this.pointsService.findOne(id);
  }
}
