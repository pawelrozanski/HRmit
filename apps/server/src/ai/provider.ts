import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { getProvider, type AiSettings } from '@hrmit/shared'

/**
 * docs/ARCHITECTURE.md §5.1: one factory for the whole catalog. Every provider is one of two
 * kinds: Anthropic's own adapter or the OpenAI-compatible one (Ollama, LM Studio, OpenAI,
 * OpenRouter and friends). Takes the decrypted key as input and never stores it anywhere.
 */
export function createModel(s: AiSettings): LanguageModel {
  const apiKey = s.apiKey || undefined
  const p = getProvider(s.provider)
  const baseURL = s.baseUrl || p.baseUrl
  if (p.kind === 'anthropic') return createAnthropic({ apiKey, baseURL })(s.model)
  // Without this flag the adapter sends plain JSON mode and the zod schema never reaches the
  // model; Ollama, LM Studio and OpenAI all accept response_format json_schema.
  return createOpenAICompatible({
    name: p.id,
    baseURL,
    apiKey,
    supportsStructuredOutputs: true,
  }).chatModel(s.model)
}
