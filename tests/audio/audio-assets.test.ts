import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../data/audio/manifest.json';

type Entry = {
  id: string;
  kind: string;
  status: string;
  path: string;
  variants?: readonly string[];
  license?: string;
  sourceUrl?: string;
};

const entries = (manifest as { entries: readonly Entry[] }).entries;
const required = [
  'sfx.combat.attack',
  'sfx.combat.hit',
  'sfx.combat.death',
  'sfx.combat.structure-hit',
  'sfx.command.move',
  'sfx.movement.footstep',
  'voice.command.move',
  'voice.command.attack',
  'voice.command.ready',
] as const;

describe('CC0 production audio assets', () => {
  it('keeps the active combat, movement, command, and voice cues licensed and local', () => {
    for (const id of required) {
      const entry = entries.find((candidate) => candidate.id === id);
      expect(entry, id).toBeDefined();
      expect(entry!.status, id).toBe('FINAL');
      expect(entry!.license, id).toContain('CC0');
      expect(entry!.sourceUrl, id).toMatch(/^https:\/\/kenney\.nl\/assets\//);

      for (const path of [entry!.path, ...(entry!.variants ?? [])]) {
        expect(path, id).not.toContain('://');
        const bytes = readFileSync(join('public', path));
        expect(bytes.subarray(0, 4).toString('ascii'), path).toBe('OggS');
      }
    }
  });

  it('retains browser speech only as a non-final fallback', () => {
    const fallback = entries.find((entry) => entry.id === 'voice.command.acknowledge');
    expect(fallback?.status).toBe('PLACEHOLDER');
    expect(fallback?.path).toBe('browser://speech-synthesis/unit-command');
  });
});
