import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '../../../entities/event.entity';

export class CreateEventDto {
  @ApiProperty({
    description: 'Event title',
    example: 'Team Meeting',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Event description',
    example: 'Quarterly planning meeting with the development team',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Event status',
    enum: EventStatus,
    example: EventStatus.TODO,
  })
  @IsEnum(EventStatus)
  @IsNotEmpty()
  status: EventStatus;

  @ApiProperty({
    description: 'Event start time (ISO 8601 format)',
    example: '2025-01-15T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'Event end time (ISO 8601 format)',
    example: '2025-01-15T11:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({
    description: 'Array of user IDs to invite to the event',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  inviteeIds?: string[];
}
