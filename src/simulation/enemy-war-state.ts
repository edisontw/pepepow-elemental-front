import type { GameCommand } from './commands';
import type { EntityID, UnitArchetype } from './components';
import type { EntityStore } from './entity-store';
import type { M03Command } from './m03-commands';
import type { NavigationGrid } from './navigation';
import type { StrategicSnapshot } from './strategic-state';
import type { VisibilityState } from './visibility-state';
import {
  ENEMY_DIFFICULTIES,
  ENEMY_FACTIONS,
  scoreEnemyActions,
  type EnemyDifficulty,
  type EnemyFaction,
  type EnemyUtilityContext,
  type StrategicAiAction,
} from './m05-content';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

const ENEMY_PLAYER_ID = 1;
const PLAYER_ID = 0;
const MEMORY_CONFIDENCE_MAX = 1000;
const RECOVERY_WINDOW_TICKS = 600;
const ANTI_TURTLE_TICKS = 3000;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const UNIT_STRENGTH: Readonly<Record<UnitArchetype, number>> = {
  VANGUARD: 100,
  SPEAR_GUARD: 135,
  RANGER: 105,
  SCOUT: 60,
  ELEMENTALIST: 125,
  ENGINEER: 70,
  GOLEM: 320,
  SIEGE_CONSTRUCT: 260,
};

const ACTION_ORDER: readonly StrategicAiAction[] = [
  'DEFEND',
  'REGROUP',
  'ATTACK',
  'RAID',
  'CONTEST_POI',
  'EXPAND',
  'SCOUT',
];

export interface LastKnownPlayerUnit {
  entityId: EntityID;
  archetype: UnitArchetype;
  x: number;
  z: number;
  regionId: number;
  lastSeenTick: number;
  confidencePermille: number;
  strength: number;
}

export interface EnemyDirectorSnapshot {
  pressure: number;
  recoveryActive: boolean;
  recoveryUntilTick: number;
  antiTurtleActive: boolean;
  lastObservedPlayerRegionChangeTick: number;
}

export interface EnemyDecisionSnapshot {
  action: StrategicAiAction;
  targetRegionId: number | null;
  targetPoiId: string | null;
  targetEntityId: number | null;
  score: number;
  tick: number;
}

export interface EnemyWarSnapshot {
  stateHash: string;
  faction: EnemyFaction;
  difficulty: EnemyDifficulty;
  currentDecision: EnemyDecisionSnapshot | null;
  actionScores: Readonly<Record<StrategicAiAction, number>>;
  lastKnownPlayerUnits: readonly LastKnownPlayerUnit[];
  visiblePlayerEntityIds: readonly number[];
  knownRegionOwners: readonly { regionId: number; owner: number }[];
  knownPlayerSuppliedRegions: readonly number[];
  knownPoiOwners: readonly { poiId: string; owner: number }[];
  director: EnemyDirectorSnapshot;
  decisionCount: number;
}

export interface EnemyCommandSink {
  enqueueCommand(command: GameCommand): void;
  enqueueStrategicCommand(command: M03Command): void;
}

interface DecisionTarget {
  regionId: number | null;
  poiId: string | null;
  entityId: number | null;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function enemyFactionForWorld(world: GeneratedWorld): EnemyFaction {
  const factions: readonly EnemyFaction[] = ['IRON_LEGION', 'FLAME_CULT', 'WILD_HORDE'];
  return factions[Math.abs(world.identity.blockHeight) % factions.length] ?? 'IRON_LEGION';
}

export class EnemyWarState {
  private readonly memory = new Map<EntityID, LastKnownPlayerUnit>();
  private readonly visiblePlayerEntityIds = new Set<EntityID>();
  private readonly knownRegionOwners = new Map<number, number>();
  private readonly knownPlayerSuppliedRegions = new Set<number>();
  private readonly knownPoiOwners = new Map<string, number>();
  private readonly knownPlayerBuildingRegions = new Set<number>();
  private currentDecision: EnemyDecisionSnapshot | null = null;
  private actionScores: Record<StrategicAiAction, number> = {
    SCOUT: 0,
    EXPAND: 0,
    DEFEND: 0,
    RAID: 0,
    ATTACK: 0,
    CONTEST_POI: 0,
    REGROUP: 0,
  };
  private nextDecisionTick = 1;
  private decisionCount = 0;
  private recoveryUntilTick = 0;
  private observedPlayerStrengthPeak = 0;
  private observedPlayerCasualtyStrength = 0;
  private lastObservedPlayerRegion: number | null = null;
  private lastObservedPlayerRegionChangeTick = 0;
  private directorPressure = 15;
  private antiTurtleActive = false;

  readonly faction: EnemyFaction;
  readonly difficulty: EnemyDifficulty;

  constructor(
    readonly world: GeneratedWorld,
    private readonly entities: EntityStore,
    private readonly navigation: NavigationGrid,
    private readonly visibility: VisibilityState,
    faction: EnemyFaction = enemyFactionForWorld(world),
    difficulty: EnemyDifficulty = 'STANDARD',
  ) {
    this.faction = faction;
    this.difficulty = difficulty;
    const enemySpawn = world.spawns.find((spawn) => spawn.id === 'ENEMY');
    if (enemySpawn) this.knownRegionOwners.set(enemySpawn.regionId, ENEMY_PLAYER_ID);
  }

  advance(tick: number, strategic: StrategicSnapshot, sink: EnemyCommandSink): void {
    this.observe(tick, strategic);
    this.updateDirector(tick);
    if (tick < this.nextDecisionTick) return;

    const difficulty = ENEMY_DIFFICULTIES[this.difficulty];
    this.decayMemory(difficulty.memoryDecayPerDecision);
    const context = this.utilityContext(strategic);
    this.actionScores = { ...scoreEnemyActions(context, ENEMY_FACTIONS[this.faction]) };
    const action = this.chooseAction(difficulty.minimumActionScore);
    const target = this.chooseTarget(action, strategic);
    const score = this.actionScores[action];
    this.currentDecision = {
      action,
      targetRegionId: target.regionId,
      targetPoiId: target.poiId,
      targetEntityId: target.entityId,
      score,
      tick,
    };
    this.executeDecision(tick, action, target, sink);
    this.decisionCount += 1;
    this.nextDecisionTick = tick + difficulty.decisionIntervalTicks;
  }

  snapshot(): EnemyWarSnapshot {
    const lastKnownPlayerUnits = [...this.memory.values()]
      .sort((left, right) => left.entityId - right.entityId)
      .map((entry) => ({ ...entry }));
    const knownRegionOwners = [...this.knownRegionOwners.entries()]
      .sort(([left], [right]) => left - right)
      .map(([regionId, owner]) => ({ regionId, owner }));
    const knownPoiOwners = [...this.knownPoiOwners.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([poiId, owner]) => ({ poiId, owner }));
    const director: EnemyDirectorSnapshot = {
      pressure: this.directorPressure,
      recoveryActive: this.recoveryUntilTick > 0,
      recoveryUntilTick: this.recoveryUntilTick,
      antiTurtleActive: this.antiTurtleActive,
      lastObservedPlayerRegionChangeTick: this.lastObservedPlayerRegionChangeTick,
    };
    const withoutHash = {
      faction: this.faction,
      difficulty: this.difficulty,
      currentDecision: this.currentDecision ? { ...this.currentDecision } : null,
      actionScores: { ...this.actionScores },
      lastKnownPlayerUnits,
      visiblePlayerEntityIds: [...this.visiblePlayerEntityIds].sort((a, b) => a - b),
      knownRegionOwners,
      knownPlayerSuppliedRegions: [...this.knownPlayerSuppliedRegions].sort((a, b) => a - b),
      knownPoiOwners,
      director,
      decisionCount: this.decisionCount,
    };
    return { stateHash: this.computeHash(withoutHash), ...withoutHash };
  }

  private observe(tick: number, strategic: StrategicSnapshot): void {
    this.visiblePlayerEntityIds.clear();
    let visibleStrength = 0;
    const visibleRegions: number[] = [];

    for (const entityId of this.entities.entityIds()) {
      if (!this.entities.hasUnit(entityId) || this.entities.factions.get(entityId)?.playerId !== PLAYER_ID) continue;
      const position = this.entities.positions.get(entityId);
      const archetype = this.entities.archetypes.get(entityId);
      if (!position || !archetype || !this.visibility.isWorldVisible(ENEMY_PLAYER_ID, position.x, position.z, this.navigation)) continue;
      const regionId = this.regionAt(position.x, position.z);
      const strength = UNIT_STRENGTH[archetype];
      this.visiblePlayerEntityIds.add(entityId);
      visibleStrength += strength;
      visibleRegions.push(regionId);
      this.memory.set(entityId, {
        entityId,
        archetype,
        x: position.x,
        z: position.z,
        regionId,
        lastSeenTick: tick,
        confidencePermille: MEMORY_CONFIDENCE_MAX,
        strength,
      });
    }

    for (const [entityId, memory] of [...this.memory.entries()]) {
      const alive = this.entities.hasUnit(entityId);
      if (alive) continue;
      if (this.visibility.isWorldVisible(ENEMY_PLAYER_ID, memory.x, memory.z, this.navigation)) {
        this.observedPlayerCasualtyStrength += memory.strength;
        this.memory.delete(entityId);
      }
    }

    this.observedPlayerStrengthPeak = Math.max(this.observedPlayerStrengthPeak, visibleStrength + this.observedPlayerCasualtyStrength);
    if (this.observedPlayerStrengthPeak > 0 && this.observedPlayerCasualtyStrength * 4 >= this.observedPlayerStrengthPeak) {
      this.recoveryUntilTick = Math.max(this.recoveryUntilTick, tick + RECOVERY_WINDOW_TICKS);
      this.observedPlayerCasualtyStrength = 0;
      this.observedPlayerStrengthPeak = visibleStrength;
    }

    const observedRegion = visibleRegions.sort((a, b) => a - b)[0] ?? null;
    if (observedRegion !== null && observedRegion !== this.lastObservedPlayerRegion) {
      this.lastObservedPlayerRegion = observedRegion;
      this.lastObservedPlayerRegionChangeTick = tick;
    }

    for (let regionId = 0; regionId < this.world.regions.length; regionId += 1) {
      if (strategic.regionOwners[regionId] === ENEMY_PLAYER_ID) this.knownRegionOwners.set(regionId, ENEMY_PLAYER_ID);
      const region = this.world.regions[regionId];
      if (!region) continue;
      const center = worldCellToSimulationPosition(this.world, region.center);
      if (!this.visibility.isWorldVisible(ENEMY_PLAYER_ID, center.x, center.z, this.navigation)) continue;
      const owner = strategic.regionOwners[regionId] ?? -1;
      this.knownRegionOwners.set(regionId, owner);
      if (owner === PLAYER_ID && strategic.suppliedRegions[PLAYER_ID]?.includes(regionId)) this.knownPlayerSuppliedRegions.add(regionId);
      else this.knownPlayerSuppliedRegions.delete(regionId);
    }

    this.knownPlayerBuildingRegions.clear();
    for (const building of strategic.buildings) {
      if (building.playerId !== PLAYER_ID) continue;
      if (this.visibility.isWorldVisible(ENEMY_PLAYER_ID, building.x, building.z, this.navigation)) {
        this.knownPlayerBuildingRegions.add(building.regionId);
      }
    }

    for (const poi of this.world.pois) {
      const position = worldCellToSimulationPosition(this.world, poi.cell);
      if (!this.visibility.isWorldVisible(ENEMY_PLAYER_ID, position.x, position.z, this.navigation)) continue;
      this.knownPoiOwners.set(poi.id, strategic.poiOwners[poi.id] ?? -1);
    }
  }

  private updateDirector(tick: number): void {
    const base = tick < 3000 ? 15
      : tick < 6000 ? 25
        : tick < 9000 ? 40
          : tick < 12000 ? 55
            : tick < 15000 ? 70
              : tick < 18000 ? 85
                : 95;
    const recoveryActive = tick < this.recoveryUntilTick;
    if (!recoveryActive && this.recoveryUntilTick !== 0) this.recoveryUntilTick = 0;
    this.antiTurtleActive = this.lastObservedPlayerRegion !== null
      && tick - this.lastObservedPlayerRegionChangeTick >= ANTI_TURTLE_TICKS;
    this.directorPressure = clamp(base - (recoveryActive ? 20 : 0) + (this.antiTurtleActive ? 15 : 0), 0, 100);
  }

  private decayMemory(amount: number): void {
    for (const [entityId, memory] of this.memory.entries()) {
      if (this.visiblePlayerEntityIds.has(entityId)) continue;
      memory.confidencePermille = Math.max(0, memory.confidencePermille - amount);
      if (memory.confidencePermille === 0) this.memory.delete(entityId);
    }
  }

  private utilityContext(strategic: StrategicSnapshot): EnemyUtilityContext {
    const ownStrength = this.ownEntityIds().reduce((total, entityId) => total + this.unitStrength(entityId), 0);
    const knownPlayerStrength = [...this.memory.values()].reduce(
      (total, unit) => total + Math.floor((unit.strength * unit.confidencePermille) / 1000),
      0,
    );
    const ownRegions = strategic.regionOwners.flatMap((owner, regionId) => owner === ENEMY_PLAYER_ID ? [regionId] : []);
    const neutralFrontier = this.neutralFrontierRegions(strategic);
    const threatened = this.threatenedOwnRegions(strategic);
    const contestablePois = this.contestablePois();
    const unknownRegionCount = this.world.regions.filter((region) => !this.knownRegionOwners.has(region.id)).length;
    return {
      ownStrength,
      knownPlayerStrength,
      visiblePlayerUnits: this.visiblePlayerEntityIds.size,
      ownRegionCount: ownRegions.length,
      neutralFrontierCount: neutralFrontier.length,
      threatenedOwnRegions: threatened.length,
      knownPlayerSuppliedRegions: this.knownPlayerSuppliedRegions.size,
      contestablePoiCount: contestablePois.length,
      unknownRegionCount,
      damagedArmyPermille: this.damagedArmyPermille(),
      directorPressure: this.directorPressure,
      recoveryActive: this.recoveryUntilTick > 0,
      antiTurtleActive: this.antiTurtleActive,
    };
  }

  private chooseAction(minimumScore: number): StrategicAiAction {
    let best: StrategicAiAction = 'SCOUT';
    let bestScore = -1;
    for (const action of ACTION_ORDER) {
      const score = this.actionScores[action];
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    }
    if (bestScore < minimumScore) return this.damagedArmyPermille() >= 350 ? 'REGROUP' : 'SCOUT';
    return best;
  }

  private chooseTarget(action: StrategicAiAction, strategic: StrategicSnapshot): DecisionTarget {
    if (action === 'ATTACK') {
      const visible = [...this.visiblePlayerEntityIds].sort((a, b) => a - b)[0] ?? null;
      if (visible !== null) return { regionId: this.memory.get(visible)?.regionId ?? null, poiId: null, entityId: visible };
      const remembered = [...this.memory.values()].sort((a, b) => b.confidencePermille - a.confidencePermille || a.entityId - b.entityId)[0];
      return { regionId: remembered?.regionId ?? null, poiId: null, entityId: null };
    }
    if (action === 'DEFEND') return { regionId: this.threatenedOwnRegions(strategic)[0] ?? this.enemyCoreRegion(), poiId: null, entityId: null };
    if (action === 'REGROUP') return { regionId: this.enemyCoreRegion(), poiId: null, entityId: null };
    if (action === 'EXPAND') return { regionId: this.neutralFrontierRegions(strategic)[0] ?? null, poiId: null, entityId: null };
    if (action === 'RAID') {
      const regions = [...this.knownPlayerSuppliedRegions].sort((left, right) => {
        const leftBuilding = this.knownPlayerBuildingRegions.has(left) ? 0 : 1;
        const rightBuilding = this.knownPlayerBuildingRegions.has(right) ? 0 : 1;
        return leftBuilding - rightBuilding || left - right;
      });
      return { regionId: regions[0] ?? this.bestRememberedPlayerRegion(), poiId: null, entityId: null };
    }
    if (action === 'CONTEST_POI') {
      const poi = this.contestablePois()[0];
      return { regionId: poi?.regionId ?? null, poiId: poi?.id ?? null, entityId: null };
    }
    return { regionId: this.scoutTargetRegion(strategic), poiId: null, entityId: null };
  }

  private executeDecision(tick: number, action: StrategicAiAction, target: DecisionTarget, sink: EnemyCommandSink): void {
    const entityIds = this.entitiesForAction(action);
    if (entityIds.length === 0) return;
    const targetTick = tick + 1;

    if (action === 'ATTACK' && target.entityId !== null && this.visiblePlayerEntityIds.has(target.entityId)) {
      sink.enqueueCommand({ type: 'ATTACK', targetTick, playerId: ENEMY_PLAYER_ID, entityIds, targetEntityId: target.entityId });
      return;
    }

    if (target.regionId === null) return;
    const region = this.world.regions[target.regionId];
    if (!region) return;
    const position = worldCellToSimulationPosition(this.world, region.center);
    sink.enqueueCommand({ type: 'MOVE', targetTick, playerId: ENEMY_PLAYER_ID, entityIds, targetX: position.x, targetZ: position.z });

    if (action === 'EXPAND' || action === 'RAID') {
      sink.enqueueStrategicCommand({ type: 'CAPTURE', targetTick, playerId: ENEMY_PLAYER_ID, entityIds, targetRegionId: target.regionId });
    } else if (action === 'CONTEST_POI' && target.poiId !== null) {
      sink.enqueueStrategicCommand({ type: 'CAPTURE', targetTick, playerId: ENEMY_PLAYER_ID, entityIds, targetPoiId: target.poiId });
    }
  }

  private entitiesForAction(action: StrategicAiAction): EntityID[] {
    const all = this.ownEntityIds();
    if (action === 'SCOUT') {
      const scouts = all.filter((entityId) => this.entities.archetypes.get(entityId) === 'SCOUT');
      return (scouts.length > 0 ? scouts : all).slice(0, 2);
    }
    if (action === 'RAID') {
      const preferred = ENEMY_FACTIONS[this.faction].preferredRaidArchetypes;
      const ranked = [...all].sort((left, right) => {
        const leftType = this.entities.archetypes.get(left) ?? 'VANGUARD';
        const rightType = this.entities.archetypes.get(right) ?? 'VANGUARD';
        const leftRank = preferred.indexOf(leftType);
        const rightRank = preferred.indexOf(rightType);
        return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left - right;
      });
      return ranked.slice(0, Math.min(3, ranked.length));
    }
    return all;
  }

  private ownEntityIds(): EntityID[] {
    return this.entities.entityIds().filter((entityId) => (
      this.entities.hasUnit(entityId) && this.entities.factions.get(entityId)?.playerId === ENEMY_PLAYER_ID
    ));
  }

  private unitStrength(entityId: EntityID): number {
    const archetype = this.entities.archetypes.get(entityId);
    return archetype ? UNIT_STRENGTH[archetype] : 0;
  }

  private damagedArmyPermille(): number {
    let maximum = 0;
    let missing = 0;
    for (const entityId of this.ownEntityIds()) {
      const health = this.entities.health.get(entityId);
      if (!health) continue;
      maximum += health.max;
      missing += health.max - health.current;
    }
    return maximum <= 0 ? 1000 : Math.floor((missing * 1000) / maximum);
  }

  private neutralFrontierRegions(strategic: StrategicSnapshot): number[] {
    const own = strategic.regionOwners.flatMap((owner, regionId) => owner === ENEMY_PLAYER_ID ? [regionId] : []);
    const candidates = new Set<number>();
    for (const regionId of own) {
      for (const neighbor of this.world.regions[regionId]?.neighbors ?? []) {
        if (this.knownRegionOwners.get(neighbor) === -1) candidates.add(neighbor);
      }
    }
    return [...candidates].sort((left, right) => this.regionStrategicValue(right) - this.regionStrategicValue(left) || left - right);
  }

  private threatenedOwnRegions(strategic: StrategicSnapshot): number[] {
    const threatened = new Set<number>();
    for (const memory of this.memory.values()) {
      if (memory.confidencePermille < 250) continue;
      if (strategic.regionOwners[memory.regionId] === ENEMY_PLAYER_ID) threatened.add(memory.regionId);
    }
    return [...threatened].sort((a, b) => a - b);
  }

  private contestablePois(): { id: string; regionId: number; owner: number }[] {
    return this.world.pois
      .flatMap((poi) => {
        const owner = this.knownPoiOwners.get(poi.id);
        if (owner === undefined || owner === ENEMY_PLAYER_ID) return [];
        return [{ id: poi.id, regionId: poi.regionId, owner }];
      })
      .sort((left, right) => (right.owner === PLAYER_ID ? 1 : 0) - (left.owner === PLAYER_ID ? 1 : 0) || left.id.localeCompare(right.id));
  }

  private scoutTargetRegion(strategic: StrategicSnapshot): number | null {
    const ownRegions = strategic.regionOwners.flatMap((owner, regionId) => owner === ENEMY_PLAYER_ID ? [regionId] : []);
    const frontierUnknown = new Set<number>();
    for (const regionId of ownRegions) {
      for (const neighbor of this.world.regions[regionId]?.neighbors ?? []) {
        if (!this.knownRegionOwners.has(neighbor)) frontierUnknown.add(neighbor);
      }
    }
    const frontier = [...frontierUnknown].sort((a, b) => a - b)[0];
    if (frontier !== undefined) return frontier;
    return this.world.regions.filter((region) => !this.knownRegionOwners.has(region.id)).sort((a, b) => a.id - b.id)[0]?.id ?? this.bestRememberedPlayerRegion();
  }

  private bestRememberedPlayerRegion(): number | null {
    return [...this.memory.values()]
      .sort((left, right) => right.confidencePermille - left.confidencePermille || left.regionId - right.regionId)[0]?.regionId ?? null;
  }

  private enemyCoreRegion(): number | null {
    return this.world.spawns.find((spawn) => spawn.id === 'ENEMY')?.regionId ?? null;
  }

  private regionStrategicValue(regionId: number): number {
    const resources = this.world.resources.filter((resource) => resource.regionId === regionId).length;
    const pois = this.world.pois.filter((poi) => poi.regionId === regionId).length;
    return resources * 3 + pois * 2 + (this.world.objective.regionId === regionId ? 2 : 0);
  }

  private regionAt(x: number, z: number): number {
    const cell = this.navigation.worldToCell(x, z);
    if (cell.column < 0 || cell.row < 0 || cell.column >= this.world.width || cell.row >= this.world.height) return -1;
    return this.world.regionByCell[cell.row * this.world.width + cell.column] ?? -1;
  }

  private computeHash(snapshot: Omit<EnemyWarSnapshot, 'stateHash'>): string {
    let hash = FNV_OFFSET;
    hash = hashString(hash, snapshot.faction);
    hash = hashString(hash, snapshot.difficulty);
    hash = hashInteger(hash, snapshot.decisionCount);
    hash = hashInteger(hash, snapshot.director.pressure);
    hash = hashInteger(hash, snapshot.director.recoveryActive ? 1 : 0);
    hash = hashInteger(hash, snapshot.director.recoveryUntilTick);
    hash = hashInteger(hash, snapshot.director.antiTurtleActive ? 1 : 0);
    if (snapshot.currentDecision) {
      hash = hashString(hash, snapshot.currentDecision.action);
      hash = hashInteger(hash, snapshot.currentDecision.targetRegionId ?? -1);
      hash = hashString(hash, snapshot.currentDecision.targetPoiId ?? '');
      hash = hashInteger(hash, snapshot.currentDecision.targetEntityId ?? -1);
      hash = hashInteger(hash, snapshot.currentDecision.score);
      hash = hashInteger(hash, snapshot.currentDecision.tick);
    }
    for (const action of ACTION_ORDER) hash = hashInteger(hashString(hash, action), snapshot.actionScores[action]);
    for (const unit of snapshot.lastKnownPlayerUnits) {
      hash = hashInteger(hash, unit.entityId);
      hash = hashString(hash, unit.archetype);
      hash = hashInteger(hash, unit.x);
      hash = hashInteger(hash, unit.z);
      hash = hashInteger(hash, unit.regionId);
      hash = hashInteger(hash, unit.lastSeenTick);
      hash = hashInteger(hash, unit.confidencePermille);
    }
    for (const entry of snapshot.knownRegionOwners) {
      hash = hashInteger(hash, entry.regionId);
      hash = hashInteger(hash, entry.owner);
    }
    for (const regionId of snapshot.knownPlayerSuppliedRegions) hash = hashInteger(hash, regionId);
    for (const entry of snapshot.knownPoiOwners) {
      hash = hashString(hash, entry.poiId);
      hash = hashInteger(hash, entry.owner);
    }
    return hash.toString(16).padStart(8, '0');
  }
}
