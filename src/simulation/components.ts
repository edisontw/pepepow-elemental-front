export type EntityID = number;
export type PlayerID = number;

export interface PositionComponent {
  x: number;
  z: number;
}

export interface MovementComponent {
  speedPerTick: number;
  targetX: number | null;
  targetZ: number | null;
  path: readonly NavigationPoint[];
  pathIndex: number;
  pathNavVersion: number;
}

export interface NavigationPoint {
  x: number;
  z: number;
}

export interface HealthComponent {
  current: number;
  max: number;
  alive: boolean;
}

export interface StatusComponent {
  wet: boolean;
}

export interface CombatComponent {
  attackDamage: number;
  attackIntervalTicks: number;
  attackRange: number;
  nextAttackTick: number;
  targetEntityId: EntityID | null;
  pursuitTargetCellKey: string | null;
}

export interface FactionComponent {
  playerId: PlayerID;
}

export interface SelectableComponent {
  radius: number;
}

export interface UnitSpawn {
  archetype: 'VANGUARD' | 'RANGER';
  playerId: PlayerID;
  x: number;
  z: number;
  speedPerTick: number;
  selectionRadius: number;
  maxHealth: number;
  attackDamage: number;
  attackIntervalTicks: number;
  attackRange: number;
}
