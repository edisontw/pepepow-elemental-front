import type { ArenaTraversalDefinition, TraversalCellKind } from './arena';
import type { NavigationPoint } from './components';

export interface GridCell { column: number; row: number }
export interface WalkabilityChange { cell: GridCell; walkable: boolean }

interface OpenNode extends GridCell {
  g: number;
  h: number;
  sequence: number;
}

// North, east, south, west is the canonical expansion order.
const NEIGHBORS: readonly GridCell[] = [
  { column: 0, row: 1 },
  { column: 1, row: 0 },
  { column: 0, row: -1 },
  { column: -1, row: 0 },
];

export class NavigationGrid {
  navVersion: number;
  private readonly cells: TraversalCellKind[];
  private readonly walkable: Uint8Array;

  constructor(readonly definition: ArenaTraversalDefinition) {
    this.navVersion = definition.initialNavVersion;
    this.cells = Array.from({ length: definition.columns * definition.rows }, () => 'WALKABLE_GROUND');
    for (const patch of definition.patches) {
      for (let row = patch.minRow; row <= patch.maxRow; row += 1) {
        for (let column = patch.minColumn; column <= patch.maxColumn; column += 1) {
          if (this.inBounds({ column, row })) this.cells[this.index({ column, row })] = patch.kind;
        }
      }
    }
    this.walkable = new Uint8Array(this.cells.length);
    for (let index = 0; index < this.cells.length; index += 1) {
      const kind = this.cells[index];
      this.walkable[index] = kind === 'WALKABLE_GROUND' || kind === 'NATURAL_CROSSING' ? 1 : 0;
    }
  }

  cellKind(cell: GridCell): TraversalCellKind | null {
    return this.inBounds(cell) ? this.cells[this.index(cell)]! : null;
  }

  isWalkable(cell: GridCell): boolean {
    return this.inBounds(cell) && this.walkable[this.index(cell)] === 1;
  }

  applyWalkabilityChanges(changes: readonly WalkabilityChange[]): boolean {
    let changed = false;
    for (const change of changes) {
      if (!this.inBounds(change.cell)) continue;
      const index = this.index(change.cell);
      const next = change.walkable ? 1 : 0;
      if (this.walkable[index] === next) continue;
      this.walkable[index] = next;
      changed = true;
    }
    if (changed) this.navVersion += 1;
    return changed;
  }

  worldToCell(x: number, z: number): GridCell {
    return {
      column: Math.floor((x - this.definition.originX) / this.definition.cellSize),
      row: Math.floor((z - this.definition.originZ) / this.definition.cellSize),
    };
  }

  cellToWorld(cell: GridCell): NavigationPoint {
    return {
      x: this.definition.originX + cell.column * this.definition.cellSize + Math.floor(this.definition.cellSize / 2),
      z: this.definition.originZ + cell.row * this.definition.cellSize + Math.floor(this.definition.cellSize / 2),
    };
  }

  cellKey(cell: GridCell): string { return `${cell.column},${cell.row}`; }

  resolveWalkableTarget(target: GridCell): GridCell | null {
    if (this.isWalkable(target)) return target;
    const visited = new Set<string>([this.cellKey(target)]);
    let frontier: GridCell[] = [target];
    while (frontier.length > 0) {
      const next: GridCell[] = [];
      for (const cell of frontier) {
        for (const offset of NEIGHBORS) {
          const candidate = { column: cell.column + offset.column, row: cell.row + offset.row };
          const key = this.cellKey(candidate);
          if (visited.has(key) || !this.inBounds(candidate)) continue;
          visited.add(key);
          if (this.isWalkable(candidate)) return candidate;
          next.push(candidate);
        }
      }
      frontier = next;
    }
    return null;
  }

  findPath(start: GridCell, requestedGoal: GridCell): GridCell[] | null {
    const goal = this.resolveWalkableTarget(requestedGoal);
    if (!goal || !this.isWalkable(start)) return null;
    const startKey = this.cellKey(start);
    const goalKey = this.cellKey(goal);
    if (startKey === goalKey) return [];
    const open: OpenNode[] = [{ ...start, g: 0, h: this.heuristic(start, goal), sequence: 0 }];
    const bestG = new Map<string, number>([[startKey, 0]]);
    const cameFrom = new Map<string, GridCell>();
    let sequence = 1;
    while (open.length > 0) {
      open.sort((a, b) => (a.g + a.h) - (b.g + b.h) || a.h - b.h || a.sequence - b.sequence || a.row - b.row || a.column - b.column);
      const current = open.shift()!;
      const currentKey = this.cellKey(current);
      if (current.g !== bestG.get(currentKey)) continue;
      if (currentKey === goalKey) return this.reconstruct(cameFrom, startKey, current);
      for (const offset of NEIGHBORS) {
        const neighbor = { column: current.column + offset.column, row: current.row + offset.row };
        if (!this.isWalkable(neighbor)) continue;
        const key = this.cellKey(neighbor);
        const tentativeG = current.g + 1;
        const previousG = bestG.get(key);
        if (previousG !== undefined && tentativeG >= previousG) continue;
        bestG.set(key, tentativeG);
        cameFrom.set(key, { column: current.column, row: current.row });
        open.push({ ...neighbor, g: tentativeG, h: this.heuristic(neighbor, goal), sequence });
        sequence += 1;
      }
    }
    return null;
  }

  private reconstruct(cameFrom: Map<string, GridCell>, startKey: string, goal: GridCell): GridCell[] {
    const path: GridCell[] = [{ column: goal.column, row: goal.row }];
    while (this.cellKey(path[0]!) !== startKey) {
      const previous = cameFrom.get(this.cellKey(path[0]!));
      if (!previous) throw new Error('Navigation path reconstruction failed.');
      path.unshift(previous);
    }
    path.shift();
    return path;
  }

  private heuristic(left: GridCell, right: GridCell): number {
    return Math.abs(left.column - right.column) + Math.abs(left.row - right.row);
  }

  private inBounds(cell: GridCell): boolean {
    return cell.column >= 0 && cell.row >= 0 && cell.column < this.definition.columns && cell.row < this.definition.rows;
  }

  private index(cell: GridCell): number { return cell.row * this.definition.columns + cell.column; }
}
