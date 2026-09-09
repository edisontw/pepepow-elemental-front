import { WORLD_UNITS_PER_METER } from './arena';
import type {
  ElementId,
  StrategicSpellId,
  TacticalSpellId,
  TargetTag,
} from './element-types';

export type SpellTargetMode = 'POINT_AREA' | 'HOSTILE_ENTITY';
export type FactionPolicy = 'HOSTILE_ONLY' | 'ALL_FACTIONS';

export interface TacticalSpellDefinition {
  id: TacticalSpellId;
  layer: 'TACTICAL';
  element: ElementId;
  manaCostMilli: number;
  cooldownTicks: number;
  castRange: number;
  targetMode: SpellTargetMode;
  radius: number;
  impactFactionPolicy: FactionPolicy;
  persistentFactionPolicy: FactionPolicy;
  preferredTargetTags: readonly TargetTag[];
  preview: 'AREA' | 'AREA_WITH_TERRAIN' | 'CHAIN';
  resolver: 'FIRE' | 'WATER' | 'FREEZE' | 'CHAIN_LIGHTNING';
}

export interface StrategicSpellDefinition {
  id: StrategicSpellId;
  layer: 'STRATEGIC';
  element: ElementId;
  manaCostMilli: number;
  cooldownTicks: number;
  durationTicks: number;
  radius: number;
  targetMode: 'POINT_AREA';
  persistentFactionPolicy: 'ALL_FACTIONS';
  preferredTargetTags: readonly TargetTag[];
  preview: 'AREA_WITH_TERRAIN';
  resolver: StrategicSpellId;
}

const M = WORLD_UNITS_PER_METER;

export const TACTICAL_SPELLS: Readonly<Record<TacticalSpellId, TacticalSpellDefinition>> = {
  FIREBOLT: {
    id: 'FIREBOLT', layer: 'TACTICAL', element: 'FIRE', manaCostMilli: 20_000,
    cooldownTicks: 50, castRange: 10 * M, targetMode: 'POINT_AREA', radius: Math.round(2.5 * M),
    impactFactionPolicy: 'HOSTILE_ONLY', persistentFactionPolicy: 'ALL_FACTIONS',
    preferredTargetTags: ['SUPPORT'], preview: 'AREA_WITH_TERRAIN', resolver: 'FIRE',
  },
  WATER_BURST: {
    id: 'WATER_BURST', layer: 'TACTICAL', element: 'WATER', manaCostMilli: 20_000,
    cooldownTicks: 60, castRange: 9 * M, targetMode: 'POINT_AREA', radius: Math.round(3.5 * M),
    impactFactionPolicy: 'HOSTILE_ONLY', persistentFactionPolicy: 'ALL_FACTIONS',
    preferredTargetTags: ['LIGHT', 'BURNING'], preview: 'AREA_WITH_TERRAIN', resolver: 'WATER',
  },
  FREEZE: {
    id: 'FREEZE', layer: 'TACTICAL', element: 'ICE', manaCostMilli: 25_000,
    cooldownTicks: 70, castRange: 9 * M, targetMode: 'POINT_AREA', radius: 3 * M,
    impactFactionPolicy: 'HOSTILE_ONLY', persistentFactionPolicy: 'ALL_FACTIONS',
    preferredTargetTags: ['WET'], preview: 'AREA_WITH_TERRAIN', resolver: 'FREEZE',
  },
  CHAIN_LIGHTNING: {
    id: 'CHAIN_LIGHTNING', layer: 'TACTICAL', element: 'LIGHTNING', manaCostMilli: 35_000,
    cooldownTicks: 80, castRange: 10 * M, targetMode: 'HOSTILE_ENTITY', radius: 0,
    impactFactionPolicy: 'HOSTILE_ONLY', persistentFactionPolicy: 'ALL_FACTIONS',
    preferredTargetTags: ['WET', 'CONDUCTIVE', 'METAL', 'SUPPORT', 'ELEMENTAL'], preview: 'CHAIN', resolver: 'CHAIN_LIGHTNING',
  },
};

export const STRATEGIC_SPELLS: Readonly<Record<StrategicSpellId, StrategicSpellDefinition>> = {
  INFERNO: {
    id: 'INFERNO', layer: 'STRATEGIC', element: 'FIRE', manaCostMilli: 130_000,
    cooldownTicks: 650, durationTicks: 120, radius: 10 * M, targetMode: 'POINT_AREA',
    persistentFactionPolicy: 'ALL_FACTIONS', preferredTargetTags: ['BUILDING', 'FORTIFIED'],
    preview: 'AREA_WITH_TERRAIN', resolver: 'INFERNO',
  },
  DELUGE: {
    id: 'DELUGE', layer: 'STRATEGIC', element: 'WATER', manaCostMilli: 110_000,
    cooldownTicks: 550, durationTicks: 100, radius: 11 * M, targetMode: 'POINT_AREA',
    persistentFactionPolicy: 'ALL_FACTIONS', preferredTargetTags: ['LIGHT', 'BURNING', 'CONDUCTIVE'],
    preview: 'AREA_WITH_TERRAIN', resolver: 'DELUGE',
  },
  BLIZZARD: {
    id: 'BLIZZARD', layer: 'STRATEGIC', element: 'ICE', manaCostMilli: 120_000,
    cooldownTicks: 600, durationTicks: 120, radius: 10 * M, targetMode: 'POINT_AREA',
    persistentFactionPolicy: 'ALL_FACTIONS', preferredTargetTags: ['WET', 'HEAVY'],
    preview: 'AREA_WITH_TERRAIN', resolver: 'BLIZZARD',
  },
  THUNDERSTORM: {
    id: 'THUNDERSTORM', layer: 'STRATEGIC', element: 'LIGHTNING', manaCostMilli: 140_000,
    cooldownTicks: 700, durationTicks: 100, radius: 12 * M, targetMode: 'POINT_AREA',
    persistentFactionPolicy: 'ALL_FACTIONS', preferredTargetTags: ['WET', 'CONDUCTIVE', 'METAL', 'SUPPORT'],
    preview: 'AREA_WITH_TERRAIN', resolver: 'THUNDERSTORM',
  },
};

export type StrategicAnchorClass = 'ELEMENTAL_CORE' | 'ARCANE_TOWER' | 'MANA_BEACON_OUTPOST';

export const STRATEGIC_ANCHOR_REACH: Readonly<Record<StrategicAnchorClass, number>> = {
  ELEMENTAL_CORE: 24 * M,
  ARCANE_TOWER: 22 * M,
  MANA_BEACON_OUTPOST: 18 * M,
};

export const STRATEGIC_PULSE_INTERVAL_TICKS = 10;
