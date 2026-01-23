import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, Between } from 'typeorm';
import { RecyclingPoint } from '../../entities/recycling-point.entity';
import { RecyclingPointFilterDto } from '../../common/dto/recycling-point-filter.dto';
import { PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class RecyclingPointsService {
  constructor(
    @InjectRepository(RecyclingPoint)
    private pointRepo: Repository<RecyclingPoint>,
  ) {}

  /**
   * Get all recycling points with filtering and pagination
   */
  async findAll(filter: RecyclingPointFilterDto): Promise<PaginatedResponse<RecyclingPoint>> {
    const where: FindOptionsWhere<RecyclingPoint> = {};

    // Default to active only unless explicitly requested otherwise
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    } else {
      where.isActive = true;
    }

    if (filter.search) {
      where.name = Like(`%${filter.search}%`);
    }

    if (filter.materialType) {
      // @ts-expect-error - specific TypeORM behavior for simple-array
      where.allowedMaterials = Like(`%${filter.materialType}%`);
    }

    if (filter.fromDate && filter.toDate) {
      where.createdAt = Between(new Date(filter.fromDate), new Date(filter.toDate));
    }

    const sortField = filter.sortBy || 'name';
    const sortOrder = filter.sortOrder || 'ASC';

    const [data, total] = await this.pointRepo.findAndCount({
      where,
      order: { [sortField]: sortOrder },
      skip: filter.skip,
      take: filter.take,
    });

    const totalPages = Math.ceil(total / filter.take);
    const page = filter.page || 1;

    return {
      data,
      meta: {
        page,
        limit: filter.take,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get recycling point by ID
   */
  async findOne(id: string): Promise<RecyclingPoint> {
    const point = await this.pointRepo.findOne({ where: { id } });

    if (!point) {
      throw new NotFoundException(`Recycling point ${id} not found`);
    }

    return point;
  }

  /**
   * Find nearest recycling points
   */
  async findNearest(lat: number, lng: number, radiusKm: number = 5): Promise<RecyclingPoint[]> {
    // Simple distance calculation (for production, use PostGIS)
    const points = await this.pointRepo.find({ where: { isActive: true } });

    return points
      .map((point) => {
        const distance = this.calculateDistance(lat, lng, point.latitude, point.longitude);
        return { point, distance };
      })
      .filter(({ distance }) => distance <= radiusKm * 1000) // Convert km to meters
      .sort((a, b) => a.distance - b.distance)
      .map(({ point }) => point);
  }

  /**
   * Calculate distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
