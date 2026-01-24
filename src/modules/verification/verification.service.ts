import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  RecycleAction,
  ActionStatus,
} from "../../entities/recycle-action.entity";
import {
  RecyclingPoint,
  MaterialType,
} from "../../entities/recycling-point.entity";
import { User } from "../../entities/user.entity";
import { AIVerificationService } from "../ai-verification/ai-verification.service";
import { StorageService } from "../storage/storage.service";
import {
  ValidationMessages,
  ValidationHints,
} from "../../common/dto/validation-messages";

export interface VerificationResult {
  verified: boolean;
  score: number;
  reason?: string;
  aiScore?: number;
  details?: {
    objectDetection?: {
      passed: boolean;
      confidence?: number;
      boundingBoxArea?: number;
      frameCount?: number;
      motionScore?: number;
      issues?: string[];
    };
    location?: {
      passed: boolean;
      distance?: number;
      gpsAccuracy?: number;
      issues?: string[];
    };
    imageUniqueness?: {
      passed: boolean;
      hammingDistance?: number;
      issues?: string[];
    };
    frameSequence?: {
      passed: boolean;
      windowMs?: number;
      maxGapMs?: number;
      issues?: string[];
    };
    aiVerification?: {
      passed: boolean;
      detectedType?: string;
      confidence?: number;
      authentic?: boolean;
      issues?: string[];
    };
  };
  suggestions?: string[];
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  // Validation thresholds
  private readonly MIN_CONFIDENCE = 0.8;
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
        relations: ["user", "recyclingPoint"],
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
          details: {
            objectDetection: {
              passed: false,
              ...objectValidation.details,
            },
          },
          suggestions: objectValidation.suggestions,
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
          details: {
            objectDetection: {
              passed: true,
              ...objectValidation.details,
            },
            location: {
              passed: false,
              ...locationValidation.details,
            },
          },
          suggestions: locationValidation.suggestions,
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
          details: {
            objectDetection: {
              passed: true,
              ...objectValidation.details,
            },
            location: {
              passed: true,
              ...locationValidation.details,
            },
            imageUniqueness: {
              passed: false,
              ...uniquenessCheck.details,
            },
          },
          suggestions: uniquenessCheck.suggestions,
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
          details: {
            objectDetection: {
              passed: true,
              ...objectValidation.details,
            },
            location: {
              passed: true,
              ...locationValidation.details,
            },
            imageUniqueness: {
              passed: true,
              ...uniquenessCheck.details,
            },
            frameSequence: {
              passed: false,
              ...frameValidation.details,
            },
          },
          suggestions: frameValidation.suggestions,
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
        reason: verified
          ? undefined
          : `Verification score ${(verificationScore * 100).toFixed(1)}% is below required ${(this.MIN_VERIFICATION_SCORE * 100).toFixed(0)}%`,
        details: {
          objectDetection: {
            passed: true,
            ...objectValidation.details,
          },
          location: {
            passed: true,
            ...locationValidation.details,
          },
          imageUniqueness: {
            passed: true,
            ...uniquenessCheck.details,
          },
          frameSequence: {
            passed: true,
            ...frameValidation.details,
          },
          aiVerification: {
            passed: aiVerification.score >= 0.7,
            detectedType: aiVerification.result?.objectType,
            confidence: aiVerification.result?.confidence,
            authentic: aiVerification.result?.authentic,
            issues:
              aiVerification.score < 0.7
                ? ["AI verification score too low"]
                : undefined,
          },
        },
        suggestions: verified
          ? undefined
          : [
              "Try: Ensure object is clearly visible and well-lit",
              "Try: Keep camera steady during capture",
              "Try: Move closer to the recycling point",
              "Try: Wait for better GPS accuracy",
            ],
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
   * Validate object detection metadata (enhanced for mobile apps)
   */
  private validateObjectDetection(action: RecycleAction): {
    valid: boolean;
    reason?: string;
    details?: {
      confidence?: number;
      boundingBoxArea?: number;
      frameCount?: number;
      motionScore?: number;
      issues?: string[];
    };
    suggestions?: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check confidence
    if (action.confidence < this.MIN_CONFIDENCE) {
      issues.push(
        `Confidence ${(action.confidence * 100).toFixed(1)}% is below required ${(this.MIN_CONFIDENCE * 100).toFixed(0)}%`,
      );
      suggestions.push(ValidationHints.CONFIDENCE_TOO_LOW);
    }

    // Check bounding box area
    if (action.boundingBoxAreaRatio < this.MIN_BOUNDING_BOX_AREA) {
      issues.push(
        `Object size ${(action.boundingBoxAreaRatio * 100).toFixed(1)}% is below required ${(this.MIN_BOUNDING_BOX_AREA * 100).toFixed(0)}%`,
      );
      suggestions.push(ValidationHints.BOUNDING_BOX_TOO_SMALL);
    }

    // Check frame count
    if (action.frameCountDetected < this.MIN_FRAME_COUNT) {
      issues.push(
        `Only ${action.frameCountDetected} frame(s) detected, need at least ${this.MIN_FRAME_COUNT}`,
      );
      suggestions.push(ValidationHints.INSUFFICIENT_FRAMES);
    }

    // Check motion score
    if (action.motionScore < this.MIN_MOTION_SCORE) {
      issues.push(
        `Motion score ${(action.motionScore * 100).toFixed(1)}% is below required ${(this.MIN_MOTION_SCORE * 100).toFixed(0)}%`,
      );
      suggestions.push(ValidationHints.MOTION_TOO_LOW);
    }

    if (issues.length > 0) {
      return {
        valid: false,
        reason: ValidationMessages.CONFIDENCE_TOO_LOW,
        details: {
          confidence: action.confidence,
          boundingBoxArea: action.boundingBoxAreaRatio,
          frameCount: action.frameCountDetected,
          motionScore: action.motionScore,
          issues,
        },
        suggestions,
      };
    }

    return {
      valid: true,
      details: {
        confidence: action.confidence,
        boundingBoxArea: action.boundingBoxAreaRatio,
        frameCount: action.frameCountDetected,
        motionScore: action.motionScore,
      },
    };
  }

  /**
   * Validate location and GPS data (enhanced for mobile apps)
   */
  private async validateLocation(action: RecycleAction): Promise<{
    valid: boolean;
    score: number;
    reason?: string;
    details?: {
      distance?: number;
      gpsAccuracy?: number;
      issues?: string[];
    };
    suggestions?: string[];
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
      order: { createdAt: "DESC" },
    });

    if (lastAction && lastAction.id !== action.id) {
      const timeDiff =
        (action.createdAt.getTime() - lastAction.createdAt.getTime()) / 1000; // seconds
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
            reason: ValidationMessages.IMPOSSIBLE_SPEED,
            details: {
              distance,
              gpsAccuracy: action.gpsAccuracy,
              issues: [
                `Impossible speed detected: ${speed.toFixed(2)} m/s (max: ${this.MAX_SPEED} m/s)`,
              ],
            },
            suggestions: [
              "Please ensure GPS is accurate and you are at the correct location",
            ],
          };
        }

        // Check for impossible jumps
        if (lastDistance > 50 && timeDiff < 10) {
          return {
            valid: false,
            score: 0.0,
            reason: ValidationMessages.IMPOSSIBLE_JUMP,
            details: {
              distance,
              gpsAccuracy: action.gpsAccuracy,
              issues: [
                `Impossible location jump: ${lastDistance.toFixed(1)}m in ${timeDiff.toFixed(1)}s`,
              ],
            },
            suggestions: [
              "Please ensure you are at the correct location and GPS is accurate",
            ],
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
    const accuracyScore =
      1 - Math.min(action.gpsAccuracy / this.MAX_GPS_ACCURACY, 1);
    const distanceScore = 1 - Math.min(distance / point.radius, 1);
    const locationScore = (accuracyScore + distanceScore) / 2;

    return {
      valid: true,
      score: locationScore,
      details: {
        distance,
        gpsAccuracy: action.gpsAccuracy,
      },
    };
  }

  /**
   * Check image uniqueness (hash and perceptual hash) - enhanced for mobile
   */
  private async checkImageUniqueness(action: RecycleAction): Promise<{
    valid: boolean;
    score: number;
    reason?: string;
    details?: {
      hammingDistance?: number;
      issues?: string[];
    };
    suggestions?: string[];
  }> {
    // Check SHA-256 hash uniqueness
    const existingByHash = await this.recycleActionRepo.findOne({
      where: { imageHash: action.imageHash },
    });

    if (existingByHash && existingByHash.id !== action.id) {
      return {
        valid: false,
        score: 0.0,
        reason: ValidationMessages.DUPLICATE_IMAGE,
        details: {
          issues: ["This exact image has already been submitted"],
        },
        suggestions: ["Please capture a new, different image"],
      };
    }

    // Check perceptual hash similarity
    const similarImages = await this.recycleActionRepo.find({
      where: { userId: action.userId },
      order: { createdAt: "DESC" },
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
          reason: ValidationMessages.IMAGE_TOO_SIMILAR,
          details: {
            hammingDistance,
            issues: [
              `Image is too similar to a previous submission (similarity: ${hammingDistance}/64)`,
            ],
          },
          suggestions: [
            "Please capture a new, different image from a different angle",
          ],
        };
      }
    }

    // Calculate uniqueness score
    const uniquenessScore =
      minHammingDistance > 10 ? 1.0 : minHammingDistance / 10;

    return {
      valid: true,
      score: uniquenessScore,
      details: {
        hammingDistance: minHammingDistance,
      },
    };
  }

  /**
   * Validate frame sequence (enhanced for mobile)
   */
  private validateFrameSequence(action: RecycleAction): {
    valid: boolean;
    score: number;
    reason?: string;
    details?: {
      windowMs?: number;
      maxGapMs?: number;
      issues?: string[];
    };
    suggestions?: string[];
  } {
    if (!action.frameMetadata || action.frameMetadata.length < 4) {
      return {
        valid: false,
        score: 0.0,
        reason: "Insufficient frame metadata",
        details: {
          issues: ["Not enough frame data provided"],
        },
        suggestions: ["Please ensure all frames are captured and sent"],
      };
    }

    const frames = action.frameMetadata.sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    const firstTimestamp = frames[0].timestamp;
    const lastTimestamp = frames[frames.length - 1].timestamp;
    const windowMs = lastTimestamp - firstTimestamp;
    let maxGapMs = 0;

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check frame window (must be within 2 seconds)
    if (windowMs > this.FRAME_WINDOW_MS) {
      issues.push(
        `Frames captured over ${(windowMs / 1000).toFixed(1)}s, must be within ${(this.FRAME_WINDOW_MS / 1000).toFixed(1)}s`,
      );
      suggestions.push("Try: Capture all frames quickly within 2 seconds");
    }

    // Check frame gaps
    for (let i = 1; i < frames.length; i++) {
      const gap = frames[i].timestamp - frames[i - 1].timestamp;
      if (gap > maxGapMs) maxGapMs = gap;

      if (gap > this.MAX_FRAME_GAP_MS) {
        issues.push(
          `Gap of ${gap}ms between frames exceeds maximum ${this.MAX_FRAME_GAP_MS}ms`,
        );
        suggestions.push("Try: Capture frames continuously without pauses");
      }
    }

    if (issues.length > 0) {
      return {
        valid: false,
        score: 0.0,
        reason: issues[0],
        details: {
          windowMs,
          maxGapMs,
          issues,
        },
        suggestions,
      };
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
        reason: ValidationMessages.BOUNDING_BOX_INCONSISTENT,
        details: {
          windowMs,
          maxGapMs,
          issues: [
            `Object position changed too much between frames (x: ${xStdDev.toFixed(2)}, y: ${yStdDev.toFixed(2)})`,
          ],
        },
        suggestions: ["Try: Keep camera steady and object in same position"],
      };
    }

    // Calculate consistency score
    const confidences = frames.map((f) => f.confidence);
    const confidenceStdDev = this.calculateStdDev(confidences);
    const consistencyScore = 1 - Math.min(confidenceStdDev / 0.2, 1.0);

    return {
      valid: true,
      score: consistencyScore,
      details: {
        windowMs,
        maxGapMs,
      },
    };
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
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }
}
