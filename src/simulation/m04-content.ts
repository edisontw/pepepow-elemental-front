import { BiomeType } from '../world/world-definition';

export type ElementTag = 'FIRE' | 'WATER' | 'ICE' | 'LIGHTNING' | 'MIXED';

export type ModifierStat =
  | 'FIRE_RADIUS_PERMILLE'
  | 'HEAT_RADIUS_PERMILLE'
  | 'FREEZE_RADIUS_PERMILLE'
  | 'MAX_MANA_MILLI';

export type TriggerId = 'CAST_CHAIN_LIGHTNING' | 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET';
export type TriggerAction = 'EXTRA_LIGHTNING_CAST';

export interface ModifierEffect {
  kind: 'MODIFIER';
  stat: ModifierStat;
  add: number;
}

export interface TriggerEffect {
  kind: 'TRIGGER';
  trigger: TriggerId;
  action: TriggerAction;
  value: number;
}

export type UpgradeEffect = ModifierEffect | TriggerEffect;

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  tags: readonly ElementTag[];
  effects: readonly UpgradeEffect[];
}

export interface WorldEventDefinition {
  id: string;
  name: string;
  description: string;
  durationTicks: number;
  tags: readonly ElementTag[];
  effects: readonly ModifierEffect[];
}

export const BASE_MAX_MANA_MILLI = 250_000;
export const SHRINE_MAX_MANA_BONUS_MILLI = 20_000;

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'fire-kindling-front',
    name: 'Kindling Front',
    description: 'Fire battlefield effects gain 25% radius.',
    tags: ['FIRE'],
    effects: [{ kind: 'MODIFIER', stat: 'FIRE_RADIUS_PERMILLE', add: 250 }],
  },
  {
    id: 'fire-thermal-lance',
    name: 'Thermal Lance',
    description: 'Heat effects gain 35% radius, making ice routes easier to collapse.',
    tags: ['FIRE'],
    effects: [{ kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 350 }],
  },
  {
    id: 'fire-ember-reservoir',
    name: 'Ember Reservoir',
    description: 'Increase run maximum Mana by 35.',
    tags: ['FIRE'],
    effects: [{ kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 35_000 }],
  },
  {
    id: 'water-conductive-current',
    name: 'Conductive Current',
    description: 'Chain Lightning cast on a Wet target resolves one additional deterministic cast.',
    tags: ['WATER', 'LIGHTNING'],
    effects: [{ kind: 'TRIGGER', trigger: 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', action: 'EXTRA_LIGHTNING_CAST', value: 1 }],
  },
  {
    id: 'water-deep-reserve',
    name: 'Deep Reserve',
    description: 'Increase run maximum Mana by 50.',
    tags: ['WATER'],
    effects: [{ kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 50_000 }],
  },
  {
    id: 'water-thermal-buffer',
    name: 'Thermal Buffer',
    description: 'Increase Heat radius by 10% and Freeze radius by 10%, supporting rapid water-state cycling.',
    tags: ['WATER', 'MIXED'],
    effects: [
      { kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 100 },
      { kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 100 },
    ],
  },
  {
    id: 'ice-whiteout-ring',
    name: 'Whiteout Ring',
    description: 'Freeze effects gain 30% radius.',
    tags: ['ICE'],
    effects: [{ kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 300 }],
  },
  {
    id: 'ice-deep-freeze',
    name: 'Deep Freeze',
    description: 'Freeze effects gain another 20% radius and maximum Mana increases by 20.',
    tags: ['ICE'],
    effects: [
      { kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 200 },
      { kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 20_000 },
    ],
  },
  {
    id: 'ice-cold-bank',
    name: 'Cold Bank',
    description: 'Increase run maximum Mana by 40.',
    tags: ['ICE'],
    effects: [{ kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 40_000 }],
  },
  {
    id: 'lightning-arc-relay',
    name: 'Arc Relay',
    description: 'Chain Lightning resolves one additional deterministic cast.',
    tags: ['LIGHTNING'],
    effects: [{ kind: 'TRIGGER', trigger: 'CAST_CHAIN_LIGHTNING', action: 'EXTRA_LIGHTNING_CAST', value: 1 }],
  },
  {
    id: 'lightning-storm-capacitor',
    name: 'Storm Capacitor',
    description: 'Increase run maximum Mana by 45.',
    tags: ['LIGHTNING'],
    effects: [{ kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 45_000 }],
  },
  {
    id: 'lightning-grounded-network',
    name: 'Grounded Network',
    description: 'Increase maximum Mana by 20 and improve Wet-target lightning through a deterministic extra cast.',
    tags: ['LIGHTNING', 'WATER'],
    effects: [
      { kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 20_000 },
      { kind: 'TRIGGER', trigger: 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', action: 'EXTRA_LIGHTNING_CAST', value: 1 },
    ],
  },
  {
    id: 'mixed-thermal-shock',
    name: 'Thermal Shock',
    description: 'Heat and Freeze effects both gain 20% radius.',
    tags: ['FIRE', 'ICE', 'MIXED'],
    effects: [
      { kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 200 },
      { kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 200 },
    ],
  },
  {
    id: 'mixed-steam-engine',
    name: 'Steam Engine',
    description: 'Fire and Heat effects gain 15% radius and maximum Mana increases by 25.',
    tags: ['FIRE', 'WATER', 'MIXED'],
    effects: [
      { kind: 'MODIFIER', stat: 'FIRE_RADIUS_PERMILLE', add: 150 },
      { kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 150 },
      { kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 25_000 },
    ],
  },
  {
    id: 'mixed-black-ice',
    name: 'Black Ice',
    description: 'Freeze effects gain 15% radius and Wet-target lightning gains an extra cast.',
    tags: ['ICE', 'LIGHTNING', 'MIXED'],
    effects: [
      { kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 150 },
      { kind: 'TRIGGER', trigger: 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', action: 'EXTRA_LIGHTNING_CAST', value: 1 },
    ],
  },
  {
    id: 'mixed-elemental-convergence',
    name: 'Elemental Convergence',
    description: 'All battlefield-effect radii gain 10% and maximum Mana increases by 30.',
    tags: ['FIRE', 'WATER', 'ICE', 'LIGHTNING', 'MIXED'],
    effects: [
      { kind: 'MODIFIER', stat: 'FIRE_RADIUS_PERMILLE', add: 100 },
      { kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 100 },
      { kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 100 },
      { kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 30_000 },
    ],
  },
] as const;

export const UPGRADES_BY_ID: Readonly<Record<string, UpgradeDefinition>> = Object.fromEntries(
  UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
);

export const WORLD_EVENTS: readonly WorldEventDefinition[] = [
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    description: 'Temporary global heat pressure expands Fire and Heat battlefield effects.',
    durationTicks: 300,
    tags: ['FIRE'],
    effects: [
      { kind: 'MODIFIER', stat: 'FIRE_RADIUS_PERMILLE', add: 150 },
      { kind: 'MODIFIER', stat: 'HEAT_RADIUS_PERMILLE', add: 150 },
    ],
  },
  {
    id: 'cold-front',
    name: 'Cold Front',
    description: 'Temporary cold front expands Freeze battlefield effects.',
    durationTicks: 300,
    tags: ['ICE'],
    effects: [{ kind: 'MODIFIER', stat: 'FREEZE_RADIUS_PERMILLE', add: 180 }],
  },
  {
    id: 'mana-surge',
    name: 'Mana Surge',
    description: 'Temporary ambient surge increases effective maximum Mana by 60.',
    durationTicks: 250,
    tags: ['LIGHTNING'],
    effects: [{ kind: 'MODIFIER', stat: 'MAX_MANA_MILLI', add: 60_000 }],
  },
] as const;

export function biomeAffinity(biome: BiomeType): readonly ElementTag[] {
  if (biome === BiomeType.WOODLAND) return ['FIRE', 'WATER'];
  if (biome === BiomeType.HIGHLANDS) return ['ICE', 'LIGHTNING'];
  return ['WATER', 'LIGHTNING'];
}

export function validateM04Content(): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const upgrade of UPGRADES) {
    if (ids.has(upgrade.id)) errors.push(`Duplicate upgrade id: ${upgrade.id}`);
    ids.add(upgrade.id);
    if (upgrade.tags.length === 0) errors.push(`Upgrade ${upgrade.id} has no tags.`);
    if (upgrade.effects.length === 0) errors.push(`Upgrade ${upgrade.id} has no effects.`);
    for (const effect of upgrade.effects) {
      if (effect.kind === 'MODIFIER' && !Number.isSafeInteger(effect.add)) errors.push(`Upgrade ${upgrade.id} has a non-integer modifier.`);
      if (effect.kind === 'TRIGGER' && (!Number.isSafeInteger(effect.value) || effect.value < 1)) errors.push(`Upgrade ${upgrade.id} has an invalid trigger value.`);
    }
  }
  const eventIds = new Set<string>();
  for (const event of WORLD_EVENTS) {
    if (eventIds.has(event.id)) errors.push(`Duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    if (!Number.isSafeInteger(event.durationTicks) || event.durationTicks <= 0) errors.push(`World event ${event.id} has invalid duration.`);
  }
  return errors;
}
