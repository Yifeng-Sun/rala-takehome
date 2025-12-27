import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Event, EventStatus } from '../../entities/event.entity';
import { User } from '../../entities/user.entity';
import { AuditLog, AuditAction } from '../../entities/audit-log.entity';
import { CreateEventDto, UpdateEventDto, BatchCreateEventsDto } from './dto';
import { KafkaService } from '../kafka/kafka.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => KafkaService))
    private readonly kafkaService: KafkaService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create({
      title: createEventDto.title,
      description: createEventDto.description,
      status: createEventDto.status,
      startTime: new Date(createEventDto.startTime),
      endTime: new Date(createEventDto.endTime),
    });

    if (createEventDto.inviteeIds && createEventDto.inviteeIds.length > 0) {
      const invitees = await this.userRepository.find({
        where: { id: In(createEventDto.inviteeIds) },
      });

      if (invitees.length !== createEventDto.inviteeIds.length) {
        throw new BadRequestException('One or more invitee IDs not found');
      }

      event.invitees = invitees;
    }

    const savedEvent = await this.eventRepository.save(event);

    // Log audit
    await this.auditLogRepository.save({
      userId: event.invitees?.[0]?.id || null,
      action: AuditAction.EVENT_CREATED,
      metadata: { newEventId: savedEvent.id },
      description: `Event created: ${savedEvent.title}`,
    });

    return savedEvent;
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['invitees'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);

    if (updateEventDto.title) event.title = updateEventDto.title;
    if (updateEventDto.description !== undefined)
      event.description = updateEventDto.description;
    if (updateEventDto.status) event.status = updateEventDto.status;
    if (updateEventDto.startTime)
      event.startTime = new Date(updateEventDto.startTime);
    if (updateEventDto.endTime)
      event.endTime = new Date(updateEventDto.endTime);

    if (updateEventDto.inviteeIds) {
      const invitees = await this.userRepository.find({
        where: { id: In(updateEventDto.inviteeIds) },
      });
      event.invitees = invitees;
    }

    const updatedEvent = await this.eventRepository.save(event);

    // Log audit
    await this.auditLogRepository.save({
      userId: event.invitees?.[0]?.id || null,
      action: AuditAction.EVENT_UPDATED,
      metadata: { eventId: id },
      description: `Event updated: ${updatedEvent.title}`,
    });

    return updatedEvent;
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);

    await this.eventRepository.remove(event);

    // Log audit
    await this.auditLogRepository.save({
      userId: event.invitees?.[0]?.id || null,
      action: AuditAction.EVENT_DELETED,
      metadata: { eventId: id },
      description: `Event deleted: ${event.title}`,
    });
  }

  async batchCreate(
    batchCreateEventsDto: BatchCreateEventsDto,
  ): Promise<Event[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const events: Event[] = [];

      // Prepare events for bulk insert
      for (const eventDto of batchCreateEventsDto.events) {
        const event = this.eventRepository.create({
          title: eventDto.title,
          description: eventDto.description,
          status: eventDto.status,
          startTime: new Date(eventDto.startTime),
          endTime: new Date(eventDto.endTime),
        });

        if (eventDto.inviteeIds && eventDto.inviteeIds.length > 0) {
          const invitees = await queryRunner.manager.find(User, {
            where: { id: In(eventDto.inviteeIds) },
          });
          event.invitees = invitees;
        }

        events.push(event);
      }

      // Bulk insert using QueryBuilder for better performance
      const savedEvents = await queryRunner.manager.save(Event, events);

      // Log audit
      await queryRunner.manager.save(AuditLog, {
        action: AuditAction.BATCH_INSERT,
        metadata: {
          batchSize: savedEvents.length,
          eventIds: savedEvents.map((e) => e.id),
        },
        description: `Batch created ${savedEvents.length} events`,
      });

      await queryRunner.commitTransaction();
      return savedEvents;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findConflicts(userId: string): Promise<Event[]> {
    // Get all events for the user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['events'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const events = user.events.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    const conflicts: Event[] = [];

    // Find overlapping events
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];

        // Check if events overlap
        if (this.doEventsOverlap(event1, event2)) {
          if (!conflicts.find((e) => e.id === event1.id)) {
            conflicts.push(event1);
          }
          if (!conflicts.find((e) => e.id === event2.id)) {
            conflicts.push(event2);
          }
        }
      }
    }

    return conflicts;
  }

  private doEventsOverlap(event1: Event, event2: Event): boolean {
    return (
      event1.startTime < event2.endTime && event2.startTime < event1.endTime
    );
  }

  async mergeAll(userId: string): Promise<Event[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['events'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Sort events by start time
    const events = user.events.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    if (events.length === 0) {
      return [];
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const mergedEvents: Event[] = [];
      const mergeGroups: Event[][] = [];

      // Interval merging algorithm (similar to LeetCode #56)
      let currentGroup: Event[] = [events[0]];

      for (let i = 1; i < events.length; i++) {
        const lastInGroup = currentGroup[currentGroup.length - 1];
        const current = events[i];

        if (this.doEventsOverlap(lastInGroup, current)) {
          // Overlapping - add to current group
          currentGroup.push(current);
        } else {
          // No overlap - start new group
          if (currentGroup.length > 1) {
            mergeGroups.push(currentGroup);
          }
          currentGroup = [current];
        }
      }

      // Don't forget the last group
      if (currentGroup.length > 1) {
        mergeGroups.push(currentGroup);
      }

      // Create merged events
      for (const group of mergeGroups) {
        const mergedEvent = await this.mergeEventGroup(group, queryRunner);
        mergedEvents.push(mergedEvent);

        // Delete old events
        await queryRunner.manager.remove(Event, group);

        // Log audit
        await queryRunner.manager.save(AuditLog, {
          userId,
          action: AuditAction.EVENTS_MERGED,
          metadata: {
            oldEventIds: group.map((e) => e.id),
            newEventId: mergedEvent.id,
            mergeCount: group.length,
          },
          description: `Merged ${group.length} events into one`,
        });
      }

      await queryRunner.commitTransaction();

      // Send Kafka messages for AI summarization (after commit)
      for (const mergedEvent of mergedEvents) {
        try {
          await this.kafkaService.sendMergeEvent({
            eventId: mergedEvent.id,
            userId,
            mergedEventIds: mergedEvent.mergedFrom || [],
            mergedData: {
              title: mergedEvent.title,
              startTime: mergedEvent.startTime.toISOString(),
              endTime: mergedEvent.endTime.toISOString(),
            },
            timestamp: new Date().toISOString(),
          });
        } catch (kafkaError) {
          console.error('Failed to send Kafka message:', kafkaError);
          // Don't fail the merge if Kafka fails
        }
      }

      return mergedEvents;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async mergeEventGroup(
    events: Event[],
    queryRunner: any,
  ): Promise<Event> {
    // Find the earliest start time and latest end time
    const startTime = new Date(
      Math.min(...events.map((e) => e.startTime.getTime())),
    );
    const endTime = new Date(
      Math.max(...events.map((e) => e.endTime.getTime())),
    );

    // Concatenate titles
    const title = events.map((e) => e.title).join(' + ');

    // Combine descriptions
    const description = events
      .filter((e) => e.description)
      .map((e) => e.description)
      .join('\n\n');

    // Keep the latest status (last event in the sorted array)
    const status = events[events.length - 1].status;

    // Combine all invitees (union)
    const inviteeMap = new Map<string, User>();
    for (const event of events) {
      for (const invitee of event.invitees) {
        inviteeMap.set(invitee.id, invitee);
      }
    }
    const invitees = Array.from(inviteeMap.values());

    // Create merged event
    const mergedEvent = this.eventRepository.create({
      title,
      description,
      status,
      startTime,
      endTime,
      invitees,
      mergedFrom: events.map((e) => e.id),
    });

    return await queryRunner.manager.save(Event, mergedEvent);
  }
}
