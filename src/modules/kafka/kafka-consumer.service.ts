import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaService, MergeEventMessage } from './kafka.service';
import { AiService } from '../ai/ai.service';
import { Event } from '../../entities/event.entity';
import { EachMessagePayload } from 'kafkajs';

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async onModuleInit() {
    // Register handler for merge events
    const mergeRequestsTopic =
      this.configService.get<string>('kafka.topics.eventMergeRequests') ||
      'event-merge-requests';

    this.kafkaService.registerMessageHandler(
      mergeRequestsTopic,
      this.handleMergeEvent.bind(this),
    );

    console.log('Kafka consumer handlers registered');
  }

  private async handleMergeEvent(payload: EachMessagePayload): Promise<void> {
    try {
      if (!payload.message.value) {
        console.error('Received null message value');
        return;
      }

      const message: MergeEventMessage = JSON.parse(
        payload.message.value.toString(),
      );

      console.log(
        `Processing merge event for user ${message.userId}, event ${message.eventId}`,
      );

      // Fetch the merged event
      const mergedEvent = await this.eventRepository.findOne({
        where: { id: message.eventId },
        relations: ['invitees'],
      });

      if (!mergedEvent) {
        console.error(`Merged event ${message.eventId} not found`);
        return;
      }

      // Fetch original events from mergedFrom field
      const originalEvents = await this.eventRepository.find({
        where: mergedEvent.mergedFrom.map((id) => ({ id })),
      });

      // Generate AI summary
      const summary = await this.aiService.generateMergeSummary(
        mergedEvent,
        originalEvents.length > 0 ? originalEvents : [mergedEvent],
      );

      // Update event with AI summary
      mergedEvent.aiSummary = summary;
      await this.eventRepository.save(mergedEvent);

      console.log(
        `AI summary generated for event ${message.eventId}: ${summary}`,
      );
    } catch (error) {
      console.error('Error processing merge event message:', error);
      // In production, you might want to send to a dead letter queue
    }
  }
}
