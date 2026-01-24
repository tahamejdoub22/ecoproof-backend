import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { RecycleAction } from "./recycle-action.entity";

@Entity("rewards")
export class Reward {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  @Index("idx_rewards_user_created")
  userId: string;

  @Column({ name: "action_id", unique: true })
  actionId: string;

  @Column({ name: "base_points", type: "int" })
  basePoints: number;

  @Column({
    name: "location_multiplier",
    type: "decimal",
    precision: 3,
    scale: 2,
  })
  locationMultiplier: number;

  @Column({
    name: "streak_multiplier",
    type: "decimal",
    precision: 3,
    scale: 2,
  })
  streakMultiplier: number;

  @Column({ name: "trust_multiplier", type: "decimal", precision: 3, scale: 2 })
  trustMultiplier: number;

  @Column({ name: "final_points", type: "int" })
  finalPoints: number;

  @CreateDateColumn({ name: "created_at" })
  @Index("idx_rewards_user_created")
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.rewards)
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToOne(() => RecycleAction, (action) => action.reward)
  @JoinColumn({ name: "action_id" })
  action: RecycleAction;
}
