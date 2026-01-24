import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  RecycleAction,
  ActionStatus,
} from "../../entities/recycle-action.entity";
import { TrustService } from "../trust/trust.service";

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(RecycleAction)
    private actionRepo: Repository<RecycleAction>,
    private trustService: TrustService,
  ) {}

  /**
   * Check for fraud patterns and flag suspicious actions
   */
  async checkPatterns(actionId: string): Promise<void> {
    const action = await this.actionRepo.findOne({
      where: { id: actionId },
      relations: ["user"],
    });

    if (!action) {
      return;
    }

    const patterns = [
      this.checkDuplicateImageAcrossUsers(action),
      this.checkLocationClustering(action),
      this.checkRapidSubmissions(action),
      this.checkLocationHopping(action),
      this.checkTrustScoreDrop(action),
      this.checkUnusualRewardPattern(action),
    ];

    const results = await Promise.all(patterns);
    const suspiciousPatterns = results.filter((r) => r.suspicious);

    if (suspiciousPatterns.length > 0) {
      // Flag action
      action.status = ActionStatus.FLAGGED;
      await this.actionRepo.save(action);

      // Apply penalty
      await this.trustService.applyPenalty(
        action.userId,
        "suspicious",
        actionId,
      );

      this.logger.warn(
        `Action ${actionId} flagged for fraud: ${suspiciousPatterns.map((p) => p.reason).join(", ")}`,
      );
    }
  }

  /**
   * Check if same image hash used by multiple users
   */
  private async checkDuplicateImageAcrossUsers(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const count = await this.actionRepo.count({
      where: { imageHash: action.imageHash },
    });

    if (count > 1) {
      return {
        suspicious: true,
        reason: `Same image hash used by ${count} users`,
      };
    }

    return { suspicious: false };
  }

  /**
   * Check if multiple users at same GPS coordinates simultaneously
   */
  private async checkLocationClustering(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const count = await this.actionRepo
      .createQueryBuilder("action")
      .where("action.gpsLat BETWEEN :latMin AND :latMax", {
        latMin: action.gpsLat - 0.0001,
        latMax: action.gpsLat + 0.0001,
      })
      .andWhere("action.gpsLng BETWEEN :lngMin AND :lngMax", {
        lngMin: action.gpsLng - 0.0001,
        lngMax: action.gpsLng + 0.0001,
      })
      .andWhere("action.createdAt >= :oneMinuteAgo", { oneMinuteAgo })
      .andWhere("action.userId != :userId", { userId: action.userId })
      .getCount();

    if (count >= 3) {
      return {
        suspicious: true,
        reason: `${count} users at same location within 1 minute`,
      };
    }

    return { suspicious: false };
  }

  /**
   * Check for rapid submissions (>5 in 1 minute)
   */
  private async checkRapidSubmissions(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const count = await this.actionRepo
      .createQueryBuilder("action")
      .where("action.userId = :userId", { userId: action.userId })
      .andWhere("action.createdAt >= :oneMinuteAgo", { oneMinuteAgo })
      .getCount();

    if (count > 5) {
      return {
        suspicious: true,
        reason: `${count} actions in 1 minute`,
      };
    }

    return { suspicious: false };
  }

  /**
   * Check for location hopping (>3 locations in <5 minutes)
   */
  private async checkLocationHopping(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentActions = await this.actionRepo
      .createQueryBuilder("action")
      .where("action.userId = :userId", { userId: action.userId })
      .andWhere("action.createdAt >= :fiveMinutesAgo", { fiveMinutesAgo })
      .getMany();

    const uniqueLocations = new Set(
      recentActions.map((a) => `${a.recyclingPointId}`),
    ).size;

    if (uniqueLocations > 3) {
      return {
        suspicious: true,
        reason: `${uniqueLocations} different locations in 5 minutes`,
      };
    }

    return { suspicious: false };
  }

  /**
   * Check for sudden trust score drop (>0.2 in 1 hour)
   */
  private async checkTrustScoreDrop(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    // This would require checking trust history
    // For now, we'll skip this check as it's handled by trust service
    return { suspicious: false };
  }

  /**
   * Check for unusual reward pattern (>80 points in 1 hour)
   */
  private async checkUnusualRewardPattern(action: RecycleAction): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentActions = await this.actionRepo
      .createQueryBuilder("action")
      .where("action.userId = :userId", { userId: action.userId })
      .andWhere("action.status = :status", { status: ActionStatus.VERIFIED })
      .andWhere("action.createdAt >= :oneHourAgo", { oneHourAgo })
      .getMany();

    const totalPoints = recentActions.reduce(
      (sum, a) => sum + (a.pointsAwarded || 0),
      0,
    );

    if (totalPoints > 80) {
      return {
        suspicious: true,
        reason: `${totalPoints} points in 1 hour`,
      };
    }

    return { suspicious: false };
  }
}
