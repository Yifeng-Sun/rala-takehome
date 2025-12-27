import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1024,
}));
