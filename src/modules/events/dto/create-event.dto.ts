import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { EventStatus } from '../../../entities/event.entity';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventStatus)
  @IsNotEmpty()
  status: EventStatus;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  inviteeIds?: string[];
}
