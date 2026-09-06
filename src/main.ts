import './styles.css';
import './m06.css';
import {
  assertBlockChallengeWorldMatches,
  readBlockChallengeShareRequest,
} from './challenge/block-challenge';
import {
  ManualBlockSource,
  manualBlockHeightFromSearch,
} from './challenge/block-source';
import { createSceneShell } from './rendering/scene';
import { FixedTickRunner } from './simulation/fixed-tick-runner';
import type { EnemyDifficulty, EnemyFaction } from './simulation/m05-content';
import {
  M06Simulation,
  isM06ReplayPacket,
  type M06ReplayPacket,
} from './simulation/m06-simulation';
import type { RunMode, RunPace } from './simulation/m06-content';
import { DebugOverlay } from './ui/debug-overlay';
import { RoguelitePanel } from './ui/roguelite-panel';
import { M06_REPLAY_STORAGE_KEY, RunPanel } from './ui/run-panel';
import { StrategicPanel } from './ui/strategic-panel';
import { renderWorldDebug, worldDebugSummary } from './world/debug-view';
import { generateWorld } from './world/generator';
import { M02_STANDARD_RULES } from './world/world-definition';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
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

function requestedMode(): RunMode {
  const raw = new URLSearchParams(window.location.search).get('mode')?.trim().toLowerCase();
  return raw === 'boss' || raw === 'boss_hunt' ? 'BOSS_HUNT' : 'DESTROY';
}

function requestedPace(): RunPace {
  const raw = new URLSearchParams(window.location.search).get('pace')?.trim().toLowerCase();
  return raw === 'smoke' ? 'SMOKE' : 'STANDARD';
}

function requestedReplay(): M06ReplayPacket | null {
  const replayId = new URLSearchParams(window.location.search).get('replay')?.trim().toLowerCase();
  if (replayId !== 'last') return null;
  const stored = localStorage.getItem(M06_REPLAY_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isM06ReplayPacket(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  try {
    const canvas = requiredElement<HTMLCanvasElement>('game-canvas');
    const bootScreen = requiredElement<HTMLElement>('boot-screen');
    const overlayElement = requiredElement<HTMLElement>('debug-overlay');
    const selectionBox = requiredElement<HTMLElement>('selection-box');
    const worldCanvas = requiredElement<HTMLCanvasElement>('world-debug-canvas');
    const worldSummary = requiredElement<HTMLElement>('world-debug-summary');
    const strategyElement = requiredElement<HTMLElement>('strategy-panel');
    const rogueliteElement = requiredElement<HTMLElement>('roguelite-panel');
    const runElement = requiredElement<HTMLElement>('run-panel');
    const replay = requestedReplay();
    const sharedChallenge = replay ? null : readBlockChallengeShareRequest(window.location.search);

    if (sharedChallenge && sharedChallenge.rulesetVersion !== M02_STANDARD_RULES.rulesetVersion) {
      throw new Error(`Unsupported challenge ruleset: ${sharedChallenge.rulesetVersion}.`);
    }

    const manualBlockHeight = replay?.header.blockHeight
      ?? sharedChallenge?.blockHeight
      ?? manualBlockHeightFromSearch(window.location.search);
    const blockResolution = await new ManualBlockSource(manualBlockHeight).resolve();
    const generatedWorld = generateWorld(blockResolution.blockHeight);
    if (sharedChallenge) assertBlockChallengeWorldMatches(sharedChallenge, generatedWorld);

    const simulation = new M06Simulation(generatedWorld, {
      faction: replay?.header.faction ?? sharedChallenge?.faction ?? requestedFaction(),
      difficulty: replay?.header.difficulty ?? sharedChallenge?.difficulty ?? requestedDifficulty(),
      mode: replay?.header.mode ?? sharedChallenge?.mode ?? requestedMode(),
      pace: replay?.header.pace ?? sharedChallenge?.pace ?? requestedPace(),
    });
    if (replay) simulation.loadReplay(replay);

    const initialMinimapSnapshot = simulation.snapshot();
    renderWorldDebug(worldCanvas, generatedWorld, simulation.strategy.snapshot(), {
      entities: initialMinimapSnapshot.entities,
      playerCore: initialMinimapSnapshot.run.playerCore,
      enemyCore: initialMinimapSnapshot.run.enemyCore,
      boss: initialMinimapSnapshot.run.boss,
      surface: simulation.terrain.surface,
      burningCells: initialMinimapSnapshot.burningCells,
    });
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
    const runPanel = new RunPanel(runElement, simulation);
    let territoryDebugElapsed = 0;

    scene.app.on('update', (deltaSeconds: number) => {
      const frame = tickRunner.advance(deltaSeconds * 1000);
      scene.camera.update(deltaSeconds);
      scene.sync(frame);
      overlay.update(deltaSeconds, frame, scene.selectedUnits);
      strategyPanel.update(deltaSeconds);
      roguelitePanel.update(deltaSeconds);
      runPanel.update(deltaSeconds);
      territoryDebugElapsed += deltaSeconds;
      if (territoryDebugElapsed >= 0.25) {
        territoryDebugElapsed = 0;
        const minimapSnapshot = simulation.snapshot();
        renderWorldDebug(worldCanvas, generatedWorld, simulation.strategy.snapshot(), {
          entities: minimapSnapshot.entities,
          playerCore: minimapSnapshot.run.playerCore,
          enemyCore: minimapSnapshot.run.enemyCore,
          boss: minimapSnapshot.run.boss,
          surface: simulation.terrain.surface,
          burningCells: minimapSnapshot.burningCells,
        });
      }
    });

    requestAnimationFrame(() => bootScreen.classList.add('ready'));
    window.addEventListener('pagehide', () => {
      runPanel.destroy();
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
}

void boot();
