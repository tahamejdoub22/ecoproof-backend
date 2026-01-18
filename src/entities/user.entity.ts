import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { RecycleAction } from "./recycle-action.entity";
import { TrustHistory } from "./trust-history.entity";
import { Reward } from "./reward.entity";

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ name: "password_hash" })
  passwordHash: string;

  @Column({
    name: "trust_score",
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0.7,
  })
  @Index()
  trustScore: number;

  @Column({ name: "streak_days", type: "int", default: 0 })
  streakDays: number;

  @Column({ name: "last_action_at", type: "timestamp", nullable: true })
  lastActionAt: Date | null;

  @Column({ name: "device_fingerprint", nullable: true })
  deviceFingerprint: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @OneToMany(() => RecycleAction, (action) => action.user)
  recycleActions: RecycleAction[];

  @OneToMany(() => TrustHistory, (history) => history.user)
  trustHistory: TrustHistory[];

  @OneToMany(() => Reward, (reward) => reward.user)
  rewards: Reward[];
}
