import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RecyclingPoint } from "../../entities/recycling-point.entity";

@Injectable()
export class RecyclingPointsService {
  constructor(
    @InjectRepository(RecyclingPoint)
    private pointRepo: Repository<RecyclingPoint>,
  ) {}

  /**
   * Get all active recycling points
   */
  async findAll(): Promise<RecyclingPoint[]> {
    return this.pointRepo.find({
      where: { isActive: true },
      order: { name: "ASC" },
    });
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
  async findNearest(
    lat: number,
    lng: number,
    radiusKm: number = 5,
  ): Promise<RecyclingPoint[]> {
    // Simple distance calculation (for production, use PostGIS)
    const points = await this.pointRepo.find({ where: { isActive: true } });

    return points
      .map((point) => {
        const distance = this.calculateDistance(
          lat,
          lng,
          point.latitude,
          point.longitude,
        );
        return { point, distance };
      })
      .filter(({ distance }) => distance <= radiusKm * 1000) // Convert km to meters
      .sort((a, b) => a.distance - b.distance)
      .map(({ point }) => point);
  }

  /**
   * Calculate distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
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
