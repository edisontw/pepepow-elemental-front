import type { ArenaTraversalDefinition } from './arena';
import type { EntityStore } from './entity-store';
import type { GridCell, NavigationGrid } from './navigation';

export const VISION_RADIUS = 9_000;

export const enum VisibilityLevel {
  UNEXPLORED = 0,
  EXPLORED = 1,
  VISIBLE = 2,
}

export interface VisibilityCounts {
  unexplored: number;
  explored: number;
  visible: number;
}

export interface AdditionalVisionSource {
  playerId: number;
  x: number;
  z: number;
  radius?: number;
  active?: boolean;
}

export class VisibilityState {
  private readonly cellsByPlayer = new Map<number, Uint8Array>();

  constructor(private readonly definition: ArenaTraversalDefinition, playerIds: readonly number[]) {
    for (const playerId of [...new Set(playerIds)].sort((left, right) => left - right)) {
      this.ensurePlayer(playerId);
    }
  }

  ensurePlayer(playerId: number): void {
    if (this.cellsByPlayer.has(playerId)) return;
    this.cellsByPlayer.set(playerId, new Uint8Array(this.definition.columns * this.definition.rows));
  }

  update(
    entities: EntityStore,
    navigation: NavigationGrid,
    additionalSources: readonly AdditionalVisionSource[] = [],
  ): void {
    for (const cells of this.cellsByPlayer.values()) {
      for (let index = 0; index < cells.length; index += 1) {
        if (cells[index] === VisibilityLevel.VISIBLE) cells[index] = VisibilityLevel.EXPLORED;
      }
    }

    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId)) continue;
      const playerId = entities.factions.get(entityId)!.playerId;
      const position = entities.positions.get(entityId);
      if (!position) continue;
      this.revealAround(playerId, position.x, position.z, VISION_RADIUS, navigation);
    }

    for (const source of additionalSources) {
      if (source.active === false) continue;
      this.revealAround(source.playerId, source.x, source.z, source.radius ?? VISION_RADIUS, navigation);
    }
  }

  levelAt(playerId: number, cell: GridCell): VisibilityLevel | null {
    const cells = this.cellsByPlayer.get(playerId);
    return cells && this.inBounds(cell) ? cells[this.index(cell)] as VisibilityLevel : null;
  }

  isWorldVisible(playerId: number, x: number, z: number, navigation: NavigationGrid): boolean {
    return this.levelAt(playerId, navigation.worldToCell(x, z)) === VisibilityLevel.VISIBLE;
  }

  counts(playerId: number): VisibilityCounts {
    const cells = this.cellsByPlayer.get(playerId);
    const counts = { unexplored: 0, explored: 0, visible: 0 };
    if (!cells) return counts;
    for (const level of cells) {
      if (level === VisibilityLevel.VISIBLE) counts.visible += 1;
      else if (level === VisibilityLevel.EXPLORED) counts.explored += 1;
      else counts.unexplored += 1;
    }
    return counts;
  }

  playerIds(): number[] {
    return [...this.cellsByPlayer.keys()].sort((left, right) => left - right);
  }

  cellsForPlayer(playerId: number): Uint8Array | undefined {
    return this.cellsByPlayer.get(playerId);
  }

  private revealAround(playerId: number, x: number, z: number, radius: number, navigation: NavigationGrid): void {
    const cells = this.cellsByPlayer.get(playerId);
    if (!cells || radius <= 0) return;
    const radiusSquared = radius * radius;
    const origin = navigation.worldToCell(x, z);
    const cellRadius = Math.ceil(radius / this.definition.cellSize);
    for (let row = Math.max(0, origin.row - cellRadius); row <= Math.min(this.definition.rows - 1, origin.row + cellRadius); row += 1) {
      for (let column = Math.max(0, origin.column - cellRadius); column <= Math.min(this.definition.columns - 1, origin.column + cellRadius); column += 1) {
        const cell = { column, row };
        const world = navigation.cellToWorld(cell);
        const deltaX = world.x - x;
        const deltaZ = world.z - z;
        if (deltaX * deltaX + deltaZ * deltaZ <= radiusSquared) cells[this.index(cell)] = VisibilityLevel.VISIBLE;
      }
    }
  }

  private inBounds(cell: GridCell): boolean {
    return cell.column >= 0 && cell.row >= 0 && cell.column < this.definition.columns && cell.row < this.definition.rows;
  }

  private index(cell: GridCell): number {
    return cell.row * this.definition.columns + cell.column;
  }
}
