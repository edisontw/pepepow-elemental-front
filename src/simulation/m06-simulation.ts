import { CURRENT_CHALLENGE_RULESET_VERSION, isSupportedChallengeRuleset } from '../challenge/ruleset';
import type { StartingAttunements } from './attunement-state';
import type { M04GameCommand } from './commands';
import { isElementId } from './element-types';
import type { M03Command } from './m03-commands';
import type { M04Command } from './m04-commands';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M05Simulation, type M05SimulationOptions, type M05SimulationSnapshot } from './m05-simulation';
import type { RunMode, RunOutcome, RunPace } from './m06-content';
import { RunState, type BossAbilityIntent, type RunSnapshot } from './run-state';
import type { GeneratedWorld } from '../world/world-definition';

export type ReplayVerification = 'NONE' | 'PENDING' | 'MATCH' | 'DIVERGED';
export type M06ReplayEntry =
  | { channel: 'GAME'; command: M04GameCommand }
  | { channel: 'STRATEGIC'; command: M03Command }
  | { channel: 'ROGUELITE'; command: M04Command };

export interface M06ReplayHeader {
  version: 'ef-replay-v3';
  blockHeight: number;
  rulesetVersion: string;
  worldGameplayHash: string;
  generationAttempt: number;
  startingAttunements: StartingAttunements;
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
  outcome: RunOutcome;
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

function cloneGameCommand(command: M04GameCommand): M04GameCommand {
  if (command.type === 'CAST') return { ...command };
  if (command.type === 'CAST_TACTICAL') {
    return {
      ...command,
      candidateCasterIds: [...command.candidateCasterIds],
      target: command.target.kind === 'ENTITY'
        ? { kind: 'ENTITY', entityId: command.target.entityId }
        : { kind: 'POINT', x: command.target.x, z: command.target.z },
    };
  }
  if (command.type === 'CAST_STRATEGIC') {
    return { ...command, target: { kind: 'POINT', x: command.target.x, z: command.target.z } };
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

function validStartingAttunements(value: unknown): value is StartingAttunements {
  return Array.isArray(value)
    && value.length === 2
    && isElementId(value[0])
    && isElementId(value[1])
    && value[0] !== value[1];
}

export function isM06ReplayPacket(value: unknown): value is M06ReplayPacket {
  if (typeof value !== 'object' || value === null) return false;
  const packet = value as Partial<M06ReplayPacket>;
  const header = packet.header as Partial<M06ReplayHeader> | undefined;
  if (!header || header.version !== 'ef-replay-v3') return false;
  if (!Number.isSafeInteger(header.blockHeight) || !Number.isSafeInteger(header.generationAttempt)) return false;
  if (typeof header.rulesetVersion !== 'string' || typeof header.worldGameplayHash !== 'string') return false;
  if (!validStartingAttunements(header.startingAttunements)) return false;
  if (header.mode !== 'DESTROY' && header.mode !== 'BOSS_HUNT') return false;
  if (header.pace !== 'STANDARD' && header.pace !== 'SMOKE') return false;
  if (!['IRON_LEGION', 'FLAME_CULT', 'WILD_HORDE'].includes(header.faction ?? '')) return false;
  if (!['CASUAL', 'STANDARD', 'HARD'].includes(header.difficulty ?? '')) return false;
  if (!Array.isArray(packet.commands)) return false;
  for (const entry of packet.commands) {
    if (typeof entry !== 'object' || entry === null) return false;
    const replayEntry = entry as Partial<M06ReplayEntry>;
    if (replayEntry.channel !== 'GAME' && replayEntry.channel !== 'STRATEGIC' && replayEntry.channel !== 'ROGUELITE') return false;
    if (typeof replayEntry.command !== 'object' || replayEntry.command === null) return false;
    const command = replayEntry.command as { targetTick?: unknown };
    if (!Number.isSafeInteger(command.targetTick) || (command.targetTick as number) < 1) return false;
  }
  if (!Number.isSafeInteger(packet.finalTick) || (packet.finalTick ?? -1) < 0 || typeof packet.finalStateHash !== 'string') return false;
  if (!['IN_PROGRESS', 'VICTORY', 'DEFEAT'].includes(packet.outcome ?? '')) return false;
  return Number.isSafeInteger(packet.totalScore);
}

export class M06Simulation extends M05Simulation {
  readonly run: RunState;
  private readonly recordedCommands: M06ReplayEntry[] = [];
  private pendingReplayEntries: M06ReplayEntry[] = [];
  private replayEntryIndex = 0;
  private internalCommand = false;
  private playback = false;
  private replayExpectedTick: number | null = null;
  private replayExpectedHash: string | null = null;
  private replayVerification: ReplayVerification = 'NONE';

  constructor(generatedWorld: GeneratedWorld, options: M06SimulationOptions = {}) {
    super(generatedWorld, options);
    this.run = new RunState(generatedWorld, options.mode ?? 'DESTROY', options.pace ?? 'STANDARD');
  }

  override enqueueCommand(command: M04GameCommand): void {
    if (this.playback && !this.internalCommand) return;
    super.enqueueCommand(command);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'GAME', command: cloneGameCommand(command) });
    }
  }

  override enqueueStrategicCommand(command: M03Command): void {
    if (this.playback && !this.internalCommand) return;
    super.enqueueStrategicCommand(command);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'STRATEGIC', command: cloneStrategicCommand(command) });
    }
  }

  override enqueueRogueliteCommand(command: M04Command): void {
    if (this.playback && !this.internalCommand) return;
    super.enqueueRogueliteCommand(command);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'ROGUELITE', command: cloneRogueliteCommand(command) });
    }
  }

  override step(): M06SimulationSnapshot {
    if (this.run.snapshot().outcome !== 'IN_PROGRESS') return this.snapshot();
    const nextTick = this.snapshot().tick + 1;
    this.injectReplayEntries(nextTick);
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
    if (!snapshot.run.result) return null;
    return this.buildReplayPacket(snapshot);
  }

  replayCheckpointPacket(): M06ReplayPacket {
    return this.buildReplayPacket(this.snapshot());
  }

  loadReplay(packet: M06ReplayPacket): void {
    if (this.snapshot().tick !== 0 || this.recordedCommands.length !== 0) {
      throw new Error('Replay playback must be loaded before the run starts.');
    }
    this.assertReplayIdentity(packet);
    this.playback = true;
    this.pendingReplayEntries = packet.commands
      .map((entry, order) => ({ entry: this.cloneReplayEntry(entry), order }))
      .sort((left, right) => (
        left.entry.command.targetTick - right.entry.command.targetTick
        || left.order - right.order
      ))
      .map(({ entry }) => entry);
    this.replayEntryIndex = 0;
    this.replayExpectedTick = packet.finalTick;
    this.replayExpectedHash = packet.finalStateHash;
    this.replayVerification = 'PENDING';
  }

  get isReplayPlayback(): boolean {
    return this.playback;
  }

  private buildReplayPacket(snapshot: M06SimulationSnapshot): M06ReplayPacket {
    return {
      header: {
        version: 'ef-replay-v3',
        blockHeight: this.generatedWorld.identity.blockHeight,
        rulesetVersion: CURRENT_CHALLENGE_RULESET_VERSION,
        worldGameplayHash: this.generatedWorld.gameplayHash,
        generationAttempt: this.generatedWorld.generationAttempt,
        startingAttunements: this.attunements.starting(0),
        mode: snapshot.run.mode,
        pace: snapshot.run.pace,
        faction: this.enemyWar.faction,
        difficulty: this.enemyWar.difficulty,
      },
      commands: this.recordedCommands.map((entry) => this.cloneReplayEntry(entry)),
      finalTick: snapshot.tick,
      finalStateHash: snapshot.stateHash,
      outcome: snapshot.run.outcome,
      totalScore: snapshot.run.result?.score.total ?? 0,
    };
  }

  private injectReplayEntries(nextTick: number): void {
    if (!this.playback) return;
    while (this.replayEntryIndex < this.pendingReplayEntries.length) {
      const entry = this.pendingReplayEntries[this.replayEntryIndex];
      if (!entry || entry.command.targetTick > nextTick) break;
      if (entry.channel === 'GAME') super.enqueueCommand(cloneGameCommand(entry.command));
      else if (entry.channel === 'STRATEGIC') super.enqueueStrategicCommand(cloneStrategicCommand(entry.command));
      else super.enqueueRogueliteCommand(cloneRogueliteCommand(entry.command));
      this.replayEntryIndex += 1;
    }
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
    if (!isSupportedChallengeRuleset(header.rulesetVersion)) throw new Error('Replay ruleset mismatch.');
    if (header.worldGameplayHash !== this.generatedWorld.gameplayHash) throw new Error('Replay world hash mismatch.');
    if (header.generationAttempt !== this.generatedWorld.generationAttempt) throw new Error('Replay generation attempt mismatch.');
    const localStarting = this.attunements.starting(0);
    if (header.startingAttunements[0] !== localStarting[0] || header.startingAttunements[1] !== localStarting[1]) {
      throw new Error('Replay starting Attunements mismatch.');
    }
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
