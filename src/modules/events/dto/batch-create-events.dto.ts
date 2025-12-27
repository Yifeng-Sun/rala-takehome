import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEventDto } from './create-event.dto';

export class BatchCreateEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventDto)
  @ArrayMaxSize(500, { message: 'Maximum 500 events allowed per batch' })
  events: CreateEventDto[];
}
