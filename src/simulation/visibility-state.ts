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

export class VisibilityState {
  private readonly cellsByPlayer = new Map<number, Uint8Array>();

  constructor(private readonly definition: ArenaTraversalDefinition, playerIds: readonly number[]) {
    const cellCount = definition.columns * definition.rows;
    for (const playerId of [...new Set(playerIds)].sort((left, right) => left - right)) {
      this.cellsByPlayer.set(playerId, new Uint8Array(cellCount));
    }
  }

  update(entities: EntityStore, navigation: NavigationGrid): void {
    for (const cells of this.cellsByPlayer.values()) {
      for (let index = 0; index < cells.length; index += 1) {
        if (cells[index] === VisibilityLevel.VISIBLE) cells[index] = VisibilityLevel.EXPLORED;
      }
    }

    const radiusSquared = VISION_RADIUS * VISION_RADIUS;
    for (const entityId of entities.entityIds()) {
      if (!entities.hasUnit(entityId)) continue;
      const playerId = entities.factions.get(entityId)!.playerId;
      const cells = this.cellsByPlayer.get(playerId);
      const position = entities.positions.get(entityId);
      if (!cells || !position) continue;
      const origin = navigation.worldToCell(position.x, position.z);
      const cellRadius = Math.ceil(VISION_RADIUS / this.definition.cellSize);
      for (let row = Math.max(0, origin.row - cellRadius); row <= Math.min(this.definition.rows - 1, origin.row + cellRadius); row += 1) {
        for (let column = Math.max(0, origin.column - cellRadius); column <= Math.min(this.definition.columns - 1, origin.column + cellRadius); column += 1) {
          const cell = { column, row };
          const world = navigation.cellToWorld(cell);
          const deltaX = world.x - position.x;
          const deltaZ = world.z - position.z;
          if (deltaX * deltaX + deltaZ * deltaZ <= radiusSquared) cells[this.index(cell)] = VisibilityLevel.VISIBLE;
        }
      }
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

  private inBounds(cell: GridCell): boolean {
    return cell.column >= 0 && cell.row >= 0 && cell.column < this.definition.columns && cell.row < this.definition.rows;
  }

  private index(cell: GridCell): number {
    return cell.row * this.definition.columns + cell.column;
  }
}
