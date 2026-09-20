import {
  blockChallengeCode,
  createBlockChallengeIdentity,
  createBlockChallengeShareUrl,
  type BlockChallengeIdentity,
} from '../challenge/block-challenge';
import type { BlockResolution } from '../challenge/block-source';
import {
  LocalVerifiedLeaderboard,
  type LeaderboardEntry,
} from '../challenge/leaderboard';
import { OFFICIAL_CHALLENGES } from '../challenge/official-challenge';
import { createChallengeScoreSubmission } from '../challenge/score-proof';
import type { M06Simulation } from '../simulation/m06-simulation';
import type { RunSnapshot, ScoreBreakdown } from '../simulation/run-state';

export const M06_REPLAY_STORAGE_KEY = 'pepepow:elemental-front:m06:last-replay';

const FEATURED_OFFICIAL_CHALLENGE = OFFICIAL_CHALLENGES.entries[0] ?? null;

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
  private shareStatus: 'IDLE' | 'COPIED' | 'FAILED' = 'IDLE';
  private proofStatus: 'IDLE' | 'VERIFYING' | 'VERIFIED' | 'REJECTED' = 'IDLE';
  private proofMessage = '';
  private leaderboardEntries: readonly LeaderboardEntry[] = [];
  private readonly leaderboard: LocalVerifiedLeaderboard;
  private readonly sideMeta: HTMLElement | null;
  private readonly onClick = (event: Event): void => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('button[data-run-action]') : null;
    if (!target) return;
    const action = target.dataset.runAction;
    if (action === 'retry') this.navigate({ blockDelta: 0 });
    else if (action === 'next') this.navigate({ blockDelta: 1 });
    else if (action === 'replay') this.replayLast();
    else if (action === 'mode') this.navigate({ blockDelta: 0, toggleMode: true });
    else if (action === 'share') void this.copyChallengeLink();
    else if (action === 'verify-score') void this.verifyAndStoreScore();
    else if (action === 'official' && FEATURED_OFFICIAL_CHALLENGE) this.navigateOfficial(FEATURED_OFFICIAL_CHALLENGE.id);
    else if (action === 'pepepow-now') this.navigatePepepow(0);
    else if (action === 'pepepow-10') this.navigatePepepow(10);
    else if (action === 'pepepow-100') this.navigatePepepow(100);
  };

  constructor(
    private readonly element: HTMLElement,
    private readonly simulation: M06Simulation,
    private readonly blockResolution: BlockResolution,
  ) {
    this.leaderboard = new LocalVerifiedLeaderboard(localStorage);
    const worldPanel = document.getElementById('world-debug');
    if (worldPanel) {
      const sideMeta = document.createElement('div');
      sideMeta.className = 'run-side-meta';
      worldPanel.appendChild(sideMeta);
      this.sideMeta = sideMeta;
    } else {
      this.sideMeta = null;
    }
    this.element.addEventListener('click', this.onClick);
    this.render(this.simulation.run.snapshot());
    void this.refreshLeaderboard();
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
    const simulation = this.simulation.snapshot();
    const signature = [
      simulation.tick,
      run.stateHash,
      simulation.replayVerification,
      this.savedReplay ? 1 : 0,
      this.shareStatus,
      this.proofStatus,
      this.proofMessage,
      this.leaderboardEntries.map((entry) => `${entry.score}:${entry.finalTick}:${entry.finalStateHash}`).join(','),
    ].join(':');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.render(run);
  }

  destroy(): void {
    this.element.removeEventListener('click', this.onClick);
    this.sideMeta?.remove();
  }

  private render(run: RunSnapshot): void {
    const simulation = this.simulation.snapshot();
    const identity = this.challengeIdentity(run);
    const challengeCode = blockChallengeCode(identity);
    const sourceLabel = this.simulation.isReplayPlayback ? 'Replay Packet' : this.blockResolution.label;
    const sourceDetail = this.blockResolution.source === 'PEPEPOW_RPC' && this.blockResolution.networkTipHeight !== undefined
      ? ` · Tip ${this.blockResolution.networkTipHeight.toLocaleString()}`
      : this.blockResolution.source === 'OFFICIAL' && this.blockResolution.officialChallengeId
        ? ` · ${this.blockResolution.officialChallengeId}`
        : this.blockResolution.fallbackReason
          ? ' · RPC unavailable → manual fallback'
          : '';
    const challengeMeta = `Block ${identity.blockHeight.toLocaleString()} · Rules ${identity.rulesetVersion} · ${challengeCode}`;
    const sourceMeta = `${sourceLabel}${sourceDetail}`;
    const shareLabel = this.shareStatus === 'COPIED'
      ? 'Link Copied'
      : this.shareStatus === 'FAILED'
        ? 'Copy Failed'
        : 'Share Challenge';
    const verifyLabel = this.proofStatus === 'VERIFYING'
      ? 'Verifying Replay…'
      : this.proofStatus === 'VERIFIED'
        ? 'Score Verified'
        : 'Verify Score';
    const officialButton = FEATURED_OFFICIAL_CHALLENGE
      ? `<button data-run-action="official">${FEATURED_OFFICIAL_CHALLENGE.label}</button>`
      : '';
    const elapsedSeconds = Math.floor(simulation.tick / 10);
    const playerCore = run.playerCore;
    const target = run.mode === 'DESTROY' ? run.enemyCore : run.boss;
    const targetPercent = healthPercent(target.currentHealth, target.maxHealth);
    const playerPercent = healthPercent(playerCore.currentHealth, playerCore.maxHealth);
    const replayLine = this.simulation.isReplayPlayback
      ? `<div class="run-replay">REPLAY ${simulation.replayVerification}</div>`
      : '';

    if (run.result) {
      if (this.sideMeta) this.sideMeta.hidden = true;
      this.element.classList.add('complete');
      this.element.innerHTML = `
        <div class="run-title">PEPEPOW BLOCK CHALLENGE · ${run.mode.replace('_', ' ')}</div>
        ${replayLine}
        <div class="run-challenge">${challengeMeta}</div>
        <div class="run-source">${sourceMeta}</div>
        <div class="run-result ${run.result.outcome.toLowerCase()}">${run.result.outcome}</div>
        <div class="run-result-meta">${run.result.reason.replaceAll('_', ' ')} · ${formatTime(run.result.durationSeconds)}</div>
        <div class="run-score-total"><span>SCORE · ${challengeCode}</span><b>${run.result.score.total.toLocaleString()}</b></div>
        <div class="run-score-grid">${scoreRows(run.result.score)}</div>
        ${this.proofMessage ? `<div class="run-proof ${this.proofStatus.toLowerCase()}">${this.proofMessage}</div>` : ''}
        ${this.leaderboardMarkup()}
        <div class="run-actions">
          <button data-run-action="retry">Retry Block</button>
          <button data-run-action="next">Next Block</button>
          <button data-run-action="share">${shareLabel}</button>
          <button data-run-action="verify-score" ${this.simulation.isReplayPlayback || this.proofStatus === 'VERIFYING' ? 'disabled' : ''}>${verifyLabel}</button>
          <button data-run-action="replay" ${this.hasStoredReplay() ? '' : 'disabled'}>Replay Last</button>
          <button data-run-action="mode">Change Mode</button>
          ${officialButton}
        </div>
        <div class="run-live-actions">
          <span>PEPEPOW Network</span>
          <button data-run-action="pepepow-now">Current</button>
          <button data-run-action="pepepow-10">Recent -10</button>
          <button data-run-action="pepepow-100">Recent -100</button>
        </div>`;
      return;
    }

    this.element.classList.remove('complete');
    const critical = playerCore.state === 'CRITICAL'
      ? `<div class="run-critical">CORE CRITICAL · ${(playerCore.criticalTicksRemaining / 10).toFixed(1)}s · Move an Engineer to the Core</div>`
      : '';
    const tower = run.towerDefense;
    const towerReadout = tower ? `<div class="tower-wave"><b>WAVE ${tower.currentWave}/${tower.totalWaves}</b><span>${tower.nextWaveTick === null ? (tower.enemiesRemaining === 0 ? 'Area secure' : `${tower.enemiesRemaining} hostiles remaining`) : `NEXT: ${tower.nextWaveLabel} · ${formatTime(Math.max(0, Math.ceil((tower.nextWaveTick - simulation.tick) / 10)))}`}</span></div>` : '';
    if (this.sideMeta) {
      this.sideMeta.hidden = false;
      this.sideMeta.innerHTML = `
        <b>${run.phase} · ${formatTime(elapsedSeconds)}</b>
        <span>${identity.difficulty} · ${run.mode.replaceAll('_', ' ')}</span>`;
      this.sideMeta.title = `${sourceMeta} · ${challengeMeta}`;
    }
    this.element.innerHTML = `
      <div class="run-health-compact">
        <div class="run-health-row"><span>CORE</span><div><i style="width:${playerPercent}%"></i></div><b>${playerPercent}%</b></div>
        ${tower ? `<div class="run-health-row target"><span>HOSTILES</span><div><i style="width:${Math.min(100, tower.enemiesRemaining * 10)}%"></i></div><b>${tower.enemiesRemaining}</b></div>` : `<div class="run-health-row target"><span>${run.mode === 'DESTROY' ? 'TARGET' : 'BOSS'}</span><div><i style="width:${targetPercent}%"></i></div><b>${targetPercent}%</b></div>`}
      </div>
      ${towerReadout}
      ${critical}`;
  }

  private leaderboardMarkup(): string {
    const rows = this.leaderboardEntries.slice(0, 5).map((entry, index) => `
      <div class="run-leaderboard-row">
        <span>#${index + 1}</span><b>${entry.score.toLocaleString()}</b><em>${formatTime(Math.floor(entry.finalTick / 10))}</em>
      </div>`).join('');
    return `
      <div class="run-leaderboard">
        <div class="run-leaderboard-title"><span>LOCAL VERIFIED LEADERBOARD</span><small>Replay MATCH only · remote gateway ready</small></div>
        ${rows || '<div class="run-leaderboard-empty">No verified local scores for this challenge yet.</div>'}
      </div>`;
  }

  private challengeIdentity(run: RunSnapshot): BlockChallengeIdentity {
    return createBlockChallengeIdentity(this.simulation.generatedWorld, {
      mode: run.mode,
      pace: run.pace,
      faction: this.simulation.enemyWar.faction,
      difficulty: this.simulation.enemyWar.difficulty,
    });
  }

  private hasStoredReplay(): boolean {
    return localStorage.getItem(M06_REPLAY_STORAGE_KEY) !== null;
  }

  private navigate(options: { blockDelta: number; toggleMode?: boolean }): void {
    const url = new URL(window.location.href);
    const current = this.simulation.generatedWorld.identity.blockHeight;
    url.searchParams.set('block', String(current + options.blockDelta));
    this.clearChallengeSourceParams(url);
    url.searchParams.set('pace', this.simulation.run.pace.toLowerCase());
    url.searchParams.set('faction', this.simulation.enemyWar.faction.toLowerCase());
    url.searchParams.set('difficulty', this.simulation.enemyWar.difficulty.toLowerCase());
    const currentMode = this.simulation.run.mode;
    const mode = options.toggleMode
      ? (currentMode === 'DESTROY' ? 'boss' : currentMode === 'BOSS_HUNT' ? 'tower' : 'destroy')
      : (currentMode === 'BOSS_HUNT' ? 'boss' : currentMode === 'TOWER_DEFENSE' ? 'tower' : 'destroy');
    url.searchParams.set('mode', mode);
    window.location.assign(url);
  }

  private navigateOfficial(challengeId: string): void {
    const url = new URL(window.location.href);
    this.clearChallengeSourceParams(url);
    url.searchParams.delete('block');
    url.searchParams.set('official', challengeId);
    url.searchParams.set('pace', this.simulation.run.pace.toLowerCase());
    url.searchParams.set('faction', this.simulation.enemyWar.faction.toLowerCase());
    url.searchParams.set('difficulty', this.simulation.enemyWar.difficulty.toLowerCase());
    url.searchParams.set('mode', this.simulation.run.mode === 'BOSS_HUNT' ? 'boss' : this.simulation.run.mode === 'TOWER_DEFENSE' ? 'tower' : 'destroy');
    window.location.assign(url);
  }

  private navigatePepepow(offset: number): void {
    const url = new URL(window.location.href);
    this.clearChallengeSourceParams(url);
    url.searchParams.set('block', String(this.simulation.generatedWorld.identity.blockHeight));
    url.searchParams.set('live', 'pepepow');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('pace', this.simulation.run.pace.toLowerCase());
    url.searchParams.set('faction', this.simulation.enemyWar.faction.toLowerCase());
    url.searchParams.set('difficulty', this.simulation.enemyWar.difficulty.toLowerCase());
    url.searchParams.set('mode', this.simulation.run.mode === 'BOSS_HUNT' ? 'boss' : this.simulation.run.mode === 'TOWER_DEFENSE' ? 'tower' : 'destroy');
    window.location.assign(url);
  }

  private clearChallengeSourceParams(url: URL): void {
    url.searchParams.delete('replay');
    url.searchParams.delete('challenge');
    url.searchParams.delete('ruleset');
    url.searchParams.delete('world');
    url.searchParams.delete('attempt');
    url.searchParams.delete('live');
    url.searchParams.delete('offset');
    url.searchParams.delete('source');
    url.searchParams.delete('official');
  }

  private replayLast(): void {
    if (!this.hasStoredReplay()) return;
    const url = new URL(window.location.href);
    url.searchParams.set('replay', 'last');
    window.location.assign(url);
  }

  private async copyChallengeLink(): Promise<void> {
    const identity = this.challengeIdentity(this.simulation.run.snapshot());
    const shareUrl = createBlockChallengeShareUrl(window.location.href, identity).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        textArea.remove();
        if (!copied) throw new Error('Clipboard copy failed.');
      }
      this.shareStatus = 'COPIED';
    } catch {
      this.shareStatus = 'FAILED';
    }
    this.lastSignature = '';
    this.render(this.simulation.run.snapshot());
  }

  private async verifyAndStoreScore(): Promise<void> {
    if (this.simulation.isReplayPlayback) return;
    const packet = this.simulation.replayPacket();
    if (!packet) {
      this.proofStatus = 'REJECTED';
      this.proofMessage = 'Score proof unavailable: run replay packet is incomplete.';
      return;
    }

    this.proofStatus = 'VERIFYING';
    this.proofMessage = 'Rebuilding this world and replaying the command stream…';
    this.lastSignature = '';
    this.render(this.simulation.run.snapshot());
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const result = await this.leaderboard.submit(createChallengeScoreSubmission(packet));
    if (result.status === 'ACCEPTED') {
      this.proofStatus = 'VERIFIED';
      this.proofMessage = `Replay MATCH · verified local rank #${result.rank}.`;
      await this.refreshLeaderboard();
    } else {
      this.proofStatus = 'REJECTED';
      this.proofMessage = `Score rejected: ${result.proof.reason.replaceAll('_', ' ')}.`;
    }
    this.lastSignature = '';
    this.render(this.simulation.run.snapshot());
  }

  private async refreshLeaderboard(): Promise<void> {
    const challengeCode = blockChallengeCode(this.challengeIdentity(this.simulation.run.snapshot()));
    this.leaderboardEntries = await this.leaderboard.list(challengeCode);
    this.lastSignature = '';
  }
}
