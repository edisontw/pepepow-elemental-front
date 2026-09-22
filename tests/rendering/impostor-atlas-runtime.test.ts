import { afterEach, expect, it, vi } from 'vitest';
import type * as pc from 'playcanvas';
import { VisualAssetLibrary } from '../../src/rendering/visual-asset-library';

const textures = vi.hoisted(() => [] as Array<{ destroy: ReturnType<typeof vi.fn>; setSource: ReturnType<typeof vi.fn> }>);
vi.mock('playcanvas', async (importOriginal) => {
  const actual = await importOriginal<typeof pc>();
  return { ...actual, Texture: class {
    destroy = vi.fn(); setSource = vi.fn();
    constructor() { textures.push(this); }
  } };
});
class FakeImage {
  static pending: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() { FakeImage.pending.push(this); }
}
const config = { id: 'unit.vanguard', label: 'Vanguard', slug: 'vanguard', width: 1.27, height: 1.9, shadowX: .92, shadowZ: .68 };
type Materials = Record<'IDLE' | 'MOVE' | 'ATTACK' | 'HIT' | 'DEATH', pc.StandardMaterial[]>;
function harness() {
  vi.stubGlobal('Image', FakeImage);
  const app = { graphicsDevice: {}, on: vi.fn(), off: vi.fn() };
  const library = new VisualAssetLibrary(app as unknown as pc.Application);
  const loader = library as unknown as {
    loadImpostorMaterials: (c: typeof config) => Promise<Materials | null>;
    impostorResources: Map<string, { requestAction: (a: string) => void }>;
  };
  return { app, library, loader };
}
afterEach(() => { vi.unstubAllGlobals(); FakeImage.pending = []; textures.length = 0; vi.restoreAllMocks(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

it('uses one shared PlayCanvas update dispatcher for animated impostors', () => {
  const { app, library } = harness();
  expect(app.on).toHaveBeenCalledTimes(1);
  expect(app.on).toHaveBeenCalledWith('update', expect.any(Function));
  library.destroy();
  expect(app.off).toHaveBeenCalledTimes(1);
  expect(app.off).toHaveBeenCalledWith('update', expect.any(Function));
});

it('deduplicates concurrent loads, requests actions on demand, and shares one texture across 32 UV materials', async () => {
  const { library, loader } = harness();
  const first = loader.loadImpostorMaterials(config);
  const second = loader.loadImpostorMaterials(config);
  expect(first).toBe(second);
  expect(FakeImage.pending).toHaveLength(1);
  expect(FakeImage.pending[0]!.src).toContain('/idle.webp');
  FakeImage.pending[0]!.onload!();
  const materials = (await first)!;
  expect(textures).toHaveLength(1);
  expect(new Set(materials.IDLE.map(m => m.emissiveMap)).size).toBe(1);
  expect(materials.MOVE).toBe(materials.IDLE);
  const resources = loader.impostorResources.get(config.id)!;
  resources.requestAction('MOVE'); resources.requestAction('MOVE');
  expect(FakeImage.pending).toHaveLength(2);
  FakeImage.pending[1]!.onload!();
  await flush();
  expect(materials.MOVE).not.toBe(materials.IDLE);
  expect(textures).toHaveLength(2);
  const destroy = vi.spyOn(materials.MOVE[0]!, 'destroy');
  library.destroy();
  expect(destroy).toHaveBeenCalledTimes(1);
  for (const texture of textures) expect(texture.destroy).toHaveBeenCalledTimes(1);
});

it('retains Idle on a failed action without retry storms, and ignores late loads after disposal', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { library, loader } = harness();
  const first = loader.loadImpostorMaterials(config);
  FakeImage.pending[0]!.onload!();
  const materials = (await first)!;
  const resources = loader.impostorResources.get(config.id)!;
  resources.requestAction('ATTACK');
  FakeImage.pending[1]!.onerror!();
  await flush();
  resources.requestAction('ATTACK');
  expect(FakeImage.pending).toHaveLength(2);
  expect(materials.ATTACK).toBe(materials.IDLE);
  resources.requestAction('DEATH');
  library.destroy();
  FakeImage.pending[2]!.onload!();
  await flush();
  expect(textures).toHaveLength(1);
  expect(textures[0]!.destroy).toHaveBeenCalledTimes(1);
});
