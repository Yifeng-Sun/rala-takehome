import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';

export interface MergeEventMessage {
  eventId: string;
  userId: string;
  mergedEventIds: string[];
  mergedData: {
    title: string;
    startTime: string;
    endTime: string;
  };
  timestamp: string;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private messageHandlers: Map<
    string,
    (payload: EachMessagePayload) => Promise<void>
  > = new Map();

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId:
        this.configService.get<string>('kafka.clientId') ||
        'event-collaboration-api',
      brokers:
        this.configService.get<string[]>('kafka.brokers') || [
          'localhost:9092',
        ],
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId:
        this.configService.get<string>('kafka.consumerGroup') ||
        'event-processors',
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      console.log('Kafka producer connected');

      await this.consumer.connect();
      console.log('Kafka consumer connected');

      // Subscribe to topics
      const topics = this.configService.get('kafka.topics');
      await this.consumer.subscribe({
        topics: Object.values(topics),
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const handler = this.messageHandlers.get(payload.topic);
          if (handler) {
            await handler(payload);
          }
        },
      });

      console.log('Kafka consumer started');
    } catch (error) {
      console.error('Failed to initialize Kafka:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      console.log('Kafka connections closed');
    } catch (error) {
      console.error('Error disconnecting Kafka:', error);
    }
  }

  async sendMergeEvent(message: MergeEventMessage): Promise<void> {
    const topic =
      this.configService.get<string>('kafka.topics.eventMergeRequests') ||
      'event-merge-requests';

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.userId,
            value: JSON.stringify(message),
            partition: this.getPartition(message.userId),
          },
        ],
      });
      console.log(`Sent merge event message for user ${message.userId}`);
    } catch (error) {
      console.error('Failed to send merge event message:', error);
      throw error;
    }
  }

  async sendBatchProcessing(data: {
    batchId: string;
    eventCount: number;
  }): Promise<void> {
    const topic =
      this.configService.get<string>('kafka.topics.eventBatchProcessing') ||
      'event-batch-processing';

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: data.batchId,
            value: JSON.stringify(data),
          },
        ],
      });
      console.log(`Sent batch processing message: ${data.batchId}`);
    } catch (error) {
      console.error('Failed to send batch processing message:', error);
      throw error;
    }
  }

  registerMessageHandler(
    topic: string,
    handler: (payload: EachMessagePayload) => Promise<void>,
  ): void {
    this.messageHandlers.set(topic, handler);
    console.log(`Registered handler for topic: ${topic}`);
  }

  private getPartition(userId: string): number {
    // Simple hash-based partitioning for ordered processing per user
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 3; // Assuming 3 partitions
  }
}
