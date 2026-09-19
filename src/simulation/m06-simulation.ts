import { CURRENT_CHALLENGE_RULESET_VERSION, isSupportedChallengeRuleset } from '../challenge/ruleset';
import type { StartingAttunements } from './attunement-state';
import type { M04GameCommand } from './commands';
import { isElementId } from './element-types';
import type { M03Command } from './m03-commands';
import type { M04Command } from './m04-commands';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M05Simulation, type M05SimulationOptions, type M05SimulationSnapshot } from './m05-simulation';
import {
  CORE_UNIT_HEAL_PERMILLE_PER_TICK,
  CORE_UNIT_HEAL_RADIUS,
  STRUCTURE_BODY_RADIUS,
  type RunMode,
  type RunOutcome,
  type RunPace,
} from './m06-content';
import {
  RunState,
  type BossAbilityIntent,
  type ObjectiveAttackOrderSnapshot,
  type RunObjectiveId,
  type RunSnapshot,
} from './run-state';
import type { GeneratedWorld } from '../world/world-definition';

export type ReplayVerification = 'NONE' | 'PENDING' | 'MATCH' | 'DIVERGED';

export interface M06RunCommand {
  targetTick: number;
  playerId: number;
  type: 'ATTACK_OBJECTIVE';
  entityIds: readonly number[];
  objective: Extract<RunObjectiveId, 'PLAYER_CORE' | 'ENEMY_CORE'>;
}

export type M06ReplayEntry =
  | { channel: 'GAME'; command: M04GameCommand }
  | { channel: 'STRATEGIC'; command: M03Command }
  | { channel: 'ROGUELITE'; command: M04Command }
  | { channel: 'RUN'; command: M06RunCommand };

export interface M06ReplayHeader {
  version: 'ef-replay-v4';
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

function cloneRunCommand(command: M06RunCommand): M06RunCommand {
  return { ...command, entityIds: [...command.entityIds] };
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
  if (!header || header.version !== 'ef-replay-v4') return false;
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
    if (
      replayEntry.channel !== 'GAME'
      && replayEntry.channel !== 'STRATEGIC'
      && replayEntry.channel !== 'ROGUELITE'
      && replayEntry.channel !== 'RUN'
    ) return false;
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
  private readonly pendingRunCommands: M06RunCommand[] = [];
  private readonly objectiveAttackOrders = new Map<number, RunObjectiveId>();
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
    this.clearObjectiveOrdersForCommand(command);
    super.enqueueCommand(command);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'GAME', command: cloneGameCommand(command) });
    }
  }

  enqueueObjectiveAttack(
    entityIds: readonly number[],
    objective: Extract<RunObjectiveId, 'PLAYER_CORE' | 'ENEMY_CORE'> = 'ENEMY_CORE',
  ): void {
    const playerId = objective === 'ENEMY_CORE' ? 0 : 1;
    this.enqueueRunCommand({
      targetTick: this.snapshot().tick + 1,
      playerId,
      type: 'ATTACK_OBJECTIVE',
      entityIds: [...entityIds],
      objective,
    });
  }

  enqueueRunCommand(command: M06RunCommand): void {
    if (this.playback && !this.internalCommand) return;
    this.pendingRunCommands.push(cloneRunCommand(command));
    this.pendingRunCommands.sort((left, right) => left.targetTick - right.targetTick);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'RUN', command: cloneRunCommand(command) });
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
      this.processRunCommands(nextTick);
      this.prepareObjectiveAttackers(nextTick);
      const frame = super.step();
      this.syncEnemyCoreObjectiveIntent(frame.tick + 1);
      const intent = this.run.advance(
        frame.tick,
        this.entities,
        this.strategy.snapshot(),
        this.roguelite.snapshot(),
        this.objectiveAttackSnapshot(),
      );
      this.applyCoreHealing();
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
        version: 'ef-replay-v4',
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
      if (entry.channel === 'GAME') {
        const command = cloneGameCommand(entry.command);
        this.clearObjectiveOrdersForCommand(command);
        super.enqueueCommand(command);
      } else if (entry.channel === 'STRATEGIC') {
        super.enqueueStrategicCommand(cloneStrategicCommand(entry.command));
      } else if (entry.channel === 'ROGUELITE') {
        super.enqueueRogueliteCommand(cloneRogueliteCommand(entry.command));
      } else {
        this.pendingRunCommands.push(cloneRunCommand(entry.command));
        this.pendingRunCommands.sort((left, right) => left.targetTick - right.targetTick);
      }
      this.replayEntryIndex += 1;
    }
  }

  private processRunCommands(targetTick: number): void {
    const due = this.pendingRunCommands.filter((command) => command.targetTick <= targetTick);
    if (due.length === 0) return;
    for (let index = this.pendingRunCommands.length - 1; index >= 0; index -= 1) {
      if ((this.pendingRunCommands[index]?.targetTick ?? Number.POSITIVE_INFINITY) <= targetTick) {
        this.pendingRunCommands.splice(index, 1);
      }
    }

    for (const command of due) {
      const expectedPlayerId = command.objective === 'ENEMY_CORE' ? 0 : 1;
      if (command.playerId !== expectedPlayerId) continue;
      const validIds = command.entityIds
        .filter((entityId) => (
          this.entities.hasUnit(entityId)
          && this.entities.factions.get(entityId)?.playerId === command.playerId
          && this.entities.health.get(entityId)?.alive === true
        ))
        .sort((left, right) => left - right);
      if (validIds.length === 0) continue;
      for (const entityId of validIds) this.objectiveAttackOrders.set(entityId, command.objective);
      const target = this.objectivePosition(command.objective);
      if (!target) continue;
      super.enqueueCommand({
        targetTick,
        playerId: command.playerId,
        type: 'MOVE',
        entityIds: validIds,
        targetX: target.x,
        targetZ: target.z,
      });
    }
  }

  private prepareObjectiveAttackers(targetTick: number): void {
    for (const [entityId, objective] of [...this.objectiveAttackOrders.entries()]) {
      if (!this.entities.hasUnit(entityId) || this.entities.health.get(entityId)?.alive !== true) {
        this.objectiveAttackOrders.delete(entityId);
        continue;
      }
      const target = this.objectivePosition(objective);
      if (!target || target.state === 'DESTROYED') {
        this.objectiveAttackOrders.delete(entityId);
        continue;
      }
      const position = this.entities.positions.get(entityId);
      const movement = this.entities.movements.get(entityId);
      const combat = this.entities.combat.get(entityId);
      if (!position || !movement || !combat) {
        this.objectiveAttackOrders.delete(entityId);
        continue;
      }
      const dx = position.x - target.x;
      const dz = position.z - target.z;
      const attackRange = STRUCTURE_BODY_RADIUS + combat.attackRange;
      const inRange = dx * dx + dz * dz <= attackRange * attackRange;
      const playerId = this.entities.factions.get(entityId)?.playerId;
      if (playerId === undefined) continue;

      if (inRange) {
        if (movement.targetX !== null || movement.targetZ !== null) {
          super.enqueueCommand({ type: 'STOP', targetTick, playerId, entityIds: [entityId] });
        }
        continue;
      }

      if (movement.targetX === null || movement.targetZ === null || movement.pathIndex >= movement.path.length) {
        super.enqueueCommand({
          type: 'MOVE',
          targetTick,
          playerId,
          entityIds: [entityId],
          targetX: target.x,
          targetZ: target.z,
        });
      }
    }
  }

  private syncEnemyCoreObjectiveIntent(targetTick: number): void {
    const decision = this.enemyWar.snapshot().currentDecision;
    const playerCoreRegion = this.generatedWorld.spawns.find((spawn) => spawn.id === 'PLAYER')?.regionId ?? null;
    const shouldAttackCore = decision?.action === 'ATTACK'
      && decision.targetEntityId === null
      && decision.targetRegionId !== null
      && decision.targetRegionId === playerCoreRegion;

    // Objective intent persists until the unit receives another normal command.
    // Enemy AI MOVE / ATTACK / STOP commands already clear stale objective orders
    // through enqueueCommand(), so do not erase an explicit Core attack here.
    if (!shouldAttackCore) return;

    const enemyIds = this.entities.entityIds()
      .filter((entityId) => (
        this.entities.hasUnit(entityId)
        && this.entities.factions.get(entityId)?.playerId === 1
        && this.entities.health.get(entityId)?.alive === true
      ))
      .sort((left, right) => left - right);
    const target = this.objectivePosition('PLAYER_CORE');
    if (!target || enemyIds.length === 0) return;
    for (const entityId of enemyIds) this.objectiveAttackOrders.set(entityId, 'PLAYER_CORE');
    super.enqueueCommand({
      type: 'MOVE',
      targetTick,
      playerId: 1,
      entityIds: enemyIds,
      targetX: target.x,
      targetZ: target.z,
    });
  }

  private applyCoreHealing(): void {
    const run = this.run.snapshot();
    for (const core of [run.playerCore, run.enemyCore]) {
      if (core.state !== 'ACTIVE') continue;
      const radiusSquared = CORE_UNIT_HEAL_RADIUS * CORE_UNIT_HEAL_RADIUS;
      for (const entityId of this.entities.entityIds()) {
        if (!this.entities.hasUnit(entityId) || this.entities.factions.get(entityId)?.playerId !== core.playerId) continue;
        const health = this.entities.health.get(entityId);
        const position = this.entities.positions.get(entityId);
        const combat = this.entities.combat.get(entityId);
        if (!health?.alive || health.current >= health.max || !position || !combat) continue;
        if (combat.targetEntityId !== null) continue;
        const dx = position.x - core.x;
        const dz = position.z - core.z;
        if (dx * dx + dz * dz > radiusSquared) continue;

        const targetedByHostile = this.entities.entityIds().some((attackerId) => (
          this.entities.hasUnit(attackerId)
          && this.entities.factions.get(attackerId)?.playerId !== core.playerId
          && this.entities.health.get(attackerId)?.alive === true
          && this.entities.combat.get(attackerId)?.targetEntityId === entityId
        ));
        if (targetedByHostile) continue;

        const amount = Math.max(1, Math.floor((health.max * CORE_UNIT_HEAL_PERMILLE_PER_TICK) / 1000));
        health.current = Math.min(health.max, health.current + amount);
      }
    }
  }

  private objectivePosition(objective: RunObjectiveId): {
    x: number;
    z: number;
    state: RunSnapshot['playerCore']['state'];
  } | null {
    const run = this.run.snapshot();
    if (objective === 'PLAYER_CORE') return run.playerCore;
    if (objective === 'ENEMY_CORE') return run.enemyCore;
    return null;
  }

  private objectiveAttackSnapshot(): ObjectiveAttackOrderSnapshot[] {
    return [...this.objectiveAttackOrders.entries()]
      .map(([entityId, objective]) => ({ entityId, objective }))
      .sort((left, right) => left.entityId - right.entityId || left.objective.localeCompare(right.objective));
  }

  private clearObjectiveOrdersForCommand(command: M04GameCommand): void {
    if (command.type === 'CAST' || command.type === 'CAST_TACTICAL' || command.type === 'CAST_STRATEGIC') return;
    for (const entityId of command.entityIds) this.objectiveAttackOrders.delete(entityId);
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
    if (entry.channel === 'ROGUELITE') return { channel: 'ROGUELITE', command: cloneRogueliteCommand(entry.command) };
    return { channel: 'RUN', command: cloneRunCommand(entry.command) };
  }
}
