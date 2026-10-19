import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { AiSettings } from '@hrmit/shared'

/**
 * docs/ARCHITECTURE.md §5.1: one factory for the whole provider matrix. Ollama, LM Studio,
 * OpenRouter and friends share the OpenAI-compatible adapter; Anthropic gets its own.
 * Takes the decrypted key as input and never stores it anywhere.
 */
export function createModel(s: AiSettings): LanguageModel {
  const apiKey = s.apiKey || undefined
  if (s.provider === 'anthropic') return createAnthropic({ apiKey, baseURL: s.baseUrl })(s.model)
  return createOpenAICompatible({ name: s.provider, baseURL: s.baseUrl, apiKey }).chatModel(s.model)
}
