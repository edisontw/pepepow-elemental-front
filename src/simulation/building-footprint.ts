import type { BuildingType } from './m03-content';
import type { GridCell } from './navigation';

type FootprintKind = 'CENTER' | 'CROSS_3' | 'SQUARE_3';

const FOOTPRINT_KIND: Readonly<Record<BuildingType, FootprintKind>> = {
  ELEMENTAL_CORE: 'SQUARE_3',
  BARRACKS: 'CROSS_3',
  ARCANE_TOWER: 'CENTER',
  WORKSHOP: 'CROSS_3',
  OUTPOST: 'CENTER',
  EXTRACTOR: 'CENTER',
  MANA_WELL: 'CENTER',
};

const CENTER_OFFSETS: readonly GridCell[] = [
  { column: 0, row: 0 },
];

const CROSS_3_OFFSETS: readonly GridCell[] = [
  { column: 0, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 0 },
  { column: 0, row: -1 },
  { column: -1, row: 0 },
];

const SQUARE_3_OFFSETS: readonly GridCell[] = [
  { column: -1, row: -1 }, { column: 0, row: -1 }, { column: 1, row: -1 },
  { column: -1, row: 0 }, { column: 0, row: 0 }, { column: 1, row: 0 },
  { column: -1, row: 1 }, { column: 0, row: 1 }, { column: 1, row: 1 },
];

function offsets(type: BuildingType): readonly GridCell[] {
  const kind = FOOTPRINT_KIND[type];
  if (kind === 'SQUARE_3') return SQUARE_3_OFFSETS;
  if (kind === 'CROSS_3') return CROSS_3_OFFSETS;
  return CENTER_OFFSETS;
}

/**
 * Authoritative navigation footprint. These cells intentionally represent only
 * the solid inner mass of the structure, not the full visual sprite/model.
 */
export function buildingFootprintCells(type: BuildingType, center: GridCell): GridCell[] {
  return offsets(type).map((offset) => ({
    column: center.column + offset.column,
    row: center.row + offset.row,
  }));
}

/** Distance from the anchor cell to a deterministic first legal unit-exit ring. */
export function buildingExitRadiusCells(type: BuildingType): number {
  return FOOTPRINT_KIND[type] === 'CENTER' ? 1 : 2;
}
