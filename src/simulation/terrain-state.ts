import type { ArenaTraversalDefinition } from './arena';
import type { GridCell, WalkabilityChange } from './navigation';

export const NEUTRAL_TEMPERATURE = 0;
export const WATER_FREEZE_THRESHOLD = -60;
export const ICE_DURABILITY_MAX = 100;
export const FREEZE_TEMPERATURE_DELTA = -80;
export const HEAT_TEMPERATURE_DELTA = 60;
export const HEAT_ICE_DAMAGE = 100;
export const BURNING_DURATION_TICKS = 50;
export const FIRE_SPREAD_INTERVAL_TICKS = 15;
export const BURNING_HEAT_PER_TICK = 10;
export const WATER_COOLING_DELTA = 40;

export const enum SurfaceType {
  GROUND = 0,
  WATER = 1,
  ICE = 2,
  BLOCKED_TERRAIN = 3,
  NATURAL_CROSSING = 4,
}

export type TerrainEffectId = 'FREEZE' | 'HEAT' | 'FIRE' | 'WATER';

export interface TerrainEffect {
  effectId: TerrainEffectId;
  targetX: number;
  targetZ: number;
  radius: number;
  sourcePlayerId?: number;
}

export interface TerrainCounts {
  water: number;
  ice: number;
  freezableWater: number;
  flammableVegetation: number;
  burning: number;
  consumedVegetation: number;
}

export const enum VegetationState {
  NONE = 0,
  FLAMMABLE = 1,
  CONSUMED = 2,
}

const FIXED_NEIGHBOR_OFFSETS = [
  { column: 0, row: -1 },
  { column: 1, row: 0 },
  { column: 0, row: 1 },
  { column: -1, row: 0 },
] as const;

export class TerrainState {
  readonly surface: Uint8Array;
  readonly temperature: Int16Array;
  readonly iceDurability: Uint8Array;
  readonly freezable: Uint8Array;
  readonly vegetation: Uint8Array;
  readonly burningAge: Uint8Array;

  constructor(readonly definition: ArenaTraversalDefinition) {
    const cellCount = definition.columns * definition.rows;
    this.surface = new Uint8Array(cellCount);
    this.temperature = new Int16Array(cellCount);
    this.iceDurability = new Uint8Array(cellCount);
    this.freezable = new Uint8Array(cellCount);
    this.vegetation = new Uint8Array(cellCount);
    this.burningAge = new Uint8Array(cellCount);

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
    for (const patch of definition.vegetationPatches) {
      this.forPatch(patch, (index) => {
        if (this.surface[index] === SurfaceType.GROUND) this.vegetation[index] = VegetationState.FLAMMABLE;
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

  vegetationAt(cell: GridCell): VegetationState | null {
    return this.inBounds(cell) ? this.vegetation[this.index(cell)] as VegetationState : null;
  }

  burningAgeAt(cell: GridCell): number | null {
    return this.inBounds(cell) ? this.burningAge[this.index(cell)]! : null;
  }

  cellCenter(cell: GridCell): { x: number; z: number } {
    return this.cellToWorld(cell);
  }

  flammableCells(): GridCell[] {
    const cells: GridCell[] = [];
    for (let index = 0; index < this.vegetation.length; index += 1) {
      if (this.vegetation[index] !== VegetationState.NONE) cells.push(this.cellAt(index));
    }
    return cells;
  }

  burningCells(): GridCell[] {
    const cells: GridCell[] = [];
    for (let index = 0; index < this.burningAge.length; index += 1) {
      if (this.burningAge[index] !== 0) cells.push(this.cellAt(index));
    }
    return cells;
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
          else if (effect.effectId === 'FIRE') {
            this.applyHeat(index, cell, changed);
            this.ignite(index);
          } else if (effect.effectId === 'WATER') {
            this.applyWater(index);
          } else {
            this.applyHeat(index, cell, changed);
          }
        }
      }
    }
    return [...changed.values()].sort((left, right) => this.index(left.cell) - this.index(right.cell));
  }

  advanceBurning(dousedCellIndices: ReadonlySet<number> = new Set()): void {
    const spreadCandidates: number[] = [];
    const marked = new Uint8Array(this.burningAge.length);

    for (let index = 0; index < this.burningAge.length; index += 1) {
      const age = this.burningAge[index]!;
      if (age === 0) continue;
      if (dousedCellIndices.has(index) || this.surface[index] === SurfaceType.WATER) {
        this.burningAge[index] = 0;
        continue;
      }

      this.temperature[index] = Math.min(32_767, this.temperature[index]! + BURNING_HEAT_PER_TICK);
      const nextAge = age + 1;
      if (nextAge > BURNING_DURATION_TICKS) {
        this.burningAge[index] = 0;
        this.vegetation[index] = VegetationState.CONSUMED;
        continue;
      }
      this.burningAge[index] = nextAge;
      if (nextAge % FIRE_SPREAD_INTERVAL_TICKS !== 0) continue;

      const cell = this.cellAt(index);
      for (const offset of FIXED_NEIGHBOR_OFFSETS) {
        const neighbor = { column: cell.column + offset.column, row: cell.row + offset.row };
        if (!this.inBounds(neighbor)) continue;
        const neighborIndex = this.index(neighbor);
        if (marked[neighborIndex] === 1 || !this.canIgnite(neighborIndex)) continue;
        marked[neighborIndex] = 1;
        spreadCandidates.push(neighborIndex);
      }
    }

    for (const index of spreadCandidates) this.ignite(index);
  }

  stressIce(cell: GridCell, amount: number): WalkabilityChange | null {
    if (!this.inBounds(cell)) return null;
    const index = this.index(cell);
    if (this.surface[index] !== SurfaceType.ICE || amount <= 0) return null;
    this.iceDurability[index] = Math.max(0, this.iceDurability[index]! - Math.round(amount));
    if (this.iceDurability[index] !== 0) return null;
    this.surface[index] = SurfaceType.WATER;
    return { cell, walkable: false };
  }

  indexOf(cell: GridCell): number | null {
    return this.inBounds(cell) ? this.index(cell) : null;
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
    let flammableVegetation = 0;
    let burning = 0;
    let consumedVegetation = 0;
    for (let index = 0; index < this.vegetation.length; index += 1) {
      if (this.vegetation[index] === VegetationState.FLAMMABLE) flammableVegetation += 1;
      else if (this.vegetation[index] === VegetationState.CONSUMED) consumedVegetation += 1;
      if (this.burningAge[index] !== 0) burning += 1;
    }
    return { water, ice, freezableWater, flammableVegetation, burning, consumedVegetation };
  }

  private canIgnite(index: number): boolean {
    return this.vegetation[index] === VegetationState.FLAMMABLE
      && this.burningAge[index] === 0
      && this.surface[index] !== SurfaceType.WATER
      && this.surface[index] !== SurfaceType.ICE;
  }

  private ignite(index: number): void {
    if (this.canIgnite(index)) this.burningAge[index] = 1;
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

  private applyWater(index: number): void {
    this.burningAge[index] = 0;
    if (this.temperature[index]! > NEUTRAL_TEMPERATURE) {
      this.temperature[index] = Math.max(NEUTRAL_TEMPERATURE, this.temperature[index]! - WATER_COOLING_DELTA);
    }
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

  private cellAt(index: number): GridCell {
    return { column: index % this.definition.columns, row: Math.floor(index / this.definition.columns) };
  }

  private index(cell: GridCell): number { return cell.row * this.definition.columns + cell.column; }
}
