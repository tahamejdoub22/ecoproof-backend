import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditActionType {
  ACTION_SUBMITTED = 'ACTION_SUBMITTED',
  ACTION_VERIFIED = 'ACTION_VERIFIED',
  ACTION_REJECTED = 'ACTION_REJECTED',
  ACTION_FLAGGED = 'ACTION_FLAGGED',
  TRUST_SCORE_CHANGED = 'TRUST_SCORE_CHANGED',
  REWARD_AWARDED = 'REWARD_AWARDED',
  USER_LOGIN = 'USER_LOGIN',
  USER_REGISTERED = 'USER_REGISTERED',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'action_type', type: 'enum', enum: AuditActionType })
  @Index('idx_audit_logs_type_created')
  actionType: AuditActionType;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string | null;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_audit_logs_type_created')
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
