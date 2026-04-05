import Anthropic from '@anthropic-ai/sdk';

// Singleton client — reused across API route invocations
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
