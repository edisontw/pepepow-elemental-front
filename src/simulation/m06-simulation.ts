import type { GameCommand } from './commands';
import type { M03Command } from './m03-commands';
import type { M04Command } from './m04-commands';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M05Simulation, type M05SimulationOptions, type M05SimulationSnapshot } from './m05-simulation';
import type { RunMode, RunPace } from './m06-content';
import { RunState, type BossAbilityIntent, type RunSnapshot } from './run-state';
import type { GeneratedWorld } from '../world/world-definition';

export type ReplayVerification = 'NONE' | 'PENDING' | 'MATCH' | 'DIVERGED';
export type M06ReplayEntry =
  | { channel: 'GAME'; command: GameCommand }
  | { channel: 'STRATEGIC'; command: M03Command }
  | { channel: 'ROGUELITE'; command: M04Command };

export interface M06ReplayHeader {
  version: 'm06-replay-v1';
  blockHeight: number;
  rulesetVersion: string;
  worldGameplayHash: string;
  generationAttempt: number;
  mode: RunMode;
  pace: RunPace;
  faction: EnemyFaction;
  difficulty: EnemyDifficulty;
}

export interface M06ReplayPacket {
  header: M06ReplayHeader;
  commands: readonly M06ReplayEntry[];
  finalTick: number;
  finalStateHash: string;
  outcome: 'VICTORY' | 'DEFEAT';
  totalScore: number;
}

export interface M06SimulationOptions extends M05SimulationOptions {
  mode?: RunMode;
  pace?: RunPace;
}

export interface M06SimulationSnapshot extends M05SimulationSnapshot {
  run: RunSnapshot;
  replayVerification: ReplayVerification;
  recordedCommandCount: number;
}

function cloneGameCommand(command: GameCommand): GameCommand {
  if (command.type === 'CAST') {
    if (command.effectId === 'CHAIN_LIGHTNING') return { ...command };
    return { ...command };
  }
  return { ...command, entityIds: [...command.entityIds] };
}

function cloneStrategicCommand(command: M03Command): M03Command {
  if (command.type === 'CAPTURE') return { ...command, entityIds: [...command.entityIds] };
  return { ...command };
}

function cloneRogueliteCommand(command: M04Command): M04Command {
  return { ...command };
}

export function isM06ReplayPacket(value: unknown): value is M06ReplayPacket {
  if (typeof value !== 'object' || value === null) return false;
  const packet = value as Partial<M06ReplayPacket>;
  const header = packet.header as Partial<M06ReplayHeader> | undefined;
  if (!header || header.version !== 'm06-replay-v1') return false;
  if (!Number.isSafeInteger(header.blockHeight) || !Number.isSafeInteger(header.generationAttempt)) return false;
  if (typeof header.rulesetVersion !== 'string' || typeof header.worldGameplayHash !== 'string') return false;
  if (header.mode !== 'DESTROY' && header.mode !== 'BOSS_HUNT') return false;
  if (header.pace !== 'STANDARD' && header.pace !== 'SMOKE') return false;
  if (!['IRON_LEGION', 'FLAME_CULT', 'WILD_HORDE'].includes(header.faction ?? '')) return false;
  if (!['CASUAL', 'STANDARD', 'HARD'].includes(header.difficulty ?? '')) return false;
  if (!Array.isArray(packet.commands)) return false;
  if (!Number.isSafeInteger(packet.finalTick) || typeof packet.finalStateHash !== 'string') return false;
  if (packet.outcome !== 'VICTORY' && packet.outcome !== 'DEFEAT') return false;
  return Number.isSafeInteger(packet.totalScore);
}

export class M06Simulation extends M05Simulation {
  readonly run: RunState;
  private readonly recordedCommands: M06ReplayEntry[] = [];
  private internalCommand = false;
  private loadingReplay = false;
  private playback = false;
  private replayExpectedTick: number | null = null;
  private replayExpectedHash: string | null = null;
  private replayVerification: ReplayVerification = 'NONE';

  constructor(generatedWorld: GeneratedWorld, options: M06SimulationOptions = {}) {
    super(generatedWorld, options);
    this.run = new RunState(generatedWorld, options.mode ?? 'DESTROY', options.pace ?? 'STANDARD');
  }

  override enqueueCommand(command: GameCommand): void {
    if (this.playback && !this.loadingReplay && !this.internalCommand) return;
    super.enqueueCommand(command);
    if (!this.internalCommand && !this.loadingReplay) {
      this.recordedCommands.push({ channel: 'GAME', command: cloneGameCommand(command) });
    }
  }

  override enqueueStrategicCommand(command: M03Command): void {
    if (this.playback && !this.loadingReplay && !this.internalCommand) return;
    super.enqueueStrategicCommand(command);
    if (!this.internalCommand && !this.loadingReplay) {
      this.recordedCommands.push({ channel: 'STRATEGIC', command: cloneStrategicCommand(command) });
    }
  }

  override enqueueRogueliteCommand(command: M04Command): void {
    if (this.playback && !this.loadingReplay && !this.internalCommand) return;
    super.enqueueRogueliteCommand(command);
    if (!this.internalCommand && !this.loadingReplay) {
      this.recordedCommands.push({ channel: 'ROGUELITE', command: cloneRogueliteCommand(command) });
    }
  }

  override step(): M06SimulationSnapshot {
    if (this.run.snapshot().outcome !== 'IN_PROGRESS') return this.snapshot();
    this.internalCommand = true;
    try {
      const frame = super.step();
      const intent = this.run.advance(
        frame.tick,
        this.entities,
        this.strategy.snapshot(),
        this.roguelite.snapshot(),
      );
      if (intent) this.enqueueBossAbility(frame.tick + 1, intent);
    } finally {
      this.internalCommand = false;
    }
    const snapshot = this.snapshot();
    this.updateReplayVerification(snapshot);
    return this.snapshot();
  }

  override snapshot(): M06SimulationSnapshot {
    const base = super.snapshot();
    const run = this.run.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${run.stateHash}`,
      run,
      replayVerification: this.replayVerification,
      recordedCommandCount: this.recordedCommands.length,
    };
  }

  replayPacket(): M06ReplayPacket | null {
    const snapshot = this.snapshot();
    const result = snapshot.run.result;
    if (!result) return null;
    return {
      header: {
        version: 'm06-replay-v1',
        blockHeight: this.generatedWorld.identity.blockHeight,
        rulesetVersion: this.generatedWorld.identity.rulesetVersion,
        worldGameplayHash: this.generatedWorld.gameplayHash,
        generationAttempt: this.generatedWorld.generationAttempt,
        mode: snapshot.run.mode,
        pace: snapshot.run.pace,
        faction: this.enemyWar.faction,
        difficulty: this.enemyWar.difficulty,
      },
      commands: this.recordedCommands.map((entry) => this.cloneReplayEntry(entry)),
      finalTick: result.completedTick,
      finalStateHash: snapshot.stateHash,
      outcome: result.outcome,
      totalScore: result.score.total,
    };
  }

  loadReplay(packet: M06ReplayPacket): void {
    if (this.snapshot().tick !== 0 || this.recordedCommands.length !== 0) {
      throw new Error('Replay playback must be loaded before the run starts.');
    }
    this.assertReplayIdentity(packet);
    this.playback = true;
    this.loadingReplay = true;
    try {
      for (const entry of packet.commands) {
        if (entry.channel === 'GAME') super.enqueueCommand(cloneGameCommand(entry.command));
        else if (entry.channel === 'STRATEGIC') super.enqueueStrategicCommand(cloneStrategicCommand(entry.command));
        else super.enqueueRogueliteCommand(cloneRogueliteCommand(entry.command));
      }
    } finally {
      this.loadingReplay = false;
    }
    this.replayExpectedTick = packet.finalTick;
    this.replayExpectedHash = packet.finalStateHash;
    this.replayVerification = 'PENDING';
  }

  get isReplayPlayback(): boolean {
    return this.playback;
  }

  private enqueueBossAbility(targetTick: number, intent: BossAbilityIntent): void {
    if (intent.bossType === 'FROST_TITAN') {
      this.enqueueCommand({
        targetTick,
        playerId: 1,
        type: 'CAST',
        effectId: 'FREEZE',
        targetX: intent.targetX,
        targetZ: intent.targetZ,
        radius: intent.radius,
      });
      return;
    }
    if (intent.bossType === 'STORM_COLOSSUS') {
      this.enqueueCommand({
        targetTick,
        playerId: 1,
        type: 'CAST',
        effectId: 'CHAIN_LIGHTNING',
        targetEntityId: intent.targetEntityId,
      });
      return;
    }
    this.enqueueCommand({
      targetTick,
      playerId: 1,
      type: 'CAST',
      effectId: 'FIRE',
      targetX: intent.targetX,
      targetZ: intent.targetZ,
      radius: intent.radius,
    });
    this.enqueueCommand({
      targetTick,
      playerId: 1,
      type: 'CAST',
      effectId: 'HEAT',
      targetX: intent.targetX,
      targetZ: intent.targetZ,
      radius: Math.max(1_000, Math.floor(intent.radius / 2)),
    });
  }

  private assertReplayIdentity(packet: M06ReplayPacket): void {
    const header = packet.header;
    if (header.blockHeight !== this.generatedWorld.identity.blockHeight) throw new Error('Replay block height mismatch.');
    if (header.rulesetVersion !== this.generatedWorld.identity.rulesetVersion) throw new Error('Replay ruleset mismatch.');
    if (header.worldGameplayHash !== this.generatedWorld.gameplayHash) throw new Error('Replay world hash mismatch.');
    if (header.generationAttempt !== this.generatedWorld.generationAttempt) throw new Error('Replay generation attempt mismatch.');
    if (header.mode !== this.run.mode || header.pace !== this.run.pace) throw new Error('Replay run options mismatch.');
    if (header.faction !== this.enemyWar.faction || header.difficulty !== this.enemyWar.difficulty) {
      throw new Error('Replay enemy configuration mismatch.');
    }
  }

  private updateReplayVerification(snapshot: M06SimulationSnapshot): void {
    if (!this.playback || this.replayVerification !== 'PENDING') return;
    if (this.replayExpectedTick === null || this.replayExpectedHash === null) return;
    if (snapshot.tick < this.replayExpectedTick && snapshot.run.outcome === 'IN_PROGRESS') return;
    this.replayVerification = snapshot.tick === this.replayExpectedTick && snapshot.stateHash === this.replayExpectedHash
      ? 'MATCH'
      : 'DIVERGED';
  }

  private cloneReplayEntry(entry: M06ReplayEntry): M06ReplayEntry {
    if (entry.channel === 'GAME') return { channel: 'GAME', command: cloneGameCommand(entry.command) };
    if (entry.channel === 'STRATEGIC') return { channel: 'STRATEGIC', command: cloneStrategicCommand(entry.command) };
    return { channel: 'ROGUELITE', command: cloneRogueliteCommand(entry.command) };
  }
}
