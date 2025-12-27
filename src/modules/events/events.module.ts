import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from '../../entities/event.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { KafkaModule } from '../kafka/kafka.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User, AuditLog]),
    forwardRef(() => KafkaModule),
    AiModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
