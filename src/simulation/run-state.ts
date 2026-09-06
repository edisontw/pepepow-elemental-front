import type { EntityStore } from './entity-store';
import type { RogueliteSnapshot } from './roguelite-state';
import type { StrategicSnapshot } from './strategic-state';
import {
  BOSS_BODY_RADIUS,
  BOSS_DEFINITIONS,
  CORE_ARMOR,
  CORE_CRITICAL_TICKS,
  CORE_MAX_HEALTH,
  CORE_RECOVERY_HEALTH,
  ENGINEER_REPAIR_PER_TICK,
  ENGINEER_REPAIR_RADIUS,
  MIN_EARLY_FINALE_TICK,
  STRUCTURE_BODY_RADIUS,
  bossTypeForSeed,
  finaleUnlockTick,
  phaseForTick,
  type BossType,
  type CoreState,
  type FinaleUnlockReason,
  type RunMode,
  type RunOutcome,
  type RunPace,
  type RunPhase,
} from './m06-content';
import { worldCellToSimulationPosition } from '../world/world-arena';
import type { GeneratedWorld } from '../world/world-definition';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export type RunResultReason = 'ENEMY_CORE_DESTROYED' | 'BOSS_DEFEATED' | 'PLAYER_CORE_DESTROYED';

export interface CoreObjectiveSnapshot {
  playerId: number;
  x: number;
  z: number;
  currentHealth: number;
  maxHealth: number;
  state: CoreState;
  criticalUsed: boolean;
  criticalTicksRemaining: number;
}

export interface BossObjectiveSnapshot {
  type: BossType;
  label: string;
  x: number;
  z: number;
  currentHealth: number;
  maxHealth: number;
  active: boolean;
  lastAbilityTick: number;
}

export interface ScoreBreakdown {
  victory: number;
  time: number;
  armySurvival: number;
  territory: number;
  objectives: number;
  resourceEfficiency: number;
  elementalStyle: number;
  total: number;
}

export interface RunResultSnapshot {
  outcome: Exclude<RunOutcome, 'IN_PROGRESS'>;
  reason: RunResultReason;
  completedTick: number;
  durationSeconds: number;
  score: ScoreBreakdown;
}

export interface RunPressureSnapshot {
  playerCoreAttackers: number;
  enemyCoreAttackers: number;
  bossAttackers: number;
  repairingEngineers: number;
}

export interface RunSnapshot {
  stateHash: string;
  mode: RunMode;
  pace: RunPace;
  phase: RunPhase;
  outcome: RunOutcome;
  finaleUnlocked: boolean;
  finaleUnlockedTick: number | null;
  finaleUnlockReason: FinaleUnlockReason | null;
  playerCore: CoreObjectiveSnapshot;
  enemyCore: CoreObjectiveSnapshot;
  boss: BossObjectiveSnapshot;
  pressure: RunPressureSnapshot;
  result: RunResultSnapshot | null;
}

export interface BossAbilityIntent {
  bossType: BossType;
  targetEntityId: number;
  targetX: number;
  targetZ: number;
  radius: number;
}

interface MutableCoreState extends CoreObjectiveSnapshot {}
interface MutableBossState extends BossObjectiveSnapshot {}

interface AssaultResult {
  damage: number;
  attackers: number;
}

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function hashString(hash: number, value: string): number {
  let result = hashInteger(hash, value.length);
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function armoredDamage(rawDamage: number, armor: number): number {
  if (rawDamage <= 0) return 0;
  return Math.max(1, Math.floor((rawDamage * 100) / (100 + armor)));
}

export class RunState {
  private phase: RunPhase = 'DISCOVERY';
  private outcome: RunOutcome = 'IN_PROGRESS';
  private finaleUnlocked = false;
  private finaleUnlockedTick: number | null = null;
  private finaleUnlockReason: FinaleUnlockReason | null = null;
  private result: RunResultSnapshot | null = null;
  private readonly playerCore: MutableCoreState;
  private readonly enemyCore: MutableCoreState;
  private readonly boss: MutableBossState;
  private pressure: RunPressureSnapshot = {
    playerCoreAttackers: 0,
    enemyCoreAttackers: 0,
    bossAttackers: 0,
    repairingEngineers: 0,
  };

  constructor(
    readonly world: GeneratedWorld,
    readonly mode: RunMode = 'DESTROY',
    readonly pace: RunPace = 'STANDARD',
  ) {
    const playerSpawn = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    const enemySpawn = world.spawns.find((spawn) => spawn.id === 'ENEMY');
    if (!playerSpawn || !enemySpawn) throw new Error('M06 requires deterministic player and enemy spawns.');
    const playerPosition = worldCellToSimulationPosition(world, playerSpawn.cell);
    const enemyPosition = worldCellToSimulationPosition(world, enemySpawn.cell);
    const bossPosition = worldCellToSimulationPosition(world, world.boss.cell);
    const bossDefinition = BOSS_DEFINITIONS[bossTypeForSeed(world.identity.masterSeed)];
    this.playerCore = {
      playerId: 0,
      x: playerPosition.x,
      z: playerPosition.z,
      currentHealth: CORE_MAX_HEALTH,
      maxHealth: CORE_MAX_HEALTH,
      state: 'ACTIVE',
      criticalUsed: false,
      criticalTicksRemaining: 0,
    };
    this.enemyCore = {
      playerId: 1,
      x: enemyPosition.x,
      z: enemyPosition.z,
      currentHealth: CORE_MAX_HEALTH,
      maxHealth: CORE_MAX_HEALTH,
      state: 'ACTIVE',
      criticalUsed: false,
      criticalTicksRemaining: 0,
    };
    this.boss = {
      type: bossDefinition.id,
      label: bossDefinition.label,
      x: bossPosition.x,
      z: bossPosition.z,
      currentHealth: bossDefinition.maxHealth,
      maxHealth: bossDefinition.maxHealth,
      active: false,
      lastAbilityTick: 0,
    };
  }

  advance(
    tick: number,
    entities: EntityStore,
    strategic: StrategicSnapshot,
    roguelite: RogueliteSnapshot,
  ): BossAbilityIntent | null {
    if (this.outcome !== 'IN_PROGRESS') return null;
    this.phase = phaseForTick(tick, this.pace);
    this.updateFinaleGate(tick, strategic, roguelite);

    const playerCoreAssault = this.objectiveAssault(
      entities,
      1,
      this.playerCore.x,
      this.playerCore.z,
      STRUCTURE_BODY_RADIUS,
      tick,
      true,
    );
    this.pressure = { ...this.pressure, playerCoreAttackers: playerCoreAssault.attackers };
    if (this.playerCore.state === 'ACTIVE' && playerCoreAssault.damage > 0) {
      this.damagePlayerCore(armoredDamage(playerCoreAssault.damage, CORE_ARMOR), tick, strategic, roguelite);
      if (this.outcome !== 'IN_PROGRESS') return null;
    }

    if (this.playerCore.state === 'CRITICAL') {
      const repairingEngineers = this.repairingEngineerCount(entities);
      this.pressure = { ...this.pressure, repairingEngineers };
      if (repairingEngineers > 0) {
        this.playerCore.currentHealth = Math.min(
          CORE_RECOVERY_HEALTH,
          this.playerCore.currentHealth + repairingEngineers * ENGINEER_REPAIR_PER_TICK,
        );
      }
      if (this.playerCore.currentHealth >= CORE_RECOVERY_HEALTH) {
        this.playerCore.currentHealth = CORE_RECOVERY_HEALTH;
        this.playerCore.state = 'ACTIVE';
        this.playerCore.criticalTicksRemaining = 0;
      } else {
        this.playerCore.criticalTicksRemaining = Math.max(0, this.playerCore.criticalTicksRemaining - 1);
        if (this.playerCore.criticalTicksRemaining === 0) {
          this.playerCore.state = 'DESTROYED';
          this.finish('DEFEAT', 'PLAYER_CORE_DESTROYED', tick, strategic, roguelite, entities);
          return null;
        }
      }
    } else {
      this.pressure = { ...this.pressure, repairingEngineers: 0 };
    }

    if (this.mode === 'DESTROY' && this.finaleUnlocked) {
      const enemyCoreAssault = this.objectiveAssault(
        entities,
        0,
        this.enemyCore.x,
        this.enemyCore.z,
        STRUCTURE_BODY_RADIUS,
        tick,
        true,
      );
      this.pressure = { ...this.pressure, enemyCoreAttackers: enemyCoreAssault.attackers, bossAttackers: 0 };
      if (enemyCoreAssault.damage > 0) {
        this.enemyCore.currentHealth = Math.max(
          0,
          this.enemyCore.currentHealth - armoredDamage(enemyCoreAssault.damage, CORE_ARMOR),
        );
      }
      if (this.enemyCore.currentHealth === 0) {
        this.enemyCore.state = 'DESTROYED';
        this.finish('VICTORY', 'ENEMY_CORE_DESTROYED', tick, strategic, roguelite, entities);
      }
      return null;
    }

    if (this.mode !== 'BOSS_HUNT' || !this.finaleUnlocked) {
      this.pressure = { ...this.pressure, enemyCoreAttackers: 0, bossAttackers: 0 };
      return null;
    }

    this.boss.active = true;
    const bossDefinition = BOSS_DEFINITIONS[this.boss.type];
    const bossAssault = this.objectiveAssault(
      entities,
      0,
      this.boss.x,
      this.boss.z,
      BOSS_BODY_RADIUS,
      tick,
      false,
    );
    this.pressure = { ...this.pressure, enemyCoreAttackers: 0, bossAttackers: bossAssault.attackers };
    if (bossAssault.damage > 0) {
      this.boss.currentHealth = Math.max(
        0,
        this.boss.currentHealth - armoredDamage(bossAssault.damage, bossDefinition.armor),
      );
    }
    if (this.boss.currentHealth === 0) {
      this.boss.active = false;
      this.finish('VICTORY', 'BOSS_DEFEATED', tick, strategic, roguelite, entities);
      return null;
    }

    if (this.finaleUnlockedTick === null || tick - this.finaleUnlockedTick < bossDefinition.abilityIntervalTicks) return null;
    if ((tick - this.finaleUnlockedTick) % bossDefinition.abilityIntervalTicks !== 0) return null;
    const target = this.closestLivingUnit(entities, 0, this.boss.x, this.boss.z);
    if (!target) return null;
    this.boss.lastAbilityTick = tick;
    return {
      bossType: this.boss.type,
      targetEntityId: target.id,
      targetX: target.x,
      targetZ: target.z,
      radius: bossDefinition.battlefieldRadius,
    };
  }

  snapshot(): RunSnapshot {
    const snapshotWithoutHash = {
      mode: this.mode,
      pace: this.pace,
      phase: this.outcome === 'IN_PROGRESS' ? this.phase : 'COMPLETE' as const,
      outcome: this.outcome,
      finaleUnlocked: this.finaleUnlocked,
      finaleUnlockedTick: this.finaleUnlockedTick,
      finaleUnlockReason: this.finaleUnlockReason,
      playerCore: { ...this.playerCore },
      enemyCore: { ...this.enemyCore },
      boss: { ...this.boss },
      pressure: { ...this.pressure },
      result: this.result === null ? null : {
        ...this.result,
        score: { ...this.result.score },
      },
    };
    return { stateHash: this.computeHash(snapshotWithoutHash), ...snapshotWithoutHash };
  }

  private updateFinaleGate(tick: number, strategic: StrategicSnapshot, roguelite: RogueliteSnapshot): void {
    if (this.finaleUnlocked) return;
    const autoTick = finaleUnlockTick(this.pace);
    const momentumReady = this.pace === 'STANDARD'
      && tick >= MIN_EARLY_FINALE_TICK
      && strategic.regionOwners.filter((owner) => owner === 0).length >= 3
      && (roguelite.players[0]?.resolvedShrineIds.length ?? 0) >= 2
      && strategic.buildings.filter((building) => (
        building.playerId === 0 && building.completed && building.type !== 'ELEMENTAL_CORE'
      )).length >= 2;
    if (!momentumReady && tick < autoTick) return;
    this.finaleUnlocked = true;
    this.finaleUnlockedTick = tick;
    this.finaleUnlockReason = momentumReady ? 'MOMENTUM' : 'TIME';
    this.phase = 'FINALE';
    if (this.mode === 'BOSS_HUNT') this.boss.active = true;
  }

  private damagePlayerCore(
    damage: number,
    tick: number,
    strategic: StrategicSnapshot,
    roguelite: RogueliteSnapshot,
  ): void {
    this.playerCore.currentHealth = Math.max(0, this.playerCore.currentHealth - damage);
    if (this.playerCore.currentHealth > 0) return;
    if (!this.playerCore.criticalUsed) {
      this.playerCore.criticalUsed = true;
      this.playerCore.state = 'CRITICAL';
      this.playerCore.criticalTicksRemaining = CORE_CRITICAL_TICKS;
      return;
    }
    this.playerCore.state = 'DESTROYED';
    this.finish('DEFEAT', 'PLAYER_CORE_DESTROYED', tick, strategic, roguelite, null);
  }

  private objectiveAssault(
    entities: EntityStore,
    attackerPlayerId: number,
    targetX: number,
    targetZ: number,
    bodyRadius: number,
    tick: number,
    structureTarget: boolean,
  ): AssaultResult {
    let damage = 0;
    let attackers = 0;
    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId) || entities.factions.get(entityId)?.playerId !== attackerPlayerId) continue;
      const health = entities.health.get(entityId);
      const position = entities.positions.get(entityId);
      const combat = entities.combat.get(entityId);
      const archetype = entities.archetypes.get(entityId);
      if (!health?.alive || !position || !combat || !archetype) continue;
      const range = bodyRadius + combat.attackRange;
      const dx = position.x - targetX;
      const dz = position.z - targetZ;
      if (dx * dx + dz * dz > range * range) continue;
      attackers += 1;
      if (tick % combat.attackIntervalTicks !== entityId % combat.attackIntervalTicks) continue;
      const multiplier = archetype === 'SIEGE_CONSTRUCT' ? (structureTarget ? 4 : 2) : 1;
      damage += combat.attackDamage * multiplier;
    }
    return { damage, attackers };
  }

  private repairingEngineerCount(entities: EntityStore): number {
    let count = 0;
    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId) || entities.factions.get(entityId)?.playerId !== 0) continue;
      if (entities.archetypes.get(entityId) !== 'ENGINEER' || entities.health.get(entityId)?.alive !== true) continue;
      const position = entities.positions.get(entityId);
      if (!position) continue;
      const dx = position.x - this.playerCore.x;
      const dz = position.z - this.playerCore.z;
      if (dx * dx + dz * dz <= ENGINEER_REPAIR_RADIUS * ENGINEER_REPAIR_RADIUS) count += 1;
    }
    return count;
  }

  private closestLivingUnit(
    entities: EntityStore,
    playerId: number,
    x: number,
    z: number,
  ): { id: number; x: number; z: number } | null {
    let best: { id: number; x: number; z: number; distanceSquared: number } | null = null;
    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId) || entities.factions.get(entityId)?.playerId !== playerId) continue;
      if (entities.health.get(entityId)?.alive !== true) continue;
      const position = entities.positions.get(entityId);
      if (!position) continue;
      const dx = position.x - x;
      const dz = position.z - z;
      const distanceSquared = dx * dx + dz * dz;
      if (best === null || distanceSquared < best.distanceSquared || (distanceSquared === best.distanceSquared && entityId < best.id)) {
        best = { id: entityId, x: position.x, z: position.z, distanceSquared };
      }
    }
    return best === null ? null : { id: best.id, x: best.x, z: best.z };
  }

  private finish(
    outcome: Exclude<RunOutcome, 'IN_PROGRESS'>,
    reason: RunResultReason,
    tick: number,
    strategic: StrategicSnapshot,
    roguelite: RogueliteSnapshot,
    entities: EntityStore | null,
  ): void {
    if (this.outcome !== 'IN_PROGRESS') return;
    this.outcome = outcome;
    this.phase = 'COMPLETE';
    this.result = {
      outcome,
      reason,
      completedTick: tick,
      durationSeconds: Math.floor(tick / 10),
      score: this.computeScore(outcome, tick, strategic, roguelite, entities),
    };
  }

  private computeScore(
    outcome: Exclude<RunOutcome, 'IN_PROGRESS'>,
    tick: number,
    strategic: StrategicSnapshot,
    roguelite: RogueliteSnapshot,
    entities: EntityStore | null,
  ): ScoreBreakdown {
    const victory = outcome === 'VICTORY' ? 10_000 : 0;
    const time = outcome === 'VICTORY'
      ? Math.max(0, 5_000 - Math.floor((Math.max(0, tick - 12_000) * 5_000) / 12_000))
      : 0;
    const alivePlayerUnits = entities === null
      ? 0
      : entities.entityIds().filter((entityId) => (
        entities.hasUnit(entityId)
        && entities.factions.get(entityId)?.playerId === 0
        && entities.health.get(entityId)?.alive === true
      )).length;
    const armySurvival = Math.min(4_000, alivePlayerUnits * 200);
    const ownedRegions = strategic.regionOwners.filter((owner) => owner === 0).length;
    const territory = Math.min(3_000, Math.floor((ownedRegions * 3_000) / Math.max(1, strategic.regionOwners.length)));
    const playerRoguelite = roguelite.players[0];
    const resolvedShrines = playerRoguelite?.resolvedShrineIds.length ?? 0;
    const objectives = Math.min(3_000, resolvedShrines * 450 + (outcome === 'VICTORY' ? 750 : 0));
    const suppliedRegions = strategic.suppliedRegions[0]?.length ?? 0;
    const completedBuildings = strategic.buildings.filter((building) => building.playerId === 0 && building.completed).length;
    const resourceEfficiency = Math.min(2_000, suppliedRegions * 250 + completedBuildings * 100);
    const tagCounts = playerRoguelite?.tagCounts;
    const tagDiversity = tagCounts === undefined
      ? 0
      : (['FIRE', 'WATER', 'ICE', 'LIGHTNING'] as const).filter((tag) => tagCounts[tag] > 0).length;
    const elementalStyle = Math.min(3_000, (playerRoguelite?.synergies.length ?? 0) * 600 + tagDiversity * 300);
    return {
      victory,
      time,
      armySurvival,
      territory,
      objectives,
      resourceEfficiency,
      elementalStyle,
      total: victory + time + armySurvival + territory + objectives + resourceEfficiency + elementalStyle,
    };
  }

  private computeHash(snapshot: Omit<RunSnapshot, 'stateHash'>): string {
    let hash = FNV_OFFSET;
    hash = hashString(hash, snapshot.mode);
    hash = hashString(hash, snapshot.pace);
    hash = hashString(hash, snapshot.phase);
    hash = hashString(hash, snapshot.outcome);
    hash = hashInteger(hash, snapshot.finaleUnlocked ? 1 : 0);
    hash = hashInteger(hash, snapshot.finaleUnlockedTick ?? -1);
    hash = hashString(hash, snapshot.finaleUnlockReason ?? '');
    for (const core of [snapshot.playerCore, snapshot.enemyCore]) {
      hash = hashInteger(hash, core.playerId);
      hash = hashInteger(hash, core.x);
      hash = hashInteger(hash, core.z);
      hash = hashInteger(hash, core.currentHealth);
      hash = hashString(hash, core.state);
      hash = hashInteger(hash, core.criticalUsed ? 1 : 0);
      hash = hashInteger(hash, core.criticalTicksRemaining);
    }
    hash = hashString(hash, snapshot.boss.type);
    hash = hashInteger(hash, snapshot.boss.x);
    hash = hashInteger(hash, snapshot.boss.z);
    hash = hashInteger(hash, snapshot.boss.currentHealth);
    hash = hashInteger(hash, snapshot.boss.active ? 1 : 0);
    hash = hashInteger(hash, snapshot.boss.lastAbilityTick);
    hash = hashInteger(hash, snapshot.pressure.playerCoreAttackers);
    hash = hashInteger(hash, snapshot.pressure.enemyCoreAttackers);
    hash = hashInteger(hash, snapshot.pressure.bossAttackers);
    hash = hashInteger(hash, snapshot.pressure.repairingEngineers);
    if (snapshot.result) {
      hash = hashString(hash, snapshot.result.outcome);
      hash = hashString(hash, snapshot.result.reason);
      hash = hashInteger(hash, snapshot.result.completedTick);
      hash = hashInteger(hash, snapshot.result.score.total);
      for (const value of Object.values(snapshot.result.score)) hash = hashInteger(hash, value);
    }
    return hash.toString(16).padStart(8, '0');
  }
}
