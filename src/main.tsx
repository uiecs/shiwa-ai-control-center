import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import {
  Menu,
  X,
  Bell,
  ChevronRight,
  Sparkles,
  Link2,
  Command,
  PenLine,
  Image as ImageIcon,
  Globe2,
  Search,
  ShieldCheck,
  Settings as SettingsIcon,
  Send,
  Copy,
  Trash2,
  RefreshCw,
  ExternalLink,
  Download,
  Save,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  AlertTriangle,
  LockKeyhole,
} from 'lucide-react';
import './styles.css';
import type { Section, Message, RuntimeStatus } from './types';

const nav: { label: Section; icon: React.ReactNode; badge?: string }[] = [
  { label: 'AI Chat', icon: <Sparkles /> },
  { label: 'AI VIP', icon: <Bell />, badge: 'VIP' },
  { label: 'Convert To Link', icon: <Link2 /> },
  { label: 'Command Console', icon: <Command /> },
  { label: 'Content Studio', icon: <PenLine /> },
  { label: 'Image Generator', icon: <ImageIcon /> },
  { label: 'Powerful Browser', icon: <Globe2 /> },
  { label: 'Deep Username Search', icon: <Search /> },
  { label: 'Safe Publishing', icon: <ShieldCheck /> },
  { label: 'Settings', icon: <SettingsIcon /> },
];

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

function App() {
  const [section, setSection] = useState<Section>('AI Chat');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { id: crypto.randomUUID(), role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: nextMessages.map((message) => ({ role: message.role, content: message.content })) }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'AI service unavailable');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming unavailable');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      const assistantId = crypto.randomUUID();
      setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? { ...message, content: fullText } : message)),
        );
      }

      try {
        const parsed = JSON.parse(fullText);
        if (parsed?.content) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: parsed.content, actions: parsed.actions }
                : message,
            ),
          );
        }
      } catch {
        // stream may be plain text; keep current content.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setError('');
  };

  const connectInstagram = async () => {
    try {
      const data = await api('/api/instagram/connect', { method: 'POST', body: JSON.stringify({}) });
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Instagram connector did not return a redirect URL');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Instagram connection failed');
    }
  };

  const renderFeature = () => {
    if (section === 'AI Chat') {
      return (
        <Chat
          messages={messages}
          input={input}
          setInput={setInput}
          send={send}
          busy={busy}
          error={error}
          clear={clearMessages}
          connect={connectInstagram}
        />
      );
    }
    if (section === 'AI VIP') {
      return <FeaturePanel section={section} setSection={setSection} error={error} setError={setError} />;
    }
    if (section === 'Convert To Link') {
      return <Browser section={section} />;
    }
    if (section === 'Command Console') {
      return <Console />;
    }
    if (section === 'Content Studio') {
      return <ContentStudio />;
    }
    if (section === 'Image Generator') {
      return <ImageGenerator />;
    }
    if (section === 'Powerful Browser') {
      return <Browser section={section} />;
    }
    if (section === 'Deep Username Search') {
      return <UsernameSearch />;
    }
    if (section === 'Safe Publishing') {
      return <Simple title={section} text="Publisher-safety controls and review gating remain server-side. No unaudited external publication occurs." />;
    }
    if (section === 'Settings') {
      return <Simple title={section} text="Server-side provider configuration, browser runtime behavior, and secure session controls live behind the API boundary." />;
    }
    return <Simple title={section} text="Production-ready workspace shell with the same SHIWA visual system." />;
  };

  return (
    <div className="app-shell">
      <div className="ambient a1" />
      <div className="ambient a2" />

      <header className="topbar">
        <button className="icon-btn" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
          <Menu size={18} />
        </button>

        <div className="brand-mini">
          <div className="logo">S</div>
          <div>
            <strong>SHIWA</strong>
            <small>AI CONTROL CENTER</small>
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-btn" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="avatar">S</div>
        </div>
      </header>

      {drawerOpen && <div className="scrim" onClick={() => setDrawerOpen(false)} />}

      {drawerOpen && (
        <aside className="drawer" aria-label="Navigation drawer">
          <div className="drawer-head">
            <div className="brand">
              <div className="logo big">S</div>
              <div>
                <div className="wordmark">SHIWA</div>
                <div className="sub">AI CONTROL CENTER</div>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <div className="creator-pill">
            <Sparkles size={14} />
            CREATOR DASHBOARD
          </div>

          <nav>
            {nav.map((item) => (
              <button
                key={item.label}
                className={`nav-item ${section === item.label ? 'active' : ''}`}
                onClick={() => {
                  setSection(item.label);
                  setDrawerOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge ? <span className="vip-badge">{item.badge}</span> : null}
                <ChevronRight className="chev" size={14} />
              </button>
            ))}
          </nav>

          <div className="drawer-footer">
            <div className="secure">
              <span />
              Workspace secure
            </div>
            <div className="email">workspace user</div>
            <button className="signout" type="button">
              <RotateCw size={15} />
              Sign out
            </button>
          </div>
        </aside>
      )}

      <main className="workspace">{renderFeature()}</main>
    </div>
  );
}

function Chat({
  messages,
  input,
  setInput,
  send,
  busy,
  error,
  clear,
  connect,
}: {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  send: () => void;
  busy: boolean;
  error: string;
  clear: () => void;
  connect: () => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const renderMarkdown = (content: string) => ({ __html: marked.parse(content || '', { breaks: true }) as string });

  return (
    <div className="chat-page">
      <div className="section-head">
        <div>
          <div className="eyebrow">AI CREATOR ASSISTANT</div>
          <h1>SHIWA AI Chat</h1>
        </div>
        <button className="ghost-btn" onClick={clear} type="button">
          <Trash2 size={15} />
          Clear
        </button>
      </div>

      <div className="chat-card">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Sparkles size={28} />
              </div>
              <h2>Ready when you are.</h2>
              <p>Ask for captions, growth strategy, content plans, or connect your Instagram account securely.</p>
              <div className="suggestions">
                <button type="button" onClick={() => setInput('Create a luxury black and gold Instagram product caption.')}>Create a caption</button>
                <button type="button" onClick={() => setInput('لطفا لینک پنجره پاپ آپ ابزار واسط اتصال دهنده دسترسی اینستاگرام اینجا برام بفرست')}>
                  Connect Instagram
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-mark">{message.role === 'assistant' ? 'S' : 'YOU'}</div>
                <div className="message-body">
                  {message.role === 'assistant' ? (
                    <div className="prose" dangerouslySetInnerHTML={renderMarkdown(message.content)} />
                  ) : (
                    <div>{message.content}</div>
                  )}

                  {message.actions?.map((action) => (
                    <button
                      key={`${message.id}-${action.url}`}
                      type="button"
                      className="connect-card"
                      onClick={() => window.open(action.url, '_blank', 'noopener,noreferrer')}
                    >
                      <span>🔗</span>
                      <div>
                        <strong>{action.label}</strong>
                        <small>Connect your Instagram Business/Creator account securely.</small>
                      </div>
                      <ExternalLink size={16} />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          {busy && (
            <div className="typing" aria-live="polite">
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <div className="composer">
          <textarea
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Message SHIWA AI..."
          />
          <button className="send" type="button" onClick={send} disabled={busy || !input.trim()} aria-label="Send message">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturePanel({ section, setSection, error, setError }: { section: Section; setSection: (section: Section) => void; error: string; setError: (value: string) => void }) {
  const common = {
    title: section,
    text:
      section === 'AI VIP'
        ? 'Premium creator strategy, campaign planning, and cross-channel growth insights grounded in real provider availability.'
        : 'Production-ready workspace shell with the same SHIWA visual system.',
  };

  if (section === 'AI VIP') {
    return (
      <div className="feature">
        <div className="section-head">
          <div>
            <div className="eyebrow">PREMIUM CREATOR WORKSPACE</div>
            <h1>{common.title}</h1>
          </div>
        </div>

        <div className="feature-card">
          <div className="logo big">S</div>
          <div>
            <strong>AI VIP</strong>
            <span>{common.text}</span>
          </div>
        </div>

        <button className="primary" type="button" onClick={() => setSection('AI Chat')}>
          Open creator chat
        </button>
      </div>
    );
  }

  return (
    <Simple title={section} text={common.text} action="Open workspace" onAction={() => setSection('AI Chat')} />
  );
}

function Simple({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">SHIWA WORKSPACE</div>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="feature-card">
        <div className="logo big">S</div>
        <div>
          <strong>{title}</strong>
          <span>{text}</span>
        </div>
      </div>

      {action && (
        <button className="primary" type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (count = 1) => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, count }),
      });
      setImages(data.images || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image generation unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">GEMINI IMAGE GENERATION</div>
          <h1>Image Generator</h1>
        </div>
      </div>

      <div className="form-card">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the image you want to generate..." />
        <div className="row">
          <button className="primary" type="button" disabled={busy || !prompt.trim()} onClick={() => run(1)}>
            {busy ? 'GENERATING…' : 'GENERATE'}
          </button>
          <button className="ghost-btn" type="button" disabled={busy || !prompt.trim()} onClick={() => run(2)}>
            GENERATE 2 IMAGES
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {images.length > 0 && (
        <div className="gallery">
          {images.map((src, index) => (
            <div className="image-tile" key={`${src}-${index}`}>
              <img src={src} alt={`Generated content ${index + 1}`} />
              <a href={src} target="_blank" rel="noreferrer" aria-label="Download generated image">
                <Download size={16} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsernameSearch() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/username-search', {
        method: 'POST',
        body: JSON.stringify({ username: input.trim() }),
      });
      setResult(data || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">PUBLIC DATA ONLY</div>
          <h1>Deep Username Search</h1>
        </div>
      </div>

      <div className="form-card">
        <div className="input-row">
          <Search size={16} />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="instagram username" />
        </div>
        <button className="primary" type="button" disabled={busy || !input.trim()} onClick={run}>
          {busy ? 'SEARCHING…' : 'SEARCH USERNAME'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {result && <pre className="result">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function Browser({ section }: { section: Section }) {
  const initialUrl = section === 'Convert To Link' ? 'https://uploadsimage.org/' : 'https://dashboard.composio.dev/bahmanabdollahi2022_workspace/~/bench/c/arc_WBhtBMZp86rQ';
  const [url, setUrl] = useState(initialUrl);
  const [current, setCurrent] = useState(initialUrl);
  const [status, setStatus] = useState<RuntimeStatus>('LIMITED');
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [index, setIndex] = useState(0);

  const navigate = () => {
    try {
      const nextUrl = new URL(url);
      if (!['http:', 'https:'].includes(nextUrl.protocol)) {
        throw new Error('Protocol not allowed');
      }
      setCurrent(nextUrl.toString());
      setHistory((previous) => [...previous.slice(0, index + 1), nextUrl.toString()]);
      setIndex((previous) => previous + 1);
      setStatus('LIMITED');
    } catch {
      setStatus('BLOCKED_BY_DESTINATION_POLICY');
    }
  };

  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">BROWSER RUNTIME ADAPTER</div>
          <h1>{section}</h1>
        </div>
      </div>

      <div className="browser-card">
        <div className="browser-controls">
          <button type="button" onClick={() => index > 0 && (setIndex(index - 1), setCurrent(history[index - 1]))} disabled={index === 0} aria-label="Back">
            <ArrowLeft size={15} />
          </button>
          <button type="button" onClick={() => index < history.length - 1 && (setIndex(index + 1), setCurrent(history[index + 1]))} disabled={index >= history.length - 1} aria-label="Forward">
            <ArrowRight size={15} />
          </button>
          <button type="button" onClick={() => setCurrent(current)} aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
          <input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && navigate()} />
        </div>

        <div className="runtime">
          <span className={`status-dot ${status.toLowerCase()}`} />
          <span>{status}</span>
        </div>

        <div className="browser-stage">
          <div>
            <Globe2 size={42} />
            <strong>Browser Runtime Required</strong>
            <p>The web runtime does not claim unrestricted in-app browsing. Native WebView or a legitimate remote browser can provide restricted destination access while respecting platform security policies.</p>
            <a href={current} target="_blank" rel="noreferrer">
              Open exact URL externally
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Console() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);

  const run = () => {
    const allowed = ['status', 'help', 'clear'];
    if (input === 'clear') {
      setOutput([]);
      setInput('');
      return;
    }
    if (!allowed.includes(input)) {
      setOutput((current) => [...current, 'Command rejected: only allowlisted application commands are available.']);
      setInput('');
      return;
    }

    setOutput((current) => [
      ...current,
      input === 'status' ? 'SHIWA application boundary: ONLINE (external providers require secrets).' : 'Available: status, help, clear',
    ]);
    setInput('');
  };

  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">SANDBOXED</div>
          <h1>Command Console</h1>
        </div>
      </div>

      <div className="console">
        <div>
          {output.map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>

        <div className="console-input">
          <span>&gt;</span>
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && run()} placeholder="help" />
        </div>
      </div>
    </div>
  );
}

function ContentStudio() {
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState('Caption');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const data = await api('/api/content', {
        method: 'POST',
        body: JSON.stringify({ topic, type: kind }),
      });
      setResult(data.content || '');
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Generation unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="feature">
      <div className="section-head">
        <div>
          <div className="eyebrow">KIMI • CONTENT STUDIO</div>
          <h1>Content Studio</h1>
        </div>
      </div>

      <div className="form-card">
        <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic / product / campaign" />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {['Caption', 'Reel Script', 'Story', 'Carousel', 'CTA', 'Hashtags', 'Product Description', 'Promotional Copy'].map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button className="primary" type="button" disabled={busy || !topic.trim()} onClick={run}>
          {busy ? 'GENERATING…' : 'GENERATE'}
        </button>
      </div>

      {result && <pre className="result">{result}</pre>}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
