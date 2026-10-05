import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';

describe('SHIWA core contracts', () => {
  it('keeps exact drawer order', async () => {
    const source = await fs.readFile('src/main.tsx', 'utf8');
    const labels = [
      'AI Chat',
      'AI VIP',
      'Convert To Link',
      'Command Console',
      'Content Studio',
      'Image Generator',
      'Powerful Browser',
      'Deep Username Search',
      'Safe Publishing',
      'Settings',
    ];

    let lastIndex = -1;
    for (const label of labels) {
      const index = source.indexOf(`'${label}'`);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('has no client-side provider secret', async () => {
    const source = await fs.readFile('src/main.tsx', 'utf8');
    expect(source).not.toMatch(/KIMI_API_KEY|GEMINI_API_KEY|COMPOSIO_API_KEY/);
  });
});
