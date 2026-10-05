import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { providerFor, GeminiProvider } from './providers.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 90, standardHeaders: true, legacyHeaders: false }));

const secret = process.env.SESSION_SECRET || '';
if (process.env.NODE_ENV === 'production' && secret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production');
}

const cookieName = 'shiwa_session';

type Session = { uid: string; exp: number };

function sign(value: string) {
  return crypto.createHmac('sha256', secret || 'dev-only-secret').update(value).digest('base64url');
}

function setSession(res: express.Response, uid: string) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 86_060_1000 })).toString('base64url');
  res.cookie(cookieName, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86_060_1000,
    path: '/',
  });
}

function getSession(req: express.Request): Session | null {
  const raw = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.split('=')[1];

  if (!raw) return null;

  const [payload, signature] = raw.split('.');
  const expected = sign(payload || '');
  if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const session = getSession(req);
  if (session) {
    (req as any).userId = session.uid;
  }
  next();
});

function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const uid = (req as any).userId as string | undefined;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.post('/api/auth/dev-session', (req, res) => {
  if (process.env.NODE_ENV === 'production' || !process.env.DEV_AUTH_SECRET) {
    return res.status(404).json({ error: 'Development authentication is disabled' });
  }

  const parsed = z.object({ secret: z.string(), userId: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success || parsed.data.secret !== process.env.DEV_AUTH_SECRET) {
    return res.status(401).json({ error: 'Invalid development credentials' });
  }

  setSession(res, parsed.data.userId);
  return res.json({ ok: true });
});

const connectPhrase = /پنجره پاپ آپ|اتصال دهنده|اتصال.اینستاگرام|connect.instagram|instagram.connect|authorization.instagram/i;

async function kimi(messages: any[], stream = true) {
  return providerFor('chat').chat(messages, { stream });
}

async function composioLink(uid: string, state?: string) {
  if (!process.env.COMPOSIO_API_KEY || !process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) {
    throw new Error('Composio Instagram auth configuration is not configured');
  }

  const payload: Record<string, string> = {
    auth_config_id: process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID,
    user_id: uid,
    alias: 'shiwa-instagram',
  };
  if (state) payload.state = state;

  const response = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/link', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Composio error (${response.status})`);
  }

  return data;
}

app.post('/api/chat', requireUser, async (req, res) => {
  const parsed = z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().max(10000) }).passthrough()).max(50),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid chat payload' });
  }

  const lastMessage = parsed.data.messages.at(-1)?.content || '';

  try {
    if (connectPhrase.test(lastMessage)) {
      const userId = (req as any).userId as string;
      const state = crypto.randomBytes(18).toString('hex');
      const link = await composioLink(userId, state);
      const payload = JSON.stringify({
        content: '🔗 CONNECT INSTAGRAM\nYour Instagram Business/Creator account can be connected securely through the official authorization flow.',
        actions: [{ type: 'connectInstagram', label: 'CONNECT INSTAGRAM', url: link.redirect_url }],
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(payload);
    }

    const systemMessage = {
      role: 'system',
      content: 'You are SHIWA AI Creator Assistant. Use Kimi as the primary model. Help with Instagram strategy, captions, growth, content workflow, and legitimate account workflows. Never request passwords, bypass security, or claim actions that were not executed.',
    };

    const response = await kimi([systemMessage, ...parsed.data.messages], true);
    if (!response.body) {
      throw new Error('No Kimi stream');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) {
            res.write(chunk);
          }
        } catch {
          // ignore malformed chunk frames
        }
      }
    }

    return res.end();
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'AI service unavailable' });
  }
});

app.post('/api/instagram/connect', requireUser, async (req, res) => {
  try {
    const state = crypto.randomBytes(18).toString('hex');
    const link = await composioLink((req as any).userId, state);
    return res.json({ url: link.redirect_url, expiresAt: link.expires_at, connectedAccountId: link.connected_account_id, state });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Instagram connector unavailable' });
  }
});

app.get('/api/instagram/status', requireUser, async (req, res) => {
  if (!process.env.COMPOSIO_API_KEY || !process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) {
    return res.status(503).json({ status: 'REQUIRES_SECRETS' });
  }

  const userId = encodeURIComponent((req as any).userId);
  const authConfigId = encodeURIComponent(process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID);

  try {
    const response = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${userId}&auth_config_ids=${authConfigId}`, {
      headers: { 'x-api-key': process.env.COMPOSIO_API_KEY },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error('Composio status failed');
    }
    return res.json({ status: data?.connected_accounts?.length ? 'CONNECTED' : 'NOT_CONNECTED', data });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Status unavailable' });
  }
});

app.delete('/api/instagram/disconnect', requireUser, async (req, res) => {
  if (!process.env.COMPOSIO_API_KEY) {
    return res.status(503).json({ status: 'REQUIRES_SECRETS' });
  }

  try {
    const response = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/disconnect', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.COMPOSIO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: (req as any).userId, auth_config_id: process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error?.message || `Disconnect failed (${response.status})`);
    }
    return res.json({ ok: true, status: 'DISCONNECTED' });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Disconnect unavailable' });
  }
});

app.post('/api/images/generate', requireUser, async (req, res) => {
  const parsed = z.object({ prompt: z.string().min(1).max(4000), count: z.number().int().min(1).max(2) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid image request' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const generated: string[] = [];

    for (let i = 0; i < parsed.data.count; i += 1) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: parsed.data.prompt,
          response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '1:1', image_size: '1K' },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || `Gemini error (${response.status})`);
      }
      if (!data.output_image?.data) {
        throw new Error('Gemini returned no image');
      }
      generated.push(`data:${data.output_image.mime_type || 'image/png'};base64,${data.output_image.data}`);
    }

    return res.json({ images: generated, model });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Image generation unavailable' });
  }
});

app.post('/api/content', requireUser, async (req, res) => {
  const parsed = z.object({ topic: z.string().min(1).max(2000), type: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid content request' });
  }

  try {
    let response: Response;
    let providerName = 'kimi';

    try {
      response = await providerFor('content').chat([
        { role: 'system', content: 'You are SHIWA Content Studio. Generate useful Instagram content only.' },
        { role: 'user', content: `Create a ${parsed.data.type} for: ${parsed.data.topic}. Include a clear CTA where appropriate and keep hashtags relevant.` },
      ], { stream: false });
    } catch (firstError) {
      try {
        response = await new GeminiProvider().chat([
          { role: 'system', content: 'You are SHIWA Content Studio fallback writer. Generate useful Instagram content only.' },
          { role: 'user', content: `Create a ${parsed.data.type} for: ${parsed.data.topic}.` },
        ], { stream: false });
        providerName = 'gemini';
      } catch {
        throw firstError;
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
    return res.json({ content, provider: providerName });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Content generation unavailable' });
  }
});

app.post('/api/username-search', requireUser, async (req, res) => {
  const parsed = z.object({ username: z.string().min(1).max(30) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.KIMI_API_KEY) {
    return res.status(503).json({ error: 'No username-search provider is configured' });
  }

  return res.status(501).json({
    error: 'Public username retrieval adapter requires a legitimate Instagram/public-data source; no fabricated results are returned.',
    status: 'REQUIRES_SECRETS',
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'shiwa-ai-control-center' });
});

const clientDir = path.resolve(__dirname, '../dist/client');
app.use(express.static(clientDir));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`SHIWA AI CONTROL CENTER listening on :${port}`);
});
