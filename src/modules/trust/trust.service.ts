import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TrustHistory } from '../../entities/trust-history.entity';
import { RecycleAction, ActionStatus } from '../../entities/recycle-action.entity';

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  // Trust score penalties
  private readonly PENALTY_DUPLICATE_IMAGE = -0.1;
  private readonly PENALTY_GPS_ANOMALY = -0.15;
  private readonly PENALTY_GPS_ACCURACY = -0.05;
  private readonly PENALTY_REJECTED = -0.05;
  private readonly PENALTY_SUSPICIOUS = -0.2;
  private readonly PENALTY_PHASH_SIMILAR = -0.08;

  // Trust score rewards
  private readonly REWARD_VERIFIED = 0.01;
  private readonly MIN_HOURS_BETWEEN_INCREASES = 1;
  private readonly DECAY_DAYS = 30; // Violations older than 30 days have 50% weight

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(TrustHistory)
    private trustHistoryRepo: Repository<TrustHistory>,
    @InjectRepository(RecycleAction)
    private actionRepo: Repository<RecycleAction>,
    private dataSource: DataSource,
  ) {}

  /**
   * Increase trust score after verified action
   */
  async increaseTrust(userId: string, actionId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Check minimum time between increases
      const lastIncrease = await queryRunner.manager.findOne(TrustHistory, {
        where: { userId, changeAmount: this.REWARD_VERIFIED },
        order: { createdAt: 'DESC' },
      });

      if (lastIncrease) {
        const hoursSince = (Date.now() - lastIncrease.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < this.MIN_HOURS_BETWEEN_INCREASES) {
          this.logger.debug(`Trust increase skipped: too soon (${hoursSince.toFixed(2)}h)`);
          await queryRunner.rollbackTransaction();
          return;
        }
      }

      // Increase trust score
      const previousScore = user.trustScore;
      const newScore = Math.min(1.0, previousScore + this.REWARD_VERIFIED);

      user.trustScore = newScore;
      await queryRunner.manager.save(user);

      // Log history
      await queryRunner.manager.save(TrustHistory, {
        userId,
        previousScore,
        newScore,
        changeAmount: this.REWARD_VERIFIED,
        reason: 'Verified recycling action',
        actionId,
      });

      await queryRunner.commitTransaction();
      this.logger.log(`Trust increased for user ${userId}: ${previousScore} → ${newScore}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to increase trust: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Decrease trust score for violation
   */
  async decreaseTrust(
    userId: string,
    reason: string,
    penalty: number,
    actionId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Apply time-based decay for old violations
      const recentViolations = await this.getRecentViolations(userId);
      const penaltyWithDecay = this.applyTimeDecay(penalty, recentViolations);

      const previousScore = user.trustScore;
      const newScore = Math.max(0.0, previousScore + penaltyWithDecay);

      user.trustScore = newScore;
      await queryRunner.manager.save(user);

      // Log history
      await queryRunner.manager.save(TrustHistory, {
        userId,
        previousScore,
        newScore,
        changeAmount: penaltyWithDecay,
        reason,
        actionId: actionId || null,
      });

      await queryRunner.commitTransaction();
      this.logger.warn(`Trust decreased for user ${userId}: ${previousScore} → ${newScore} (${reason})`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to decrease trust: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get trust multiplier for reward calculation
   */
  getTrustMultiplier(trustScore: number): number {
    if (trustScore < 0.3) {
      return 0.0; // Blocked
    } else if (trustScore < 0.5) {
      return 0.5; // Reduced
    } else {
      return 1.0; // Normal
    }
  }

  /**
   * Apply penalty for specific violation type
   */
  async applyPenalty(
    userId: string,
    violationType: 'duplicate' | 'gps_anomaly' | 'gps_accuracy' | 'rejected' | 'suspicious' | 'phash_similar',
    actionId?: string,
  ): Promise<void> {
    const penalties = {
      duplicate: this.PENALTY_DUPLICATE_IMAGE,
      gps_anomaly: this.PENALTY_GPS_ANOMALY,
      gps_accuracy: this.PENALTY_GPS_ACCURACY,
      rejected: this.PENALTY_REJECTED,
      suspicious: this.PENALTY_SUSPICIOUS,
      phash_similar: this.PENALTY_PHASH_SIMILAR,
    };

    const reason = `Violation: ${violationType}`;
    await this.decreaseTrust(userId, reason, penalties[violationType], actionId);
  }

  /**
   * Get recent violations for time-based decay calculation
   */
  private async getRecentViolations(userId: string): Promise<TrustHistory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.DECAY_DAYS);

    return this.trustHistoryRepo
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.createdAt >= :cutoffDate', { cutoffDate })
      .andWhere('history.changeAmount < 0') // Only violations
      .getMany();
  }

  /**
   * Apply time-based decay to penalty
   */
  private applyTimeDecay(penalty: number, recentViolations: TrustHistory[]): number {
    // If no recent violations, apply full penalty
    if (recentViolations.length === 0) {
      return penalty;
    }

    // Check if violations are old (apply 50% weight)
    const now = Date.now();
    const oldViolations = recentViolations.filter((v) => {
      const age = (now - v.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days
      return age > this.DECAY_DAYS;
    });

    // If all violations are old, reduce penalty
    if (oldViolations.length === recentViolations.length) {
      return penalty * 0.5;
    }

    return penalty;
  }
}
