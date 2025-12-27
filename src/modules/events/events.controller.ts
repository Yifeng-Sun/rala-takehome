import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, BatchCreateEventsDto } from './dto';
import { Event } from '../../entities/event.entity';

@Controller('events')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createEventDto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(createEventDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.eventsService.remove(id);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async batchCreate(
    @Body() batchCreateEventsDto: BatchCreateEventsDto,
  ): Promise<{ count: number; events: Event[] }> {
    const events = await this.eventsService.batchCreate(batchCreateEventsDto);
    return { count: events.length, events };
  }

  @Get('conflicts/:userId')
  async findConflicts(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findConflicts(userId);
  }

  @Post('merge-all/:userId')
  @HttpCode(HttpStatus.OK)
  async mergeAll(
    @Param('userId') userId: string,
  ): Promise<{ count: number; events: Event[] }> {
    const events = await this.eventsService.mergeAll(userId);
    return { count: events.length, events };
  }
}
