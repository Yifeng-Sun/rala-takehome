import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaService } from './kafka.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { AiModule } from '../ai/ai.module';
import { Event } from '../../entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), AiModule],
  providers: [KafkaService, KafkaConsumerService],
  exports: [KafkaService],
})
export class KafkaModule {}
