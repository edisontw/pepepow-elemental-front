import type { ArenaTraversalDefinition } from './arena';
import type { GridCell, WalkabilityChange } from './navigation';

export const NEUTRAL_TEMPERATURE = 0;
export const WATER_FREEZE_THRESHOLD = -60;
export const ICE_DURABILITY_MAX = 100;
export const FREEZE_TEMPERATURE_DELTA = -40;
export const HEAT_TEMPERATURE_DELTA = 60;
export const HEAT_ICE_DAMAGE = 50;

export const enum SurfaceType {
  GROUND = 0,
  WATER = 1,
  ICE = 2,
  BLOCKED_TERRAIN = 3,
  NATURAL_CROSSING = 4,
}

export type TerrainEffectId = 'FREEZE' | 'HEAT' | 'FIRE';

export interface TerrainEffect {
  effectId: TerrainEffectId;
  targetX: number;
  targetZ: number;
  radius: number;
}

export interface TerrainCounts {
  water: number;
  ice: number;
  freezableWater: number;
}

export class TerrainState {
  readonly surface: Uint8Array;
  readonly temperature: Int16Array;
  readonly iceDurability: Uint8Array;
  readonly freezable: Uint8Array;

  constructor(readonly definition: ArenaTraversalDefinition) {
    const cellCount = definition.columns * definition.rows;
    this.surface = new Uint8Array(cellCount);
    this.temperature = new Int16Array(cellCount);
    this.iceDurability = new Uint8Array(cellCount);
    this.freezable = new Uint8Array(cellCount);

    for (const patch of definition.patches) {
      const surface = patch.kind === 'BLOCKED_RIVER'
        ? SurfaceType.WATER
        : patch.kind === 'BLOCKED_TERRAIN'
          ? SurfaceType.BLOCKED_TERRAIN
          : patch.kind === 'NATURAL_CROSSING'
            ? SurfaceType.NATURAL_CROSSING
            : SurfaceType.GROUND;
      this.forPatch(patch, (index) => { this.surface[index] = surface; });
    }
    for (const patch of definition.freezableWaterPatches) {
      this.forPatch(patch, (index) => {
        if (this.surface[index] === SurfaceType.WATER) this.freezable[index] = 1;
      });
    }
  }

  surfaceAt(cell: GridCell): SurfaceType | null {
    return this.inBounds(cell) ? this.surface[this.index(cell)] as SurfaceType : null;
  }

  temperatureAt(cell: GridCell): number | null {
    return this.inBounds(cell) ? this.temperature[this.index(cell)]! : null;
  }

  iceDurabilityAt(cell: GridCell): number | null {
    return this.inBounds(cell) ? this.iceDurability[this.index(cell)]! : null;
  }

  isFreezable(cell: GridCell): boolean {
    return this.inBounds(cell) && this.freezable[this.index(cell)] === 1;
  }

  applyEffects(effects: readonly TerrainEffect[]): WalkabilityChange[] {
    const changed = new Map<number, WalkabilityChange>();
    for (const effect of effects) {
      const radiusSquared = effect.radius * effect.radius;
      for (let row = 0; row < this.definition.rows; row += 1) {
        for (let column = 0; column < this.definition.columns; column += 1) {
          const cell = { column, row };
          const world = this.cellToWorld(cell);
          const deltaX = world.x - effect.targetX;
          const deltaZ = world.z - effect.targetZ;
          if (deltaX * deltaX + deltaZ * deltaZ > radiusSquared) continue;
          const index = this.index(cell);
          if (effect.effectId === 'FREEZE') this.applyFreeze(index, cell, changed);
          else this.applyHeat(index, cell, changed);
        }
      }
    }
    return [...changed.values()].sort((left, right) => this.index(left.cell) - this.index(right.cell));
  }

  counts(): TerrainCounts {
    let water = 0;
    let ice = 0;
    let freezableWater = 0;
    for (let index = 0; index < this.surface.length; index += 1) {
      if (this.surface[index] === SurfaceType.WATER) {
        water += 1;
        if (this.freezable[index] === 1) freezableWater += 1;
      } else if (this.surface[index] === SurfaceType.ICE) ice += 1;
    }
    return { water, ice, freezableWater };
  }

  private applyFreeze(index: number, cell: GridCell, changed: Map<number, WalkabilityChange>): void {
    if (this.freezable[index] !== 1 || this.surface[index] !== SurfaceType.WATER) return;
    this.temperature[index] = Math.max(-32_768, this.temperature[index]! + FREEZE_TEMPERATURE_DELTA);
    if (this.temperature[index]! > WATER_FREEZE_THRESHOLD) return;
    this.surface[index] = SurfaceType.ICE;
    this.iceDurability[index] = ICE_DURABILITY_MAX;
    changed.set(index, { cell, walkable: true });
  }

  private applyHeat(index: number, cell: GridCell, changed: Map<number, WalkabilityChange>): void {
    if (this.surface[index] !== SurfaceType.ICE) return;
    this.temperature[index] = Math.min(32_767, this.temperature[index]! + HEAT_TEMPERATURE_DELTA);
    this.iceDurability[index] = Math.max(0, this.iceDurability[index]! - HEAT_ICE_DAMAGE);
    if (this.iceDurability[index] !== 0) return;
    this.surface[index] = SurfaceType.WATER;
    changed.set(index, { cell, walkable: false });
  }

  private cellToWorld(cell: GridCell): { x: number; z: number } {
    return {
      x: this.definition.originX + cell.column * this.definition.cellSize + Math.floor(this.definition.cellSize / 2),
      z: this.definition.originZ + cell.row * this.definition.cellSize + Math.floor(this.definition.cellSize / 2),
    };
  }

  private forPatch(patch: { minColumn: number; maxColumn: number; minRow: number; maxRow: number }, visit: (index: number) => void): void {
    for (let row = patch.minRow; row <= patch.maxRow; row += 1) {
      for (let column = patch.minColumn; column <= patch.maxColumn; column += 1) {
        const cell = { column, row };
        if (this.inBounds(cell)) visit(this.index(cell));
      }
    }
  }

  private inBounds(cell: GridCell): boolean {
    return cell.column >= 0 && cell.row >= 0 && cell.column < this.definition.columns && cell.row < this.definition.rows;
  }

  private index(cell: GridCell): number { return cell.row * this.definition.columns + cell.column; }
}
