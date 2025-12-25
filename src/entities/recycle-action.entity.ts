import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { RecyclingPoint, MaterialType } from './recycling-point.entity';
import { Reward } from './reward.entity';

export enum ActionStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

@Entity('recycle_actions')
export class RecycleAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'recycling_point_id' })
  @Index()
  recyclingPointId: string;

  @Column({ name: 'object_type', type: 'enum', enum: MaterialType })
  @Index()
  objectType: MaterialType;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  confidence: number;

  @Column({ name: 'image_hash', unique: true })
  @Index('idx_recycle_actions_image_hash')
  imageHash: string;

  @Column({ name: 'perceptual_hash' })
  @Index()
  perceptualHash: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 10, scale: 8 })
  gpsLat: number;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 11, scale: 8 })
  gpsLng: number;

  @Column({ name: 'gps_accuracy', type: 'decimal', precision: 5, scale: 2 })
  gpsAccuracy: number;

  @Column({ name: 'gps_altitude', type: 'decimal', precision: 8, scale: 2, nullable: true })
  gpsAltitude: number | null;

  @Column({ name: 'verification_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  verificationScore: number | null;

  @Column({ name: 'ai_verification_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  aiVerificationScore: number | null;

  @Column({ name: 'ai_verification_result', type: 'jsonb', nullable: true })
  aiVerificationResult: {
    objectType: string;
    confidence: number;
    authentic: boolean;
    quality: string;
    reasoning: string;
  } | null;

  @Column({ type: 'enum', enum: ActionStatus, default: ActionStatus.PENDING })
  @Index('idx_recycle_actions_status_created')
  status: ActionStatus;

  @Column({ name: 'points_awarded', type: 'int', nullable: true })
  pointsAwarded: number | null;

  @Column({ name: 'idempotency_key', unique: true })
  @Index('idx_recycle_actions_idempotency')
  idempotencyKey: string;

  // Frame metadata (stored as JSON)
  @Column({ name: 'frame_metadata', type: 'jsonb', nullable: true })
  frameMetadata: Array<{
    frameIndex: number;
    timestamp: number;
    confidence: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  }> | null;

  @Column({ name: 'frame_count_detected', type: 'int' })
  frameCountDetected: number;

  @Column({ name: 'motion_score', type: 'decimal', precision: 3, scale: 2 })
  motionScore: number;

  @Column({ name: 'bounding_box_area_ratio', type: 'decimal', precision: 3, scale: 2 })
  boundingBoxAreaRatio: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_recycle_actions_user_created')
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.recycleActions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => RecyclingPoint, (point) => point.recycleActions)
  @JoinColumn({ name: 'recycling_point_id' })
  recyclingPoint: RecyclingPoint;

  @OneToOne(() => Reward, (reward) => reward.action)
  reward: Reward;
}
