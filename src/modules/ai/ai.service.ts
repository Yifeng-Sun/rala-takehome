import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Event } from '../../entities/event.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AiService {
  private chatModel: ChatAnthropic;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('ai.anthropicApiKey');
    const model = this.configService.get<string>('ai.model');

    if (apiKey && apiKey !== 'sk-ant-api03-placeholder') {
      this.chatModel = new ChatAnthropic({
        apiKey,
        model,
        temperature: 0.3,
      });
    }
  }

  async generateMergeSummary(
    mergedEvent: Event,
    originalEvents: Event[],
  ): Promise<string> {
    // Generate cache key
    const cacheKey = `ai-summary:${mergedEvent.id}`;

    // Check cache first
    const cachedSummary = await this.cacheManager.get<string>(cacheKey);
    if (cachedSummary) {
      return cachedSummary;
    }

    // If no API key or placeholder, use mock service
    if (
      !this.chatModel ||
      !this.configService.get<string>('ai.anthropicApiKey') ||
      this.configService.get<string>('ai.anthropicApiKey') ===
        'sk-ant-api03-placeholder'
    ) {
      const mockSummary = this.generateMockSummary(
        mergedEvent,
        originalEvents,
      );
      await this.cacheManager.set(cacheKey, mockSummary, 3600000); // 1 hour
      return mockSummary;
    }

    try {
      const summary = await this.generateRealSummary(
        mergedEvent,
        originalEvents,
      );
      await this.cacheManager.set(cacheKey, summary, 3600000); // 1 hour
      return summary;
    } catch (error) {
      console.error('AI summary generation failed, using mock:', error);
      const mockSummary = this.generateMockSummary(
        mergedEvent,
        originalEvents,
      );
      await this.cacheManager.set(cacheKey, mockSummary, 3600000); // 1 hour
      return mockSummary;
    }
  }

  private async generateRealSummary(
    mergedEvent: Event,
    originalEvents: Event[],
  ): Promise<string> {
    const eventDetails = originalEvents
      .map(
        (e, i) =>
          `Event ${i + 1}: "${e.title}" (${e.startTime.toISOString()} - ${e.endTime.toISOString()})`,
      )
      .join('\n');

    const messages = [
      new SystemMessage(
        'You are an AI assistant that creates concise, one-line summaries of merged calendar events. Be brief and informative.',
      ),
      new HumanMessage(
        `Generate a one-line summary for merged events:\n\n${eventDetails}\n\nMerged into: "${mergedEvent.title}" (${mergedEvent.startTime.toISOString()} - ${mergedEvent.endTime.toISOString()})\n\nProvide a single, concise sentence summarizing the merge.`,
      ),
    ];

    const response = await this.chatModel.invoke(messages);
    return response.content.toString().trim();
  }

  private generateMockSummary(
    mergedEvent: Event,
    originalEvents: Event[],
  ): string {
    const titles = originalEvents.map((e) => e.title.split(' ')[0]).join(', ');
    return `Merged ${originalEvents.length} overlapping events: ${titles}.`;
  }

  async generateBatchSummary(events: Event[]): Promise<string> {
    const cacheKey = `ai-batch-summary:${events.length}:${Date.now()}`;

    try {
      if (
        !this.chatModel ||
        !this.configService.get<string>('ai.anthropicApiKey') ||
        this.configService.get<string>('ai.anthropicApiKey') ===
          'sk-ant-api03-placeholder'
      ) {
        return `Successfully batch created ${events.length} events.`;
      }

      const messages = [
        new SystemMessage(
          'You are an AI assistant that creates brief summaries of batch operations.',
        ),
        new HumanMessage(
          `Summarize this batch creation of ${events.length} events in one sentence.`,
        ),
      ];

      const response = await this.chatModel.invoke(messages);
      const summary = response.content.toString().trim();
      await this.cacheManager.set(cacheKey, summary, 3600000);
      return summary;
    } catch (error) {
      console.error('AI batch summary generation failed:', error);
      return `Successfully batch created ${events.length} events.`;
    }
  }
}
