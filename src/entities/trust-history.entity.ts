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
import { RecycleAction } from './recycle-action.entity';

@Entity('trust_history')
export class TrustHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index('idx_trust_history_user_created')
  userId: string;

  @Column({ name: 'previous_score', type: 'decimal', precision: 3, scale: 2 })
  previousScore: number;

  @Column({ name: 'new_score', type: 'decimal', precision: 3, scale: 2 })
  newScore: number;

  @Column({ name: 'change_amount', type: 'decimal', precision: 3, scale: 2 })
  changeAmount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'action_id', nullable: true })
  actionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_trust_history_user_created')
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.trustHistory)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => RecycleAction, { nullable: true })
  @JoinColumn({ name: 'action_id' })
  action: RecycleAction | null;
}
