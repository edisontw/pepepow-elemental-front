import './styles.css';
import { createSceneShell } from './rendering/scene';
import { FixedTickRunner } from './simulation/fixed-tick-runner';
import { M05Simulation } from './simulation/m05-simulation';
import type { EnemyDifficulty, EnemyFaction } from './simulation/m05-content';
import { DebugOverlay } from './ui/debug-overlay';
import { RoguelitePanel } from './ui/roguelite-panel';
import { StrategicPanel } from './ui/strategic-panel';
import { renderWorldDebug, worldDebugSummary } from './world/debug-view';
import { generateWorld } from './world/generator';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

function requestedBlockHeight(): number {
  const raw = new URLSearchParams(window.location.search).get('block');
  if (raw === null || raw.trim() === '') return 1_000_000;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 1_000_000;
}

function requestedFaction(): EnemyFaction | undefined {
  const raw = new URLSearchParams(window.location.search).get('faction')?.trim().toLowerCase();
  if (raw === 'iron' || raw === 'iron_legion') return 'IRON_LEGION';
  if (raw === 'flame' || raw === 'flame_cult') return 'FLAME_CULT';
  if (raw === 'wild' || raw === 'wild_horde') return 'WILD_HORDE';
  return undefined;
}

function requestedDifficulty(): EnemyDifficulty {
  const raw = new URLSearchParams(window.location.search).get('difficulty')?.trim().toLowerCase();
  if (raw === 'casual') return 'CASUAL';
  if (raw === 'hard') return 'HARD';
  return 'STANDARD';
}

try {
  const canvas = requiredElement<HTMLCanvasElement>('game-canvas');
  const bootScreen = requiredElement<HTMLElement>('boot-screen');
  const overlayElement = requiredElement<HTMLElement>('debug-overlay');
  const selectionBox = requiredElement<HTMLElement>('selection-box');
  const worldCanvas = requiredElement<HTMLCanvasElement>('world-debug-canvas');
  const worldSummary = requiredElement<HTMLElement>('world-debug-summary');
  const strategyElement = requiredElement<HTMLElement>('strategy-panel');
  const rogueliteElement = requiredElement<HTMLElement>('roguelite-panel');
  const generatedWorld = generateWorld(requestedBlockHeight());
  const simulation = new M05Simulation(generatedWorld, {
    faction: requestedFaction(),
    difficulty: requestedDifficulty(),
  });
  renderWorldDebug(worldCanvas, generatedWorld, simulation.strategy.snapshot());
  worldSummary.textContent = worldDebugSummary(generatedWorld);

  const scene = createSceneShell(canvas, simulation, selectionBox);
  const tickRunner = new FixedTickRunner(simulation);
  const overlay = new DebugOverlay(
    overlayElement,
    () => simulation.strategy.snapshot(),
    () => simulation.enemyWar.snapshot(),
  );
  const strategyPanel = new StrategicPanel(strategyElement, simulation, () => scene.selectedUnits);
  const roguelitePanel = new RoguelitePanel(rogueliteElement, simulation);
  let territoryDebugElapsed = 0;

  scene.app.on('update', (deltaSeconds: number) => {
    const frame = tickRunner.advance(deltaSeconds * 1000);
    scene.camera.update(deltaSeconds);
    scene.sync(frame);
    overlay.update(deltaSeconds, frame, scene.selectedUnits);
    strategyPanel.update(deltaSeconds);
    roguelitePanel.update(deltaSeconds);
    territoryDebugElapsed += deltaSeconds;
    if (territoryDebugElapsed >= 0.25) {
      territoryDebugElapsed = 0;
      renderWorldDebug(worldCanvas, generatedWorld, simulation.strategy.snapshot());
    }
  });

  requestAnimationFrame(() => bootScreen.classList.add('ready'));
  window.addEventListener('pagehide', () => {
    roguelitePanel.destroy();
    strategyPanel.destroy();
    scene.destroy();
  }, { once: true });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const fatal = requiredElement<HTMLElement>('fatal-error');
  fatal.hidden = false;
  fatal.textContent = `Elemental Front failed to boot.\n${message}`;
  console.error(error);
}
