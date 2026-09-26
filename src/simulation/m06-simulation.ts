import { CURRENT_CHALLENGE_RULESET_VERSION, isSupportedChallengeRuleset } from '../challenge/ruleset';
import { WORLD_UNITS_PER_METER } from './arena';
import type { StartingAttunements } from './attunement-state';
import type { M04GameCommand } from './commands';
import { isElementId } from './element-types';
import type { M03Command } from './m03-commands';
import type { M04Command } from './m04-commands';
import type { EnemyDifficulty, EnemyFaction } from './m05-content';
import { M05Simulation, type M05SimulationOptions, type M05SimulationSnapshot } from './m05-simulation';
import {
  NEUTRAL_CAMP_AGGRO_RADIUS,
  NeutralEncounterState,
  type NeutralEncounterSnapshot,
} from './neutral-encounter-state';
import {
  CORE_UNIT_HEAL_INTERVAL_TICKS,
  CORE_UNIT_HEAL_PERMILLE_PER_PULSE,
  CORE_UNIT_HEAL_RADIUS,
  STRUCTURE_BODY_RADIUS,
  type RunMode,
  type RunOutcome,
  type RunPace,
} from './m06-content';
import { UNITS } from './m03-content';
import type { EntityID, UnitArchetype } from './components';
import { forestAllowsDetection } from './elemental-battlefield-rules';
import { SquadState, type FrontOrder, type SquadSnapshot, type SquadStateSnapshot } from './squad-state';
import {
  RunState,
  type BossAbilityIntent,
  type ObjectiveAttackOrderSnapshot,
  type RunObjectiveId,
  type RunSnapshot,
} from './run-state';
import type { GeneratedWorld } from '../world/world-definition';

export type ReplayVerification = 'NONE' | 'PENDING' | 'MATCH' | 'DIVERGED';

export const GUARD_DEFENSE_RADIUS = 12_000;
export const GUARD_PURSUIT_LEASH = 18_000;
export const FRONT_ORDER_SETTLE_RADIUS = 2_000;

export interface M06SquadCommand {
  targetTick: number;
  playerId: number;
  type: 'SET_FRONT_ORDER';
  squadId: number;
  order: FrontOrder;
  targetX?: number;
  targetZ?: number;
}

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
  | { channel: 'RUN'; command: M06RunCommand }
  | { channel: 'SQUAD'; command: M06SquadCommand };

export interface M06ReplayHeader {
  version: 'ef-replay-v25';
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
  neutralEncounters: NeutralEncounterSnapshot;
  replayVerification: ReplayVerification;
  recordedCommandCount: number;
  squads: SquadStateSnapshot;
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

function cloneSquadCommand(command: M06SquadCommand): M06SquadCommand {
  return { ...command };
}

function normalizeSquadCommand(command: M06SquadCommand): M06SquadCommand {
  if (!Number.isSafeInteger(command.targetTick) || command.targetTick < 1) throw new Error('Squad command targetTick must be positive.');
  if (!Number.isSafeInteger(command.playerId) || command.playerId < 0) throw new Error('Squad command playerId must be non-negative.');
  if (!Number.isSafeInteger(command.squadId) || command.squadId <= 0) throw new Error('Squad command squadId must be positive.');
  if (!['ADVANCE', 'GUARD', 'REGROUP'].includes(command.order)) throw new Error('Unknown Front Order.');
  if (command.order !== 'REGROUP' && (!Number.isSafeInteger(command.targetX) || !Number.isSafeInteger(command.targetZ))) {
    throw new Error('Advance and Guard require safe-integer target coordinates.');
  }
  return {
    targetTick: command.targetTick,
    playerId: command.playerId,
    type: 'SET_FRONT_ORDER',
    squadId: command.squadId,
    order: command.order,
    ...(command.order === 'REGROUP' ? {} : {
      targetX: Math.round(command.targetX!),
      targetZ: Math.round(command.targetZ!),
    }),
  };
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
  if (!header || header.version !== 'ef-replay-v25') return false;
  if (!Number.isSafeInteger(header.blockHeight) || !Number.isSafeInteger(header.generationAttempt)) return false;
  if (typeof header.rulesetVersion !== 'string' || typeof header.worldGameplayHash !== 'string') return false;
  if (!validStartingAttunements(header.startingAttunements)) return false;
  if (header.mode !== 'DESTROY' && header.mode !== 'BOSS_HUNT' && header.mode !== 'TOWER_DEFENSE') return false;
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
      && replayEntry.channel !== 'SQUAD'
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
  readonly neutralEncounters: NeutralEncounterState;
  readonly squads: SquadState;
  private readonly recordedCommands: M06ReplayEntry[] = [];
  private pendingReplayEntries: M06ReplayEntry[] = [];
  private readonly pendingRunCommands: Array<M06RunCommand | M04GameCommand> = [];
  private readonly pendingSquadCommands: Array<{ command: M06SquadCommand; enqueueOrder: number }> = [];
  private nextSquadEnqueueOrder = 0;
  private readonly objectiveAttackOrders = new Map<number, RunObjectiveId>();
  private readonly aiObjectiveAttackIds = new Set<number>();
  private replayEntryIndex = 0;
  private internalCommand = false;
  private playback = false;
  private replayExpectedTick: number | null = null;
  private replayExpectedHash: string | null = null;
  private replayVerification: ReplayVerification = 'NONE';

  constructor(generatedWorld: GeneratedWorld, options: M06SimulationOptions = {}) {
    super(generatedWorld, options);
    this.neutralEncounters = new NeutralEncounterState(generatedWorld, this.entities, this.navigation);
    this.run = new RunState(generatedWorld, options.mode ?? 'DESTROY', options.pace ?? 'STANDARD');
    this.squads = new SquadState([{
      id: 1,
      playerId: 0,
      memberEntityIds: this.entities.entityIds().filter((entityId) => (
        this.entities.factions.get(entityId)?.playerId === 0
        && this.entities.health.get(entityId)?.alive === true
      )),
    }]);
    if (this.run.mode === 'TOWER_DEFENSE') {
      for (const entityId of this.entities.entityIds()) {
        if (this.entities.factions.get(entityId)?.playerId === 1) this.entities.health.get(entityId)!.alive = false;
      }
    }
  }

  override enqueueCommand(command: M04GameCommand): void {
    if (this.playback && !this.internalCommand) return;
    if (this.internalCommand && this.run?.mode === 'TOWER_DEFENSE' && command.playerId === 1) return;
    // External/player orders replace an explicit objective attack. Internal
    // Enemy War commands are reconciled against the AI decision after its step.
    super.enqueueCommand(command);
    if (!this.internalCommand) this.pendingRunCommands.push(cloneGameCommand(command));
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'GAME', command: cloneGameCommand(command) });
    }
  }

  enqueueSquadOrder(command: M06SquadCommand): void {
    if (this.playback && !this.internalCommand) return;
    const normalized = normalizeSquadCommand(command);
    this.queueSquadCommand(normalized);
    if (!this.internalCommand) {
      this.recordedCommands.push({ channel: 'SQUAD', command: cloneSquadCommand(normalized) });
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
    if (!this.canEnqueueStrategicCommand(command)) return;
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
      this.processSquadCommands(nextTick);
      this.processRunCommands(nextTick);
      this.prepareSquadOrders(nextTick);
      this.prepareObjectiveAttackers(nextTick);
      this.neutralEncounters.prepareLeashes(nextTick, (command) => super.enqueueCommand(command));
      const frame = super.step();
      this.neutralEncounters.advance(frame.tick);
      const wave = this.run.consumeTowerDefenseWave(frame.tick);
      if (wave) this.spawnTowerDefenseWave(wave);
      if (this.run.mode === 'TOWER_DEFENSE') this.syncTowerDefenseObjectiveIntent();
      else this.syncEnemyCoreObjectiveIntent(frame.tick + 1);
      const intent = this.run.advance(
        frame.tick,
        this.entities,
        this.strategy.snapshot(),
        this.roguelite.snapshot(),
        this.objectiveAttackSnapshot(),
      );
      this.applyCoreHealing(frame.tick);
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
    const neutralEncounters = this.neutralEncounters.snapshot();
    const squads = this.squads.snapshot();
    return {
      ...base,
      stateHash: `${base.stateHash}:${run.stateHash}:neutral:${neutralEncounters.stateHash}:squad:${squads.stateHash}`,
      queuedCommandCount: base.queuedCommandCount + this.pendingSquadCommands.length,
      run,
      neutralEncounters,
      replayVerification: this.replayVerification,
      recordedCommandCount: this.recordedCommands.length,
      squads,
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

  protected override blockedPoiCaptureIds(): ReadonlySet<string> {
    return new Set(
      this.neutralEncounters.snapshot().camps
        .filter((camp) => !camp.cleared)
        .map((camp) => camp.id),
    );
  }

  private buildReplayPacket(snapshot: M06SimulationSnapshot): M06ReplayPacket {
    return {
      header: {
        version: 'ef-replay-v25',
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
        this.pendingRunCommands.push(command);
        super.enqueueCommand(command);
      } else if (entry.channel === 'STRATEGIC') {
        const command = cloneStrategicCommand(entry.command);
        if (this.canEnqueueStrategicCommand(command)) super.enqueueStrategicCommand(command);
      } else if (entry.channel === 'ROGUELITE') {
        super.enqueueRogueliteCommand(cloneRogueliteCommand(entry.command));
      } else if (entry.channel === 'SQUAD') {
        this.queueSquadCommand(cloneSquadCommand(entry.command));
      } else {
        this.pendingRunCommands.push(cloneRunCommand(entry.command));
        this.pendingRunCommands.sort((left, right) => left.targetTick - right.targetTick);
      }
      this.replayEntryIndex += 1;
    }
  }

  private queueSquadCommand(command: M06SquadCommand): void {
    this.pendingSquadCommands.push({ command, enqueueOrder: this.nextSquadEnqueueOrder });
    this.nextSquadEnqueueOrder += 1;
  }

  private processSquadCommands(targetTick: number): void {
    const due = this.pendingSquadCommands
      .filter((queued) => queued.command.targetTick <= targetTick)
      .sort((left, right) => (
        left.command.targetTick - right.command.targetTick
        || left.command.playerId - right.command.playerId
        || left.enqueueOrder - right.enqueueOrder
      ));
    if (due.length === 0) return;
    for (let index = this.pendingSquadCommands.length - 1; index >= 0; index -= 1) {
      if ((this.pendingSquadCommands[index]?.command.targetTick ?? Number.POSITIVE_INFINITY) <= targetTick) {
        this.pendingSquadCommands.splice(index, 1);
      }
    }

    for (const { command } of due) {
      const squad = this.squads.get(command.squadId);
      if (!squad || squad.playerId !== command.playerId) continue;
      const livingIds = this.livingSquadMemberIds(squad);
      if (livingIds.length === 0) continue;
      for (const entityId of livingIds) this.objectiveAttackOrders.delete(entityId);

      if (command.order === 'REGROUP') {
        const destination = this.regroupDestination(command.playerId, livingIds);
        if (!destination) continue;
        this.squads.assignOrder(command.squadId, command.playerId, 'REGROUP', null, destination);
        continue;
      }

      const target = { x: command.targetX!, z: command.targetZ! };
      if (!this.squads.assignOrder(command.squadId, command.playerId, command.order, target)) continue;
      if (command.order === 'ADVANCE') {
        super.enqueueCommand({
          targetTick,
          playerId: command.playerId,
          type: 'ATTACK_MOVE',
          entityIds: livingIds,
          targetX: target.x,
          targetZ: target.z,
        });
      }
    }
  }

  private prepareSquadOrders(targetTick: number): void {
    for (const squad of this.squads.snapshot().squads) {
      if (squad.currentOrder === 'ADVANCE') this.prepareAdvanceSquad(squad, targetTick);
      else if (squad.currentOrder === 'GUARD') this.prepareGuardSquad(squad, targetTick);
      else if (squad.currentOrder === 'REGROUP') this.prepareRegroupSquad(squad, targetTick);
    }
  }

  private prepareAdvanceSquad(squad: SquadSnapshot, targetTick: number): void {
    if (squad.targetX === null || squad.targetZ === null) return;
    const livingIds = this.livingSquadMemberIds(squad);
    for (const entityId of livingIds) {
      const position = this.entities.positions.get(entityId);
      const movement = this.entities.movements.get(entityId);
      const combat = this.entities.combat.get(entityId);
      if (!position || !movement || !combat || combat.targetEntityId !== null) continue;
      const dx = position.x - squad.targetX;
      const dz = position.z - squad.targetZ;
      const settled = dx * dx + dz * dz <= FRONT_ORDER_SETTLE_RADIUS * FRONT_ORDER_SETTLE_RADIUS;
      if (settled) {
        this.ensureHold(entityId, squad.playerId, targetTick);
      } else if (movement.targetX === null && movement.targetZ === null) {
        super.enqueueCommand({
          targetTick,
          playerId: squad.playerId,
          type: 'ATTACK_MOVE',
          entityIds: [entityId],
          targetX: squad.targetX,
          targetZ: squad.targetZ,
        });
      }
    }
  }

  private prepareGuardSquad(squad: SquadSnapshot, targetTick: number): void {
    if (squad.targetX === null || squad.targetZ === null) return;
    const livingIds = this.livingSquadMemberIds(squad);
    if (livingIds.length === 0) return;
    const center = { x: squad.targetX, z: squad.targetZ };
    let guardTarget = squad.guardTargetEntityId;

    if (guardTarget !== null) {
      if (!this.isValidGuardTarget(guardTarget, squad.playerId)) {
        guardTarget = null;
      } else {
        const targetPosition = this.entities.positions.get(guardTarget)!;
        const dx = targetPosition.x - center.x;
        const dz = targetPosition.z - center.z;
        const beyondLeash = dx * dx + dz * dz > GUARD_PURSUIT_LEASH * GUARD_PURSUIT_LEASH;
        if (beyondLeash || !this.isGuardTargetVisible(guardTarget, squad.playerId)) guardTarget = null;
      }
      if (guardTarget !== squad.guardTargetEntityId) this.squads.setGuardTarget(squad.id, guardTarget);
    }

    if (guardTarget === null) {
      const candidate = this.guardThreat(center.x, center.z, squad.playerId);
      if (candidate !== null) {
        guardTarget = candidate;
        this.squads.setGuardTarget(squad.id, candidate);
      }
    }

    if (guardTarget !== null) {
      for (const entityId of livingIds) {
        const position = this.entities.positions.get(entityId);
        if (!position) continue;
        const dx = position.x - center.x;
        const dz = position.z - center.z;
        if (dx * dx + dz * dz > GUARD_PURSUIT_LEASH * GUARD_PURSUIT_LEASH) {
          this.ensureMove(entityId, squad.playerId, center.x, center.z, targetTick);
        } else {
          this.ensureAttack(entityId, squad.playerId, guardTarget, targetTick);
        }
      }
      return;
    }

    for (const entityId of livingIds) {
      const position = this.entities.positions.get(entityId);
      if (!position) continue;
      const dx = position.x - center.x;
      const dz = position.z - center.z;
      if (dx * dx + dz * dz > FRONT_ORDER_SETTLE_RADIUS * FRONT_ORDER_SETTLE_RADIUS) {
        this.ensureMove(entityId, squad.playerId, center.x, center.z, targetTick);
      } else {
        this.ensureHold(entityId, squad.playerId, targetTick);
      }
    }
  }

  private prepareRegroupSquad(squad: SquadSnapshot, targetTick: number): void {
    if (squad.regroupDestinationX === null || squad.regroupDestinationZ === null) return;
    const livingIds = this.livingSquadMemberIds(squad);
    if (livingIds.length === 0) {
      this.squads.setRegroupState(squad.id, 'READY');
      return;
    }
    let allSettled = true;
    let allFullHealth = true;
    for (const entityId of livingIds) {
      const position = this.entities.positions.get(entityId);
      const health = this.entities.health.get(entityId);
      if (!position || !health) continue;
      allFullHealth = allFullHealth && health.current >= health.max;
      const dx = position.x - squad.regroupDestinationX;
      const dz = position.z - squad.regroupDestinationZ;
      const settled = dx * dx + dz * dz <= FRONT_ORDER_SETTLE_RADIUS * FRONT_ORDER_SETTLE_RADIUS;
      allSettled = allSettled && settled;
      if (settled) this.ensureHold(entityId, squad.playerId, targetTick);
      else this.ensureMove(entityId, squad.playerId, squad.regroupDestinationX, squad.regroupDestinationZ, targetTick);
    }
    this.squads.setRegroupState(squad.id, allSettled ? (allFullHealth ? 'READY' : 'RECOVERING') : 'RETURNING');
  }

  private livingSquadMemberIds(squad: SquadSnapshot): EntityID[] {
    return squad.memberEntityIds
      .filter((entityId) => (
        this.entities.hasUnit(entityId)
        && this.entities.factions.get(entityId)?.playerId === squad.playerId
        && this.entities.health.get(entityId)?.alive === true
      ))
      .sort((left, right) => left - right);
  }

  private guardThreat(centerX: number, centerZ: number, playerId: number): EntityID | null {
    const radiusSquared = GUARD_DEFENSE_RADIUS * GUARD_DEFENSE_RADIUS;
    const candidates = this.entities.entityIds()
      .filter((entityId) => {
        if (!this.isValidGuardTarget(entityId, playerId) || !this.isGuardTargetVisible(entityId, playerId)) return false;
        const position = this.entities.positions.get(entityId)!;
        const dx = position.x - centerX;
        const dz = position.z - centerZ;
        return dx * dx + dz * dz <= radiusSquared;
      })
      .map((entityId) => {
        const position = this.entities.positions.get(entityId)!;
        const dx = position.x - centerX;
        const dz = position.z - centerZ;
        return { entityId, distanceSquared: dx * dx + dz * dz };
      })
      .sort((left, right) => left.distanceSquared - right.distanceSquared || left.entityId - right.entityId);
    return candidates[0]?.entityId ?? null;
  }

  private isValidGuardTarget(entityId: EntityID, playerId: number): boolean {
    return this.entities.hasUnit(entityId)
      && this.entities.health.get(entityId)?.alive === true
      && this.entities.factions.get(entityId)?.playerId !== playerId
      && !this.entities.neutralCampIds.has(entityId);
  }

  private isGuardTargetVisible(entityId: EntityID, playerId: number): boolean {
    const position = this.entities.positions.get(entityId);
    if (!position) return false;
    return this.visibility.isWorldVisible(playerId, position.x, position.z, this.navigation)
      && forestAllowsDetection(entityId, playerId, this.entities, this.terrain, this.navigation);
  }

  private ensureMove(entityId: EntityID, playerId: number, targetX: number, targetZ: number, targetTick: number): void {
    const movement = this.entities.movements.get(entityId);
    const combat = this.entities.combat.get(entityId);
    if (!movement || !combat) return;
    if (
      movement.orderMode === 'NORMAL'
      && combat.targetEntityId === null
      && movement.targetX === targetX
      && movement.targetZ === targetZ
    ) return;
    super.enqueueCommand({ type: 'MOVE', targetTick, playerId, entityIds: [entityId], targetX, targetZ });
  }

  private ensureHold(entityId: EntityID, playerId: number, targetTick: number): void {
    const movement = this.entities.movements.get(entityId);
    const combat = this.entities.combat.get(entityId);
    if (movement?.orderMode === 'HOLD' && combat?.targetEntityId === null) return;
    super.enqueueCommand({ type: 'HOLD', targetTick, playerId, entityIds: [entityId] });
  }

  private ensureAttack(entityId: EntityID, playerId: number, targetEntityId: EntityID, targetTick: number): void {
    if (this.entities.combat.get(entityId)?.targetEntityId === targetEntityId) return;
    super.enqueueCommand({ type: 'ATTACK', targetTick, playerId, entityIds: [entityId], targetEntityId });
  }

  private regroupDestination(playerId: number, memberEntityIds: readonly EntityID[]): { x: number; z: number } | null {
    const run = this.run.snapshot();
    const core = playerId === run.playerCore.playerId ? run.playerCore : run.enemyCore;
    if (core.playerId !== playerId || core.state !== 'ACTIVE') return null;
    const first = memberEntityIds.find((entityId) => this.entities.positions.has(entityId));
    if (first === undefined) return null;
    const firstPosition = this.entities.positions.get(first)!;
    const startCell = this.navigation.worldToCell(firstPosition.x, firstPosition.z);
    const centerCell = this.navigation.worldToCell(core.x, core.z);
    const centroid = memberEntityIds.reduce((sum, entityId) => {
      const position = this.entities.positions.get(entityId);
      return position ? { x: sum.x + position.x, z: sum.z + position.z, count: sum.count + 1 } : sum;
    }, { x: 0, z: 0, count: 0 });
    const centroidX = centroid.count > 0 ? Math.round(centroid.x / centroid.count) : firstPosition.x;
    const centroidZ = centroid.count > 0 ? Math.round(centroid.z / centroid.count) : firstPosition.z;
    const radiusSquared = CORE_UNIT_HEAL_RADIUS * CORE_UNIT_HEAL_RADIUS;
    const candidates: Array<{ x: number; z: number; distanceSquared: number; coreDistanceSquared: number; row: number; column: number }> = [];

    for (let radius = 1; radius <= 12; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== radius) continue;
          const cell = { column: centerCell.column + columnOffset, row: centerCell.row + rowOffset };
          if (!this.navigation.isWalkable(cell)) continue;
          const point = this.navigation.cellToWorld(cell);
          const coreDx = point.x - core.x;
          const coreDz = point.z - core.z;
          const coreDistanceSquared = coreDx * coreDx + coreDz * coreDz;
          if (coreDistanceSquared > radiusSquared) continue;
          if (!this.navigation.findPath(startCell, cell)) continue;
          const dx = point.x - centroidX;
          const dz = point.z - centroidZ;
          candidates.push({
            x: point.x,
            z: point.z,
            distanceSquared: dx * dx + dz * dz,
            coreDistanceSquared,
            row: cell.row,
            column: cell.column,
          });
        }
      }
    }
    candidates.sort((left, right) => (
      left.distanceSquared - right.distanceSquared
      || left.coreDistanceSquared - right.coreDistanceSquared
      || left.row - right.row
      || left.column - right.column
    ));
    const selected = candidates[0];
    return selected ? { x: selected.x, z: selected.z } : null;
  }

  private clearSquadOrdersForCommand(command: M04GameCommand): void {
    if (command.type === 'CAST' || command.type === 'CAST_TACTICAL' || command.type === 'CAST_STRATEGIC') return;
    this.squads.clearOrdersForMembers(command.playerId, command.entityIds);
  }

  private canEnqueueStrategicCommand(command: M03Command): boolean {
    if (command.type === 'CAPTURE' && command.targetPoiId !== undefined) return false;
    return true;
  }

  private processRunCommands(targetTick: number): void {
    const due = this.pendingRunCommands.filter((command) => command.targetTick <= targetTick)
      .sort((a, b) => a.targetTick - b.targetTick);
    if (due.length === 0) return;
    for (let index = this.pendingRunCommands.length - 1; index >= 0; index -= 1) {
      if ((this.pendingRunCommands[index]?.targetTick ?? Number.POSITIVE_INFINITY) <= targetTick) {
        this.pendingRunCommands.splice(index, 1);
      }
    }

    for (const command of due) {
      if (command.type !== 'ATTACK_OBJECTIVE') {
        this.clearObjectiveOrdersForCommand(command);
        this.clearSquadOrdersForCommand(command);
        continue;
      }
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
      this.squads.clearOrdersForMembers(command.playerId, validIds);
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
    let towerAvoidance: Set<string> | null = null;
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
      const towerAssault = this.run.mode === 'TOWER_DEFENSE'
        && playerId === 1
        && objective === 'PLAYER_CORE';

      // Tower Defense attackers are allowed to stop and answer local player fire.
      // Their Core objective remains stored separately and resumes after combat.
      if (towerAssault && combat.targetEntityId !== null && this.entities.hasUnit(combat.targetEntityId)) {
        continue;
      }

      if (inRange) {
        if (movement.targetX !== null || movement.targetZ !== null) {
          super.enqueueCommand({ type: 'STOP', targetTick, playerId, entityIds: [entityId] });
        }
        continue;
      }

      if (movement.targetX === null || movement.targetZ === null || movement.pathIndex >= movement.path.length) {
        if (towerAssault) {
          towerAvoidance ??= this.towerDefenseNeutralAvoidanceCells();
          const assigned = this.assignPath(entityId, target.x, target.z, towerAvoidance);
          if (!assigned) this.assignPath(entityId, target.x, target.z);
          movement.orderMode = 'ATTACK_MOVE';
          // Objective authority, not the generic ATTACK_MOVE destination, owns
          // resumption after local combat. This forces a fresh neutral-safe route.
          movement.attackMoveX = null;
          movement.attackMoveZ = null;
          combat.pursuitTargetCellKey = null;
          continue;
        }
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

    // Remove only objective intents previously owned by Enemy War. Explicit RUN
    // orders remain authoritative until replaced by an external command.
    for (const entityId of this.aiObjectiveAttackIds) {
      if (this.objectiveAttackOrders.get(entityId) === 'PLAYER_CORE') {
        this.objectiveAttackOrders.delete(entityId);
      }
    }
    this.aiObjectiveAttackIds.clear();
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
    for (const entityId of enemyIds) {
      this.objectiveAttackOrders.set(entityId, 'PLAYER_CORE');
      this.aiObjectiveAttackIds.add(entityId);
    }
    super.enqueueCommand({
      type: 'MOVE',
      targetTick,
      playerId: 1,
      entityIds: enemyIds,
      targetX: target.x,
      targetZ: target.z,
    });
  }

  private spawnTowerDefenseWave(wave: number): void {
    const spawn = this.generatedWorld.spawns.find((candidate) => candidate.id === 'ENEMY');
    if (!spawn) return;
    const start = this.navigation.resolveWalkableTarget({ column: spawn.cell.x, row: spawn.cell.z });
    if (!start) return;
    const composition: readonly UnitArchetype[] = wave < 3
      ? ['VANGUARD', 'VANGUARD', 'RANGER']
      : wave < 5
        ? ['VANGUARD', 'VANGUARD', 'RANGER', 'RANGER', 'SPEAR_GUARD']
        : ['VANGUARD', 'VANGUARD', 'RANGER', 'RANGER', 'SPEAR_GUARD', 'GOLEM'];
    const count = composition.length + Math.floor(wave / 2);
    const ids: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const archetype = composition[index % composition.length]!;
      const cell = this.navigation.resolveWalkableTarget({
        column: start.column + ((index % 3) - 1) * 2,
        row: start.row + (Math.floor(index / 3) + 1) * 2,
      }) ?? start;
      const position = this.navigation.cellToWorld(cell);
      ids.push(this.entities.createUnit({ archetype, playerId: 1, x: position.x, z: position.z, ...UNITS[archetype].spawn }));
    }
    for (const entityId of ids) this.objectiveAttackOrders.set(entityId, 'PLAYER_CORE');
  }

  private syncTowerDefenseObjectiveIntent(): void {
    const ids = this.entities.entityIds().filter((entityId) => (
      this.entities.hasUnit(entityId)
      && this.entities.factions.get(entityId)?.playerId === 1
      && this.entities.health.get(entityId)?.alive === true
    )).sort((a, b) => a - b);
    for (const entityId of ids) this.objectiveAttackOrders.set(entityId, 'PLAYER_CORE');
  }

  private towerDefenseNeutralAvoidanceCells(): Set<string> {
    const avoided = new Set<string>();
    const radius = NEUTRAL_CAMP_AGGRO_RADIUS + WORLD_UNITS_PER_METER;
    const radiusSquared = radius * radius;
    const radiusCells = Math.ceil(radius / this.navigation.definition.cellSize);
    for (const camp of this.neutralEncounters.snapshot().camps) {
      if (camp.cleared || camp.aliveGuardianCount === 0) continue;
      for (const guardianId of camp.guardianEntityIds) {
        if (!this.entities.hasUnit(guardianId)) continue;
        const guardian = this.entities.positions.get(guardianId);
        if (!guardian) continue;
        const center = this.navigation.worldToCell(guardian.x, guardian.z);
        for (let row = center.row - radiusCells; row <= center.row + radiusCells; row += 1) {
          for (let column = center.column - radiusCells; column <= center.column + radiusCells; column += 1) {
            const cell = { column, row };
            if (!this.navigation.isWalkable(cell)) continue;
            const point = this.navigation.cellToWorld(cell);
            const dx = point.x - guardian.x;
            const dz = point.z - guardian.z;
            if (dx * dx + dz * dz <= radiusSquared) avoided.add(this.navigation.cellKey(cell));
          }
        }
      }
    }
    return avoided;
  }

  private applyCoreHealing(currentTick: number): void {
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

        const pulsePhase = entityId % CORE_UNIT_HEAL_INTERVAL_TICKS;
        if (currentTick % CORE_UNIT_HEAL_INTERVAL_TICKS !== pulsePhase) continue;
        const pulseOrdinal = Math.floor((currentTick - pulsePhase) / CORE_UNIT_HEAL_INTERVAL_TICKS);
        const priorCumulative = Math.floor(
          (pulseOrdinal * health.max * CORE_UNIT_HEAL_PERMILLE_PER_PULSE) / 1000,
        );
        const nextCumulative = Math.floor(
          ((pulseOrdinal + 1) * health.max * CORE_UNIT_HEAL_PERMILLE_PER_PULSE) / 1000,
        );
        const amount = nextCumulative - priorCumulative;
        if (amount <= 0) continue;
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
      .filter(([entityId, objective]) => !(
        this.run.mode === 'TOWER_DEFENSE'
        && objective === 'PLAYER_CORE'
        && this.entities.factions.get(entityId)?.playerId === 1
        && this.entities.combat.get(entityId)?.targetEntityId !== null
      ))
      .map(([entityId, objective]) => ({ entityId, objective }))
      .sort((left, right) => left.entityId - right.entityId || left.objective.localeCompare(right.objective));
  }

  private clearObjectiveOrdersForCommand(command: M04GameCommand): void {
    if (command.type === 'CAST' || command.type === 'CAST_TACTICAL' || command.type === 'CAST_STRATEGIC') return;
    for (const entityId of command.entityIds) {
      if (this.entities.factions.get(entityId)?.playerId === command.playerId) this.objectiveAttackOrders.delete(entityId);
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
    if (entry.channel === 'ROGUELITE') return { channel: 'ROGUELITE', command: cloneRogueliteCommand(entry.command) };
    if (entry.channel === 'SQUAD') return { channel: 'SQUAD', command: cloneSquadCommand(entry.command) };
    return { channel: 'RUN', command: cloneRunCommand(entry.command) };
  }
}
