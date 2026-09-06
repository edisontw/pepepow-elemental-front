import './styles.css';
import { createSceneShell } from './rendering/scene';
import { FixedTickRunner } from './simulation/fixed-tick-runner';
import { Simulation } from './simulation/simulation';
import { DebugOverlay } from './ui/debug-overlay';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

try {
  const canvas = requiredElement<HTMLCanvasElement>('game-canvas');
  const bootScreen = requiredElement<HTMLElement>('boot-screen');
  const overlayElement = requiredElement<HTMLElement>('debug-overlay');
  const selectionBox = requiredElement<HTMLElement>('selection-box');
  const simulation = new Simulation('pepepow:rules-v0:m01-arena');
  const scene = createSceneShell(canvas, simulation, selectionBox);
  const tickRunner = new FixedTickRunner(simulation);
  const overlay = new DebugOverlay(overlayElement);

  scene.app.on('update', (deltaSeconds: number) => {
    const frame = tickRunner.advance(deltaSeconds * 1000);
    scene.camera.update(deltaSeconds);
    scene.sync(frame);
    overlay.update(deltaSeconds, frame, scene.selectedCount);
  });

  requestAnimationFrame(() => bootScreen.classList.add('ready'));
  window.addEventListener('pagehide', () => scene.destroy(), { once: true });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const fatal = requiredElement<HTMLElement>('fatal-error');
  fatal.hidden = false;
  fatal.textContent = `Elemental Front failed to boot.\n${message}`;
  console.error(error);
}
