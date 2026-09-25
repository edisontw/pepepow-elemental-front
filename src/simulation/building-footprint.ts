import type { BuildingType } from './m03-content';
import type { GridCell } from './navigation';

const CENTER: readonly GridCell[] = [
  { column: 0, row: 0 },
];

const CROSS: readonly GridCell[] = [
  { column: 0, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 0 },
  { column: 0, row: -1 },
  { column: -1, row: 0 },
];

const CORE: readonly GridCell[] = [
  { column: -1, row: -1 }, { column: 0, row: -1 }, { column: 1, row: -1 },
  { column: -1, row: 0 }, { column: 0, row: 0 }, { column: 1, row: 0 },
  { column: -1, row: 1 }, { column: 0, row: 1 }, { column: 1, row: 1 },
];

export function buildingFootprintOffsets(type: BuildingType): readonly GridCell[] {
  if (type === 'ELEMENTAL_CORE') return CORE;
  if (type === 'BARRACKS' || type === 'WORKSHOP') return CROSS;
  return CENTER;
}

export function buildingFootprintCells(center: GridCell, type: BuildingType): GridCell[] {
  return buildingFootprintOffsets(type).map((offset) => ({
    column: center.column + offset.column,
    row: center.row + offset.row,
  }));
}
