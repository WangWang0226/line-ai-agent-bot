import { describe, expect, it } from 'vitest';
import { wasBotMentioned, stripBotMention } from '../src/line/mention';

describe('mention detection', () => {
  it('returns true when the bot is mentioned', () => {
    const event = {
      mention: {
        mentionees: [{ isSelf: true, displayName: 'Jarvis' }],
      },
    };

    expect(wasBotMentioned(event)).toBe(true);
  });

  it('returns false when another user is mentioned', () => {
    const event = {
      mention: {
        mentionees: [{ isSelf: false, displayName: 'Alice' }],
      },
    };

    expect(wasBotMentioned(event)).toBe(false);
  });

  it('returns false when no mention is present', () => {
    expect(wasBotMentioned({})).toBe(false);
  });

  it('returns true when multiple mentions include the bot', () => {
    const event = {
      mention: {
        mentionees: [{ isSelf: false, displayName: 'Bob' }, { isSelf: true, displayName: 'Jarvis' }],
      },
    };

    expect(wasBotMentioned(event)).toBe(true);
  });

  it('strips the bot mention from the message text', () => {
    const event = {
      mention: {
        mentionees: [{ isSelf: true, displayName: 'Jarvis' }],
      },
    };

    expect(stripBotMention('@Jarvis hello there', event)).toBe('hello there');
  });
});
