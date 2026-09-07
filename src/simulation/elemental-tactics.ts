import { WORLD_UNITS_PER_METER } from './arena';

export const ELEMENTAL_FIRE_RADIUS = Math.round(2.5 * WORLD_UNITS_PER_METER);
export const ELEMENTAL_WATER_RADIUS = Math.round(3.5 * WORLD_UNITS_PER_METER);
export const ELEMENTAL_FREEZE_RADIUS = 3 * WORLD_UNITS_PER_METER;

export const FIRE_IMPACT_DAMAGE = 50;
export const WATER_WET_DURATION_TICKS = 60;
export const WATER_PUSH_CELLS = 2;
export const ICE_SPEED_PERMILLE = 1150;
export const HEAVY_ICE_STRESS_PER_TICK = 2;

export type PlayerElementalJob = 'FIRE' | 'WATER' | 'ICE' | 'LIGHTNING';

export const ELEMENTAL_JOB_LABELS: Readonly<Record<PlayerElementalJob, {
  name: string;
  key: string;
  job: string;
  detail: string;
}>> = {
  FIRE: {
    name: 'Fire',
    key: 'R',
    job: 'Deny / clear cover',
    detail: 'Impact damage, ignites vegetation, creates hazardous ground, and breaks ice routes.',
  },
  WATER: {
    name: 'Water',
    key: 'Q',
    job: 'Set up / displace',
    detail: 'Wets units, pushes light units, extinguishes fire, and creates Lightning opportunities.',
  },
  ICE: {
    name: 'Ice',
    key: 'F',
    job: 'Control / create route',
    detail: 'Chills or freezes units and turns water into a fast temporary crossing that heat can break.',
  },
  LIGHTNING: {
    name: 'Lightning',
    key: 'L',
    job: 'Punish wet clumps',
    detail: 'Executes conductive groups; Wet and Water increase damage and chain reach while Ice reduces conductivity.',
  },
};
