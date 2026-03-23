// Tests for the homepage messaging source of truth.

import { describe, it, expect } from 'vitest';
import { MESSAGES, getMessage } from '../messaging';
import type { SceneMessageKey, SceneMessage } from '../messaging';

describe('MESSAGES', () => {
  const ALL_KEYS: SceneMessageKey[] = [
    'hero',
    'recognition',
    'scope',
    'authoring',
    'team',
    'trust',
    'cta',
  ];

  it('contains an entry for every SceneMessageKey', () => {
    for (const key of ALL_KEYS) {
      expect(MESSAGES[key]).toBeDefined();
    }
  });

  it('every entry has a non-empty headline', () => {
    for (const key of ALL_KEYS) {
      const msg = MESSAGES[key];
      expect(msg.headline).toBeTruthy();
      expect(typeof msg.headline).toBe('string');
      expect(msg.headline.length).toBeGreaterThan(0);
    }
  });

  it('hero has eyebrow, support, and proofRail', () => {
    const hero = MESSAGES.hero;
    expect(hero.eyebrow).toBeTruthy();
    expect(hero.support).toBeTruthy();
    expect(hero.proofRail).toBeDefined();
    expect(hero.proofRail!.length).toBeGreaterThan(0);
  });

  it('recognition has a punchline', () => {
    expect(MESSAGES.recognition.punchline).toBeTruthy();
  });

  it('cta headline is the npm create command', () => {
    expect(MESSAGES.cta.headline).toBe('npm create brewsite');
  });

  it('no message contains bare "slides-only" framing', () => {
    for (const key of ALL_KEYS) {
      const msg: SceneMessage = MESSAGES[key];
      const allText = [msg.eyebrow, msg.headline, msg.support, msg.punchline]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      expect(allText).not.toContain('slides-only');
      expect(allText).not.toContain('slide tool');
    }
  });
});

describe('getMessage', () => {
  it('returns the same object as MESSAGES[key]', () => {
    expect(getMessage('hero')).toBe(MESSAGES.hero);
    expect(getMessage('cta')).toBe(MESSAGES.cta);
  });
});
