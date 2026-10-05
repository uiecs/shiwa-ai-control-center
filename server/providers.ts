export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface AIProvider {
  readonly name: string;
  chat(messages: ChatMessage[], opts?: { stream?: boolean }): Promise<Response>;
}

class OpenAICompatibleProvider implements AIProvider {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async chat(messages: ChatMessage[], opts: { stream?: boolean } = { stream: true }): Promise<Response> {
    if (!this.apiKey) {
      throw new Error(`${this.name} API key is not configured`);
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: opts.stream ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error(`${this.name} API error (${response.status})`);
    }

    return response;
  }
}

export class KimiProvider extends OpenAICompatibleProvider {
  constructor() {
    super('Kimi', process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1', process.env.KIMI_API_KEY || '', process.env.AI_MODEL || 'kimi-k2.5');
  }
}

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super('OpenRouter', process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY || '', process.env.OPENROUTER_MODEL || process.env.AI_MODEL || '');
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super('OpenAI-compatible', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY || '', process.env.OPENAI_MODEL || process.env.AI_MODEL || '');
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = 'Gemini';
  private readonly key = process.env.GEMINI_API_KEY || '';
  private readonly model = process.env.USERNAME_SEARCH_MODEL || 'gemini-2.5-flash';

  async chat(messages: ChatMessage[], opts: { stream?: boolean } = { stream: false }): Promise<Response> {
    if (!this.key) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemMessage = messages.find((message) => message.role === 'system');
    const payload = {
      contents: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      generationConfig: {
        responseMimeType: opts.stream ? 'text/plain' : 'application/json',
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status})`);
    }

    return response;
  }
}

export function providerFor(feature: 'chat' | 'vip' | 'content' | 'username'): AIProvider {
  const configured = feature === 'username'
    ? (process.env.USERNAME_SEARCH_PROVIDER || 'gemini')
    : (process.env.AI_PROVIDER || 'kimi');

  if (configured === 'gemini') return new GeminiProvider();
  if (configured === 'openrouter') return new OpenRouterProvider();
  if (configured === 'openai-compatible') return new OpenAIProvider();
  return new KimiProvider();
}
