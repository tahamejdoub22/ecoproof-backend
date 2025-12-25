import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reward } from '../../entities/reward.entity';
import { RecycleAction, ActionStatus, MaterialType } from '../../entities/recycle-action.entity';
import { User } from '../../entities/user.entity';
import { RecyclingPoint } from '../../entities/recycling-point.entity';
import { TrustService } from '../trust/trust.service';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  // Base points per material
  private readonly BASE_POINTS: Record<MaterialType, number> = {
    [MaterialType.PLASTIC_BOTTLE]: 5,
    [MaterialType.ALUMINUM_CAN]: 7,
    [MaterialType.GLASS_BOTTLE]: 10,
    [MaterialType.PAPER]: 3,
    [MaterialType.CARDBOARD]: 4,
  };

  // Limits
  private readonly MAX_DAILY_POINTS = 100;
  private readonly MAX_LOCATION_DAILY_POINTS = 40;
  private readonly MAX_SAME_MATERIAL_PER_10MIN = 3;
  private readonly ACTION_COOLDOWN_SECONDS = 30;
  private readonly LOCATION_COOLDOWN_SECONDS = 120;

  // Streak multiplier
  private readonly STREAK_MULTIPLIER_RATE = 0.05; // 5% per day
  private readonly MAX_STREAK_MULTIPLIER = 2.0; // Max 2x (40 days)

  constructor(
    @InjectRepository(Reward)
    private rewardRepo: Repository<Reward>,
    @InjectRepository(RecycleAction)
    private actionRepo: Repository<RecycleAction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RecyclingPoint)
    private pointRepo: Repository<RecyclingPoint>,
    private trustService: TrustService,
    private dataSource: DataSource,
  ) {}

  /**
   * Calculate and award points for verified action
   */
  async calculateAndAward(actionId: string): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Load action with relations
      const action = await queryRunner.manager.findOne(RecycleAction, {
        where: { id: actionId },
        relations: ['user', 'recyclingPoint'],
      });

      if (!action || action.status !== ActionStatus.VERIFIED) {
        throw new Error(`Action ${actionId} is not verified`);
      }

      // Check if reward already exists
      const existingReward = await queryRunner.manager.findOne(Reward, {
        where: { actionId },
      });

      if (existingReward) {
        this.logger.warn(`Reward already exists for action ${actionId}`);
        await queryRunner.rollbackTransaction();
        return existingReward.finalPoints;
      }

      // Check limits
      const limitsCheck = await this.checkLimits(action);
      if (!limitsCheck.allowed) {
        await queryRunner.rollbackTransaction();
        throw new Error(`Limits exceeded: ${limitsCheck.reason}`);
      }

      // Calculate points
      const basePoints = this.BASE_POINTS[action.objectType];
      const locationMultiplier = action.recyclingPoint.multiplier;
      const streakMultiplier = this.calculateStreakMultiplier(action.user);
      const trustMultiplier = this.trustService.getTrustMultiplier(action.user.trustScore);

      const finalPoints = Math.floor(
        basePoints * locationMultiplier * streakMultiplier * trustMultiplier,
      );

      // Create reward record
      const reward = queryRunner.manager.create(Reward, {
        userId: action.userId,
        actionId: action.id,
        basePoints,
        locationMultiplier,
        streakMultiplier,
        trustMultiplier,
        finalPoints,
      });

      await queryRunner.manager.save(reward);

      // Update action
      action.pointsAwarded = finalPoints;
      await queryRunner.manager.save(action);

      // Update user streak
      await this.updateStreak(action.userId, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Awarded ${finalPoints} points to user ${action.userId} for action ${actionId}`,
      );

      return finalPoints;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to calculate and award points: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check all limits before awarding points
   */
  private async checkLimits(action: RecycleAction): Promise<{ allowed: boolean; reason?: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Daily global limit
    const todayRewards = await this.rewardRepo
      .createQueryBuilder('reward')
      .where('reward.userId = :userId', { userId: action.userId })
      .andWhere('reward.createdAt >= :today', { today })
      .getMany();

    const todayTotal = todayRewards.reduce((sum, r) => sum + r.finalPoints, 0);
    if (todayTotal >= this.MAX_DAILY_POINTS) {
      return {
        allowed: false,
        reason: `Daily limit reached: ${todayTotal}/${this.MAX_DAILY_POINTS} points`,
      };
    }

    // 2. Daily location limit
    const todayLocationRewards = todayRewards.filter(
      (r) => r.actionId === action.id || this.actionRepo.findOne({ where: { id: r.actionId } }),
    );

    // Get location points for today
    const locationActions = await this.actionRepo.find({
      where: {
        userId: action.userId,
        recyclingPointId: action.recyclingPointId,
        status: ActionStatus.VERIFIED,
      },
      relations: ['reward'],
    });

    const locationTodayTotal = locationActions
      .filter((a) => a.createdAt >= today)
      .reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);

    if (locationTodayTotal >= this.MAX_LOCATION_DAILY_POINTS) {
      return {
        allowed: false,
        reason: `Location daily limit reached: ${locationTodayTotal}/${this.MAX_LOCATION_DAILY_POINTS} points`,
      };
    }

    // 3. Same material cooldown (3 per 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentSameMaterial = await this.actionRepo
      .createQueryBuilder('action')
      .where('action.userId = :userId', { userId: action.userId })
      .andWhere('action.objectType = :objectType', { objectType: action.objectType })
      .andWhere('action.status = :status', { status: ActionStatus.VERIFIED })
      .andWhere('action.createdAt >= :tenMinutesAgo', { tenMinutesAgo })
      .getCount();

    if (recentSameMaterial >= this.MAX_SAME_MATERIAL_PER_10MIN) {
      return {
        allowed: false,
        reason: `Same material limit: ${recentSameMaterial}/${this.MAX_SAME_MATERIAL_PER_10MIN} in 10 minutes`,
      };
    }

    // 4. Global cooldown (30 seconds)
    const lastAction = await this.actionRepo.findOne({
      where: { userId: action.userId },
      order: { createdAt: 'DESC' },
    });

    if (lastAction && lastAction.id !== action.id) {
      const secondsSince = (Date.now() - lastAction.createdAt.getTime()) / 1000;
      if (secondsSince < this.ACTION_COOLDOWN_SECONDS) {
        return {
          allowed: false,
          reason: `Global cooldown: ${secondsSince.toFixed(1)}s < ${this.ACTION_COOLDOWN_SECONDS}s`,
        };
      }
    }

    // 5. Location cooldown (2 minutes)
    const lastLocationAction = await this.actionRepo.findOne({
      where: {
        userId: action.userId,
        recyclingPointId: action.recyclingPointId,
      },
      order: { createdAt: 'DESC' },
    });

    if (lastLocationAction && lastLocationAction.id !== action.id) {
      const secondsSince = (Date.now() - lastLocationAction.createdAt.getTime()) / 1000;
      if (secondsSince < this.LOCATION_COOLDOWN_SECONDS) {
        return {
          allowed: false,
          reason: `Location cooldown: ${secondsSince.toFixed(1)}s < ${this.LOCATION_COOLDOWN_SECONDS}s`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Calculate streak multiplier
   */
  private calculateStreakMultiplier(user: User): number {
    const multiplier = 1 + user.streakDays * this.STREAK_MULTIPLIER_RATE;
    return Math.min(this.MAX_STREAK_MULTIPLIER, multiplier);
  }

  /**
   * Update user streak
   */
  private async updateStreak(userId: string, queryRunner: any): Promise<void> {
    const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActionDate = user.lastActionAt ? new Date(user.lastActionAt) : null;
    if (lastActionDate) {
      lastActionDate.setHours(0, 0, 0, 0);
    }

    // If last action was yesterday, increment streak
    if (lastActionDate) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastActionDate.getTime() === yesterday.getTime()) {
        // Consecutive day
        user.streakDays += 1;
      } else if (lastActionDate.getTime() < yesterday.getTime()) {
        // Streak broken
        user.streakDays = 1;
      }
      // If same day, keep streak
    } else {
      // First action
      user.streakDays = 1;
    }

    user.lastActionAt = new Date();
    await queryRunner.manager.save(user);
  }
}
