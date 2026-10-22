import { isLocalBaseUrl } from './anonymize.ts'

export type AiProviderKind = 'anthropic' | 'openai-compatible'

export type AiProviderInfo = {
  id: string
  name: string
  kind: AiProviderKind
  baseUrl: string
  /** Data never leaves the machine or the LAN: no key, no anonymization. */
  local: boolean
  /** One line, English only; the UI shows it as is. */
  description: string
  /** Suggestions for the model datalist, not a complete list: any id can be typed. */
  models: string[]
  keyUrl?: string
  docsUrl?: string
}

/**
 * docs/ARCHITECTURE.md §5.1: the provider catalog. Two adapters (kind) cover everything;
 * the rest is a base URL and a few suggested model ids, checked against the providers' docs
 * at release time and bound to go stale. The id is the stored value of ai.provider.
 */
export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    local: true,
    description: 'Free local models on your own computer.',
    models: ['qwen2.5:7b-instruct', 'llama3.1:8b', 'gemma3:4b', 'mistral:7b'],
    docsUrl: 'https://ollama.com',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:1234/v1',
    local: true,
    description: 'Local models with a desktop app and a built-in server.',
    models: ['qwen2.5-7b-instruct', 'llama-3.1-8b-instruct', 'gemma-3-4b-it'],
    docsUrl: 'https://lmstudio.ai',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    local: false,
    description: 'Claude models.',
    models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5', 'claude-fable-5-1'],
    keyUrl: 'https://platform.claude.com/settings/keys',
    docsUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    local: false,
    description: 'GPT models.',
    models: ['gpt-6-luna', 'gpt-6-astra', 'gpt-6.1-sol', 'gpt-5.6'],
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs/models',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    local: false,
    description: 'Gemini models through the OpenAI-compatible endpoint.',
    models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-4-argon'],
    keyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    local: false,
    description: 'European provider, Mistral models.',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    docsUrl: 'https://docs.mistral.ai/getting-started/models',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    local: false,
    description: 'DeepSeek models, low cost.',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com',
  },
  {
    id: 'xai',
    name: 'xAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    local: false,
    description: 'Grok models.',
    models: ['grok-4.7', 'grok-4.6', 'grok-4.5'],
    keyUrl: 'https://console.x.ai',
    docsUrl: 'https://docs.x.ai/docs/models',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    kind: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    local: false,
    description: 'Sonar models with web search built in.',
    models: ['sonar', 'sonar-pro', 'sonar-reasoning-pro'],
    keyUrl: 'https://www.perplexity.ai/settings/api',
    docsUrl: 'https://docs.perplexity.ai',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    local: false,
    description: 'One key for models from many providers.',
    models: [
      'anthropic/claude-sonnet-5.5',
      'openai/gpt-6-luna',
      'google/gemini-3.8-flash',
      'deepseek/deepseek-v4.1-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    keyUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/models',
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    local: false,
    description: 'Very fast inference of open models.',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ],
    keyUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs/models',
  },
  {
    id: 'together',
    name: 'Together AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    local: false,
    description: 'Hosted open models.',
    models: [
      'deepseek-ai/DeepSeek-V4.1-Flash',
      'moonshotai/Kimi-K3',
      'openai/gpt-oss-120b',
      'Qwen/Qwen3.5-9B',
    ],
    keyUrl: 'https://api.together.ai/settings/api-keys',
    docsUrl: 'https://docs.together.ai/docs/serverless-models',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    local: false,
    description: 'Hosted open models, fast.',
    models: [
      'accounts/fireworks/models/gpt-oss-120b',
      'accounts/fireworks/models/glm-5',
      'accounts/fireworks/models/deepseek-v3p2',
      'accounts/fireworks/models/kimi-k2-instruct',
    ],
    keyUrl: 'https://app.fireworks.ai/settings/users/api-keys',
    docsUrl: 'https://fireworks.ai/models',
  },
  {
    id: 'custom',
    name: 'Custom',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    local: false,
    description: 'Any OpenAI-compatible endpoint, your own URL.',
    models: [],
  },
]

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id) as [string, ...string[]]

/** Databases and demo stores from before 0.3.3 stored 'openai-compatible': that is custom. */
export const normalizeProviderId = (id: string) => (id === 'openai-compatible' ? 'custom' : id)

export const getProvider = (id: string): AiProviderInfo =>
  AI_PROVIDERS.find((p) => p.id === normalizeProviderId(id)) ?? AI_PROVIDERS.at(-1)!

/** Catalog flag; custom (and anything unknown) is local only if its host is. */
export function isLocalProvider(s: { provider: string; baseUrl: string }): boolean {
  const p = AI_PROVIDERS.find((p) => p.id === normalizeProviderId(s.provider))
  return p && p.id !== 'custom' ? p.local : isLocalBaseUrl(s.baseUrl)
}
