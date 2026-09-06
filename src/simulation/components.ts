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
}

export interface FactionComponent {
  playerId: PlayerID;
}

export interface SelectableComponent {
  radius: number;
}

export interface UnitSpawn {
  playerId: PlayerID;
  x: number;
  z: number;
  speedPerTick: number;
  selectionRadius: number;
}
