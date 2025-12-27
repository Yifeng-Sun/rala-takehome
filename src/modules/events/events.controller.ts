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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, BatchCreateEventsDto } from './dto';
import { Event } from '../../entities/event.entity';

@ApiTags('events')
@Controller('events')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({
    status: 201,
    description: 'Event successfully created',
    type: Event,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async create(@Body() createEventDto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(createEventDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Event found',
    type: Event,
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({
    status: 200,
    description: 'Event successfully updated',
    type: Event,
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete event by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 204, description: 'Event successfully deleted' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.eventsService.remove(id);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple events in batch' })
  @ApiResponse({
    status: 201,
    description: 'Events successfully created',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  async batchCreate(
    @Body() batchCreateEventsDto: BatchCreateEventsDto,
  ): Promise<{ count: number; events: Event[] }> {
    const events = await this.eventsService.batchCreate(batchCreateEventsDto);
    return { count: events.length, events };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all events for a specific user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of all events for the user, sorted by start time',
    type: [Event],
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByUserId(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findByUserId(userId);
  }

  @Get('conflicts/:userId')
  @ApiOperation({ summary: 'Find scheduling conflicts for a user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of conflicting events',
    type: [Event],
  })
  async findConflicts(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findConflicts(userId);
  }

  @Post('merge-all/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-powered merge of all conflicting events for a user',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Events successfully merged using AI',
  })
  async mergeAll(
    @Param('userId') userId: string,
  ): Promise<{ count: number; events: Event[] }> {
    const events = await this.eventsService.mergeAll(userId);
    return { count: events.length, events };
  }
}
