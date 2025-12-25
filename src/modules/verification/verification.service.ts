import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RecycleAction, ActionStatus } from '../../entities/recycle-action.entity';
import { RecyclingPoint, MaterialType } from '../../entities/recycling-point.entity';
import { User } from '../../entities/user.entity';
import { AIVerificationService } from '../ai-verification/ai-verification.service';
import { StorageService } from '../storage/storage.service';

export interface VerificationResult {
  verified: boolean;
  score: number;
  reason?: string;
  aiScore?: number;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  // Validation thresholds
  private readonly MIN_CONFIDENCE = 0.80;
  private readonly MIN_BOUNDING_BOX_AREA = 0.25;
  private readonly MIN_FRAME_COUNT = 4;
  private readonly MIN_MOTION_SCORE = 0.3;
  private readonly MAX_GPS_ACCURACY = 20.0; // meters
  private readonly MAX_SPEED = 5.0; // m/s (18 km/h)
  private readonly MIN_VERIFICATION_SCORE = 0.85;
  private readonly MAX_FRAME_GAP_MS = 500;
  private readonly FRAME_WINDOW_MS = 2000;

  constructor(
    @InjectRepository(RecycleAction)
    private recycleActionRepo: Repository<RecycleAction>,
    @InjectRepository(RecyclingPoint)
    private recyclingPointRepo: Repository<RecyclingPoint>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private aiVerificationService: AIVerificationService,
    private storageService: StorageService,
    private dataSource: DataSource,
  ) {}

  /**
   * Main verification method
   */
  async verify(actionId: string): Promise<VerificationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Load action with relations
      const action = await queryRunner.manager.findOne(RecycleAction, {
        where: { id: actionId },
        relations: ['user', 'recyclingPoint'],
      });

      if (!action) {
        throw new Error(`Action not found: ${actionId}`);
      }

      // 1. Object Detection Validation
      const objectValidation = this.validateObjectDetection(action);
      if (!objectValidation.valid) {
        await queryRunner.rollbackTransaction();
        return {
          verified: false,
          score: 0.0,
          reason: objectValidation.reason,
        };
      }

      // 2. Location Validation
      const locationValidation = await this.validateLocation(action);
      if (!locationValidation.valid) {
        await queryRunner.rollbackTransaction();
        return {
          verified: false,
          score: 0.0,
          reason: locationValidation.reason,
        };
      }

      // 3. Image Uniqueness Check
      const uniquenessCheck = await this.checkImageUniqueness(action);
      if (!uniquenessCheck.valid) {
        await queryRunner.rollbackTransaction();
        return {
          verified: false,
          score: 0.0,
          reason: uniquenessCheck.reason,
        };
      }

      // 4. Frame Sequence Validation
      const frameValidation = this.validateFrameSequence(action);
      if (!frameValidation.valid) {
        await queryRunner.rollbackTransaction();
        return {
          verified: false,
          score: 0.0,
          reason: frameValidation.reason,
        };
      }

      // 5. AI Verification (Gemini/Ollama)
      const aiVerification = await this.aiVerificationService.verifyImage(
        action.imageUrl,
        action.objectType,
      );

      // 6. Calculate Verification Score
      const verificationScore = this.calculateVerificationScore(
        action,
        locationValidation.score,
        uniquenessCheck.score,
        frameValidation.score,
        aiVerification.score,
      );

      // Update action with scores
      action.verificationScore = verificationScore;
      action.aiVerificationScore = aiVerification.score;
      action.aiVerificationResult = aiVerification.result;

      // 7. Decision
      const verified = verificationScore >= this.MIN_VERIFICATION_SCORE;
      action.status = verified ? ActionStatus.VERIFIED : ActionStatus.REJECTED;

      await queryRunner.manager.save(action);
      await queryRunner.commitTransaction();

      return {
        verified,
        score: verificationScore,
        aiScore: aiVerification.score,
        reason: verified ? undefined : `Verification score ${verificationScore} below threshold ${this.MIN_VERIFICATION_SCORE}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Verification failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate object detection metadata
   */
  private validateObjectDetection(action: RecycleAction): {
    valid: boolean;
    reason?: string;
  } {
    if (action.confidence < this.MIN_CONFIDENCE) {
      return {
        valid: false,
        reason: `Confidence ${action.confidence} below minimum ${this.MIN_CONFIDENCE}`,
      };
    }

    if (action.boundingBoxAreaRatio < this.MIN_BOUNDING_BOX_AREA) {
      return {
        valid: false,
        reason: `Bounding box area ratio ${action.boundingBoxAreaRatio} below minimum ${this.MIN_BOUNDING_BOX_AREA}`,
      };
    }

    if (action.frameCountDetected < this.MIN_FRAME_COUNT) {
      return {
        valid: false,
        reason: `Frame count ${action.frameCountDetected} below minimum ${this.MIN_FRAME_COUNT}`,
      };
    }

    if (action.motionScore < this.MIN_MOTION_SCORE) {
      return {
        valid: false,
        reason: `Motion score ${action.motionScore} below minimum ${this.MIN_MOTION_SCORE}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate location and GPS data
   */
  private async validateLocation(action: RecycleAction): Promise<{
    valid: boolean;
    score: number;
    reason?: string;
  }> {
    const point = action.recyclingPoint;

    // 1. GPS accuracy check
    if (action.gpsAccuracy > this.MAX_GPS_ACCURACY) {
      return {
        valid: false,
        score: 0.0,
        reason: `GPS accuracy ${action.gpsAccuracy}m exceeds maximum ${this.MAX_GPS_ACCURACY}m`,
      };
    }

    // 2. Distance to recycling point
    const distance = this.calculateDistance(
      action.gpsLat,
      action.gpsLng,
      point.latitude,
      point.longitude,
    );

    if (distance > point.radius) {
      return {
        valid: false,
        score: 0.0,
        reason: `Distance ${distance}m exceeds recycling point radius ${point.radius}m`,
      };
    }

    // 3. Material match
    if (!point.allowedMaterials.includes(action.objectType)) {
      return {
        valid: false,
        score: 0.0,
        reason: `Material ${action.objectType} not allowed at this recycling point`,
      };
    }

    // 4. Speed check (check last action)
    const lastAction = await this.recycleActionRepo.findOne({
      where: { userId: action.userId },
      order: { createdAt: 'DESC' },
    });

    if (lastAction && lastAction.id !== action.id) {
      const timeDiff = (action.createdAt.getTime() - lastAction.createdAt.getTime()) / 1000; // seconds
      if (timeDiff > 0 && timeDiff < 10) {
        const lastDistance = this.calculateDistance(
          action.gpsLat,
          action.gpsLng,
          lastAction.gpsLat,
          lastAction.gpsLng,
        );
        const speed = lastDistance / timeDiff;

        if (speed > this.MAX_SPEED) {
          return {
            valid: false,
            score: 0.0,
            reason: `Impossible speed: ${speed.toFixed(2)} m/s (max: ${this.MAX_SPEED} m/s)`,
          };
        }

        // Check for impossible jumps
        if (lastDistance > 50 && timeDiff < 10) {
          return {
            valid: false,
            score: 0.0,
            reason: `Impossible location jump: ${lastDistance.toFixed(2)}m in ${timeDiff.toFixed(2)}s`,
          };
        }
      }
    }

    // 5. Altitude check (if available)
    if (point.altitude && action.gpsAltitude) {
      const altitudeDiff = Math.abs(action.gpsAltitude - point.altitude);
      if (altitudeDiff > 10) {
        return {
          valid: false,
          score: 0.0,
          reason: `Altitude difference ${altitudeDiff}m exceeds maximum 10m`,
        };
      }
    }

    // Calculate location score (0-1)
    const accuracyScore = 1 - Math.min(action.gpsAccuracy / this.MAX_GPS_ACCURACY, 1);
    const distanceScore = 1 - Math.min(distance / point.radius, 1);
    const locationScore = (accuracyScore + distanceScore) / 2;

    return { valid: true, score: locationScore };
  }

  /**
   * Check image uniqueness (hash and perceptual hash)
   */
  private async checkImageUniqueness(action: RecycleAction): Promise<{
    valid: boolean;
    score: number;
    reason?: string;
  }> {
    // Check SHA-256 hash uniqueness
    const existingByHash = await this.recycleActionRepo.findOne({
      where: { imageHash: action.imageHash },
    });

    if (existingByHash && existingByHash.id !== action.id) {
      return {
        valid: false,
        score: 0.0,
        reason: 'Duplicate image hash detected',
      };
    }

    // Check perceptual hash similarity
    const similarImages = await this.recycleActionRepo.find({
      where: { userId: action.userId },
      order: { createdAt: 'DESC' },
      take: 100, // Check last 100 actions
    });

    let minHammingDistance = Infinity;
    for (const img of similarImages) {
      if (img.id === action.id || !img.perceptualHash) continue;

      const hammingDistance = this.calculateHammingDistance(
        action.perceptualHash,
        img.perceptualHash,
      );

      if (hammingDistance < minHammingDistance) {
        minHammingDistance = hammingDistance;
      }

      // If too similar, reject
      if (hammingDistance <= 5) {
        return {
          valid: false,
          score: 0.0,
          reason: `Image too similar to previous submission (Hamming distance: ${hammingDistance})`,
        };
      }
    }

    // Calculate uniqueness score
    const uniquenessScore = minHammingDistance > 10 ? 1.0 : minHammingDistance / 10;

    return { valid: true, score: uniquenessScore };
  }

  /**
   * Validate frame sequence
   */
  private validateFrameSequence(action: RecycleAction): {
    valid: boolean;
    score: number;
    reason?: string;
  } {
    if (!action.frameMetadata || action.frameMetadata.length < 4) {
      return {
        valid: false,
        score: 0.0,
        reason: 'Insufficient frame metadata',
      };
    }

    const frames = action.frameMetadata.sort((a, b) => a.timestamp - b.timestamp);
    const firstTimestamp = frames[0].timestamp;
    const lastTimestamp = frames[frames.length - 1].timestamp;

    // Check frame window (must be within 2 seconds)
    if (lastTimestamp - firstTimestamp > this.FRAME_WINDOW_MS) {
      return {
        valid: false,
        score: 0.0,
        reason: `Frame window ${lastTimestamp - firstTimestamp}ms exceeds maximum ${this.FRAME_WINDOW_MS}ms`,
      };
    }

    // Check frame gaps
    for (let i = 1; i < frames.length; i++) {
      const gap = frames[i].timestamp - frames[i - 1].timestamp;
      if (gap > this.MAX_FRAME_GAP_MS) {
        return {
          valid: false,
          score: 0.0,
          reason: `Frame gap ${gap}ms exceeds maximum ${this.MAX_FRAME_GAP_MS}ms`,
        };
      }
    }

    // Check bounding box consistency
    const boundingBoxes = frames.map((f) => f.boundingBox);
    const xPositions = boundingBoxes.map((bb) => bb.x);
    const yPositions = boundingBoxes.map((bb) => bb.y);

    const xStdDev = this.calculateStdDev(xPositions);
    const yStdDev = this.calculateStdDev(yPositions);

    if (xStdDev > 0.2 || yStdDev > 0.2) {
      return {
        valid: false,
        score: 0.0,
        reason: `Bounding box inconsistency (std dev: x=${xStdDev.toFixed(2)}, y=${yStdDev.toFixed(2)})`,
      };
    }

    // Calculate consistency score
    const confidences = frames.map((f) => f.confidence);
    const confidenceStdDev = this.calculateStdDev(confidences);
    const consistencyScore = 1 - Math.min(confidenceStdDev / 0.2, 1.0);

    return { valid: true, score: consistencyScore };
  }

  /**
   * Calculate verification score (weighted sum)
   */
  private calculateVerificationScore(
    action: RecycleAction,
    locationScore: number,
    uniquenessScore: number,
    consistencyScore: number,
    aiScore: number,
  ): number {
    // Component scores
    const objectConfidenceScore = action.confidence; // 0-1
    const motionScore = Math.min(action.motionScore / 0.5, 1.0); // Normalize to 0-1
    const trustScore = action.user.trustScore; // 0-1

    // Weighted sum (updated with AI)
    const verificationScore =
      objectConfidenceScore * 0.2 + // Reduced from 25%
      consistencyScore * 0.15 + // Reduced from 20%
      motionScore * 0.1 + // Reduced from 15%
      locationScore * 0.15 + // Reduced from 20%
      uniquenessScore * 0.1 + // 10%
      aiScore * 0.2 + // NEW: AI verification (20%)
      trustScore * 0.1; // Reduced from 15%

    return Math.max(0.0, Math.min(1.0, verificationScore));
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
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

  /**
   * Calculate Hamming distance between two binary strings
   */
  private calculateHammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return Infinity;
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }

    return distance;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
