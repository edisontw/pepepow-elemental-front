export const ELEMENT_IDS = ['FIRE', 'WATER', 'ICE', 'LIGHTNING'] as const;
export type ElementId = typeof ELEMENT_IDS[number];

export function isElementId(value: unknown): value is ElementId {
  return typeof value === 'string' && (ELEMENT_IDS as readonly string[]).includes(value);
}

export type TacticalSpellId =
  | 'FIREBOLT'
  | 'WATER_BURST'
  | 'FREEZE'
  | 'CHAIN_LIGHTNING';

export type StrategicSpellId =
  | 'INFERNO'
  | 'DELUGE'
  | 'BLIZZARD'
  | 'THUNDERSTORM';

export type SpellId = TacticalSpellId | StrategicSpellId;
export type SpellLayer = 'TACTICAL' | 'STRATEGIC';

export type StaticTargetTag =
  | 'LIGHT'
  | 'HEAVY'
  | 'METAL'
  | 'RANGED'
  | 'ELEMENTAL'
  | 'BUILDING'
  | 'FORTIFIED'
  | 'ARCANE'
  | 'SUPPORT'
  | 'SIEGE';

export type DynamicTargetTag =
  | 'WET'
  | 'CHILLED'
  | 'FROZEN'
  | 'BURNING'
  | 'CONDUCTIVE';

export type TargetTag = StaticTargetTag | DynamicTargetTag;

export type SpellTarget =
  | { kind: 'POINT'; x: number; z: number }
  | { kind: 'ENTITY'; entityId: number };
