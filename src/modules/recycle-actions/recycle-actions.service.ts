import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, Between } from 'typeorm';
import { RecycleAction, ActionStatus } from '../../entities/recycle-action.entity';
import { MaterialType } from '../../entities/recycling-point.entity';
import { RecyclingPoint } from '../../entities/recycling-point.entity';
import { User } from '../../entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { VerificationService } from '../verification/verification.service';
import { TrustService } from '../trust/trust.service';
import { RewardsService } from '../rewards/rewards.service';
import { FraudService } from '../fraud/fraud.service';
import { AuditService } from '../audit/audit.service';
import { AuditActionType } from '../../entities/audit-log.entity';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { RecycleActionFilterDto } from '../../common/dto/recycle-action-filter.dto';
import { v4 as uuidv4 } from 'uuid';

export interface SubmitActionDto {
  recyclingPointId: string;
  objectType: MaterialType;
  confidence: number;
  boundingBoxAreaRatio: number;
  frameCountDetected: number;
  motionScore: number;
  imageHash: string;
  perceptualHash: string;
  frameMetadata: Array<{
    frameIndex: number;
    timestamp: number;
    confidence: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;
  imageMetadata: {
    width: number;
    height: number;
    format: string;
    capturedAt: number;
  };
  gpsLat: number;
  gpsLng: number;
  gpsAccuracy: number;
  gpsAltitude?: number;
  capturedAt: number;
  idempotencyKey: string;
}

@Injectable()
export class RecycleActionsService {
  private readonly logger = new Logger(RecycleActionsService.name);

  constructor(
    @InjectRepository(RecycleAction)
    private actionRepo: Repository<RecycleAction>,
    @InjectRepository(RecyclingPoint)
    private pointRepo: Repository<RecyclingPoint>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private storageService: StorageService,
    private verificationService: VerificationService,
    private trustService: TrustService,
    private rewardsService: RewardsService,
    private fraudService: FraudService,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  /**
   * Submit recycling action
   */
  async submit(
    userId: string,
    dto: SubmitActionDto,
    imageFile: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ verified: boolean; points?: number; reason?: string; actionId: string; status: string; verificationScore?: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check idempotency
      const existing = await queryRunner.manager.findOne(RecycleAction, {
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existing) {
        await queryRunner.rollbackTransaction();
        return {
          verified: existing.status === ActionStatus.VERIFIED,
          points: existing.pointsAwarded || undefined,
          reason: existing.status === ActionStatus.REJECTED ? 'Action rejected' : undefined,
          actionId: existing.id,
          status: existing.status,
          verificationScore: existing.verificationScore || undefined,
        };
      }

      // Validate recycling point
      const point = await queryRunner.manager.findOne(RecyclingPoint, {
        where: { id: dto.recyclingPointId },
      });

      if (!point || !point.isActive) {
        throw new BadRequestException('Recycling point not found or inactive');
      }

      // Validate user
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Upload image
      const actionId = uuidv4();
      const { url: imageUrl, hash: uploadedHash } = await this.storageService.uploadImage(
        imageFile,
        userId,
        actionId,
      );

      // Verify image hash matches
      if (uploadedHash !== dto.imageHash) {
        throw new BadRequestException('Image hash mismatch');
      }

      // Create action
      const action = queryRunner.manager.create(RecycleAction, {
        id: actionId,
        userId,
        recyclingPointId: dto.recyclingPointId,
        objectType: dto.objectType,
        confidence: dto.confidence,
        boundingBoxAreaRatio: dto.boundingBoxAreaRatio,
        frameCountDetected: dto.frameCountDetected,
        motionScore: dto.motionScore,
        imageHash: dto.imageHash,
        perceptualHash: dto.perceptualHash,
        imageUrl,
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
        gpsAccuracy: dto.gpsAccuracy,
        gpsAltitude: dto.gpsAltitude || null,
        frameMetadata: dto.frameMetadata,
        idempotencyKey: dto.idempotencyKey,
        status: ActionStatus.PENDING,
        user,
        recyclingPoint: point,
      });

      await queryRunner.manager.save(action);
      await queryRunner.commitTransaction();

      // Audit log
      await this.auditService.log(AuditActionType.ACTION_SUBMITTED, {
        userId,
        entityType: 'recycle_action',
        entityId: actionId,
        ipAddress,
        userAgent,
      });

      // Verify action (async - don't await)
      this.verifyAndProcess(actionId).catch((error) => {
        this.logger.error(`Verification failed for action ${actionId}: ${error.message}`);
      });

      return {
        verified: false, // Will be updated after verification
        reason: 'Verification in progress',
        actionId: action.id,
        status: ActionStatus.PENDING,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to submit action: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verify and process action
   */
  private async verifyAndProcess(actionId: string): Promise<void> {
    try {
      // Verify action
      const verification = await this.verificationService.verify(actionId);

      const action = await this.actionRepo.findOne({
        where: { id: actionId },
        relations: ['user'],
      });

      if (!action) {
        return;
      }

      if (verification.verified) {
        // Increase trust
        await this.trustService.increaseTrust(action.userId, actionId);

        // Award points
        const points = await this.rewardsService.calculateAndAward(actionId);

        // Audit log
        await this.auditService.log(AuditActionType.ACTION_VERIFIED, {
          userId: action.userId,
          entityType: 'recycle_action',
          entityId: actionId,
          metadata: { points, score: verification.score },
        });

        this.logger.log(`Action ${actionId} verified: ${points} points awarded`);
      } else {
        // Decrease trust
        await this.trustService.applyPenalty(action.userId, 'rejected', actionId);

        // Check for fraud
        await this.fraudService.checkPatterns(actionId);

        // Audit log
        await this.auditService.log(AuditActionType.ACTION_REJECTED, {
          userId: action.userId,
          entityType: 'recycle_action',
          entityId: actionId,
          metadata: { reason: verification.reason, score: verification.score },
        });

        this.logger.warn(`Action ${actionId} rejected: ${verification.reason}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process action ${actionId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get user's actions with pagination and filtering
   */
  async getUserActions(
    userId: string,
    filter: RecycleActionFilterDto,
  ): Promise<PaginatedResponse<RecycleAction>> {
    const where: FindOptionsWhere<RecycleAction> = { userId };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.objectType) {
      where.objectType = filter.objectType;
    }

    if (filter.fromDate && filter.toDate) {
      where.createdAt = Between(new Date(filter.fromDate), new Date(filter.toDate));
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'DESC';

    const [data, total] = await this.actionRepo.findAndCount({
      where,
      relations: ['recyclingPoint', 'reward'],
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
}
