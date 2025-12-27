import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum EventStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

@Entity('events')
@Index(['startTime', 'endTime'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.TODO,
  })
  status: EventStatus;

  @Column({ type: 'timestamp', name: 'start_time' })
  @Index()
  startTime: Date;

  @Column({ type: 'timestamp', name: 'end_time' })
  @Index()
  endTime: Date;

  @ManyToMany(() => User, (user) => user.events, {
    cascade: true,
    eager: true,
  })
  @JoinTable({
    name: 'event_invitees',
    joinColumn: { name: 'event_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  invitees: User[];

  @Column({ type: 'jsonb', nullable: true, name: 'merged_from' })
  mergedFrom: string[];

  @Column({ type: 'text', nullable: true, name: 'ai_summary' })
  aiSummary: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
