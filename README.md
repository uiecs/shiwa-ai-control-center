# SHIWA AI CONTROL CENTER
Premium AI-powered Instagram creator control application with real provider integrations.

## Architecture

- React + Vite client
- Express API boundary
- Kimi/Moonshot primary AI provider
- Gemini image generation and fallback content generation
- Composio link-based Instagram authorization
- Browser runtime honesty with explicit platform restrictions
- Server-side secrets only

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

## Required secrets

- `KIMI_API_KEY` for AI Chat and Content Studio
- `COMPOSIO_API_KEY` and `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` for official Instagram Connect Link flows
- `GEMINI_API_KEY` and optional `GEMINI_IMAGE_MODEL` for image generation
- `SESSION_SECRET` (32+ characters) for secure production sessions

## Production note

The app intentionally does not include a production backdoor. Authentication must be provided by the hosting environment or a trusted identity layer.
