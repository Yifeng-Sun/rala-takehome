import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  clientId: process.env.KAFKA_CLIENT_ID || 'event-collaboration-api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'event-processors',
  topics: {
    eventMergeRequests: 'event-merge-requests',
    eventBatchProcessing: 'event-batch-processing',
    eventNotifications: 'event-notifications',
  },
}));
