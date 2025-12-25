import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RecycleAction } from './recycle-action.entity';

export enum MaterialType {
  PLASTIC_BOTTLE = 'plastic_bottle',
  ALUMINUM_CAN = 'aluminum_can',
  GLASS_BOTTLE = 'glass_bottle',
  PAPER = 'paper',
  CARDBOARD = 'cardboard',
}

@Entity('recycling_points')
export class RecyclingPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  @Index()
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  @Index()
  longitude: number;

  @Column({ type: 'int' })
  radius: number; // in meters

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  altitude: number | null;

  @Column({
    type: 'simple-array',
    name: 'allowed_materials',
  })
  allowedMaterials: MaterialType[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  multiplier: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => RecycleAction, (action) => action.recyclingPoint)
  recycleActions: RecycleAction[];
}
