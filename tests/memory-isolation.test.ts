import { describe, expect, it } from 'vitest';
import { searchMemory } from '../src/tools/memory/searchMemory';
import { saveMemory } from '../src/tools/memory/saveMemory';

describe('memory isolation', () => {
  it('keeps memory queries scoped to the current group', async () => {
    await saveMemory('group-a', 'user-a', {
      content: 'The group decided to visit Montreal on December 20.',
      category: 'plan',
    });
    await saveMemory('group-b', 'user-b', {
      content: 'The group decided to visit Quebec City on December 21.',
      category: 'plan',
    });

    const memoriesA = await searchMemory('group-a', { query: 'Montreal trip', limit: 5 });
    const memoriesB = await searchMemory('group-b', { query: 'Montreal trip', limit: 5 });

    expect(memoriesA).toHaveLength(1);
    expect(memoriesB).toHaveLength(1);
    expect(memoriesA[0].content).toContain('Montreal');
    expect(memoriesB[0].content).not.toContain('Montreal');
    expect(memoriesA[0].id).not.toBe(memoriesB[0].id);
  });
});
