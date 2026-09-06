import type { M06Simulation } from '../simulation/m06-simulation';
import type { RunSnapshot, ScoreBreakdown } from '../simulation/run-state';

export const M06_REPLAY_STORAGE_KEY = 'pepepow:elemental-front:m06:last-replay';

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function healthPercent(current: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round((current * 100) / Math.max(1, max))));
}

function scoreRows(score: ScoreBreakdown): string {
  const rows: readonly [string, number][] = [
    ['Victory', score.victory],
    ['Time', score.time],
    ['Army survival', score.armySurvival],
    ['Territory', score.territory],
    ['Objectives', score.objectives],
    ['Resource efficiency', score.resourceEfficiency],
    ['Elemental style', score.elementalStyle],
  ];
  return rows.map(([label, value]) => `<span>${label}</span><b>${value.toLocaleString()}</b>`).join('');
}

export class RunPanel {
  private elapsed = 0;
  private lastSignature = '';
  private savedReplay = false;
  private readonly onClick = (event: Event): void => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('button[data-run-action]') : null;
    if (!target) return;
    const action = target.dataset.runAction;
    if (action === 'retry') this.navigate({ blockDelta: 0 });
    else if (action === 'next') this.navigate({ blockDelta: 1 });
    else if (action === 'replay') this.replayLast();
    else if (action === 'mode') this.navigate({ blockDelta: 0, toggleMode: true });
  };

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M06Simulation,
  ) {
    this.element.addEventListener('click', this.onClick);
    this.render(this.simulation.run.snapshot());
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.1) return;
    this.elapsed = 0;
    const run = this.simulation.run.snapshot();
    if (run.result && !this.savedReplay && !this.simulation.isReplayPlayback) {
      const packet = this.simulation.replayPacket();
      if (packet) {
        localStorage.setItem(M06_REPLAY_STORAGE_KEY, JSON.stringify(packet));
        this.savedReplay = true;
      }
    }
    const signature = [
      this.simulation.snapshot().tick,
      run.stateHash,
      this.simulation.snapshot().replayVerification,
      this.savedReplay ? 1 : 0,
    ].join(':');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.render(run);
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
  }

  private render(run: RunSnapshot): void {
    const simulation = this.simulation.snapshot();
    const elapsedSeconds = Math.floor(simulation.tick / 10);
    const playerCore = run.playerCore;
    const target = run.mode === 'DESTROY' ? run.enemyCore : run.boss;
    const targetLabel = run.mode === 'DESTROY' ? 'Enemy Core' : run.boss.label;
    const targetPercent = healthPercent(target.currentHealth, target.maxHealth);
    const playerPercent = healthPercent(playerCore.currentHealth, playerCore.maxHealth);
    const replayLine = this.simulation.isReplayPlayback
      ? `<div class="run-replay">REPLAY ${simulation.replayVerification}</div>`
      : '';

    if (run.result) {
      this.element.classList.add('complete');
      this.element.innerHTML = `
        <div class="run-title">M06 FULL RUN · ${run.mode.replace('_', ' ')}</div>
        ${replayLine}
        <div class="run-result ${run.result.outcome.toLowerCase()}">${run.result.outcome}</div>
        <div class="run-result-meta">${run.result.reason.replaceAll('_', ' ')} · ${formatTime(run.result.durationSeconds)}</div>
        <div class="run-score-total"><span>SCORE</span><b>${run.result.score.total.toLocaleString()}</b></div>
        <div class="run-score-grid">${scoreRows(run.result.score)}</div>
        <div class="run-actions">
          <button data-run-action="retry">Retry Block</button>
          <button data-run-action="next">Next Block</button>
          <button data-run-action="replay" ${this.hasStoredReplay() ? '' : 'disabled'}>Replay Last</button>
          <button data-run-action="mode">${run.mode === 'DESTROY' ? 'Boss Hunt' : 'Destroy'} Mode</button>
        </div>`;
      return;
    }

    this.element.classList.remove('complete');
    const critical = playerCore.state === 'CRITICAL'
      ? `<div class="run-critical">CORE CRITICAL · ${(playerCore.criticalTicksRemaining / 10).toFixed(1)}s · Move an Engineer to the Core</div>`
      : '';
    const objective = !run.finaleUnlocked
      ? (run.pace === 'SMOKE'
        ? 'Finale unlocks at 00:30 in smoke mode.'
        : 'Scout, expand, build and take Shrines. Finale unlocks at 27:00 or earlier with strategic momentum.')
      : run.mode === 'DESTROY'
        ? 'FINALE: move combat units into the enemy Core assault radius.'
        : `FINALE: defeat ${run.boss.label}. Its attacks alter the battlefield.`;
    this.element.innerHTML = `
      <div class="run-title">M06 FULL RUN · ${run.mode.replace('_', ' ')}</div>
      ${replayLine}
      <div class="run-meta">
        <b>${run.phase}</b><span>${formatTime(elapsedSeconds)}</span><span>Block ${this.simulation.generatedWorld.identity.blockHeight.toLocaleString()}</span>
      </div>
      ${critical}
      <div class="run-health-row"><span>Player Core</span><div><i style="width:${playerPercent}%"></i></div><b>${playerCore.currentHealth}/${playerCore.maxHealth}</b></div>
      <div class="run-health-row target"><span>${targetLabel}</span><div><i style="width:${targetPercent}%"></i></div><b>${target.currentHealth}/${target.maxHealth}</b></div>
      <div class="run-objective">${objective}</div>
      <div class="run-pressure">Assault P:${run.pressure.playerCoreAttackers} · E:${run.pressure.enemyCoreAttackers} · Boss:${run.pressure.bossAttackers} · Repair:${run.pressure.repairingEngineers}</div>
      <button class="run-mode-button" data-run-action="mode">Switch to ${run.mode === 'DESTROY' ? 'Boss Hunt' : 'Destroy'}</button>`;
  }

  private hasStoredReplay(): boolean {
    return localStorage.getItem(M06_REPLAY_STORAGE_KEY) !== null;
  }

  private navigate(options: { blockDelta: number; toggleMode?: boolean }): void {
    const url = new URL(window.location.href);
    const current = this.simulation.generatedWorld.identity.blockHeight;
    url.searchParams.set('block', String(current + options.blockDelta));
    url.searchParams.delete('replay');
    url.searchParams.set('pace', this.simulation.run.pace.toLowerCase());
    url.searchParams.set('faction', this.simulation.enemyWar.faction.toLowerCase());
    url.searchParams.set('difficulty', this.simulation.enemyWar.difficulty.toLowerCase());
    const mode = options.toggleMode
      ? (this.simulation.run.mode === 'DESTROY' ? 'boss' : 'destroy')
      : (this.simulation.run.mode === 'BOSS_HUNT' ? 'boss' : 'destroy');
    url.searchParams.set('mode', mode);
    window.location.assign(url);
  }

  private replayLast(): void {
    if (!this.hasStoredReplay()) return;
    const url = new URL(window.location.href);
    url.searchParams.set('replay', 'last');
    window.location.assign(url);
  }
}
