import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

export class BatchCreateEventsDto {
  @ApiProperty({
    description: 'Array of events to create in batch',
    type: [CreateEventDto],
    maxItems: 500,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventDto)
  @ArrayMaxSize(500, { message: 'Maximum 500 events allowed per batch' })
  events: CreateEventDto[];
}
