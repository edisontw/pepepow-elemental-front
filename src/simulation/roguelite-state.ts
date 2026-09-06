import type { StrategicSnapshot } from './strategic-state';
import { DeterministicRng } from './random';
import type { M04Command } from './m04-commands';
import {
  BASE_MAX_MANA_MILLI,
  SHRINE_MAX_MANA_BONUS_MILLI,
  UPGRADES,
  UPGRADES_BY_ID,
  WORLD_EVENTS,
  biomeAffinity,
  type ElementTag,
  type ModifierStat,
  type TriggerAction,
  type TriggerId,
  type UpgradeDefinition,
  type UpgradeEffect,
  type WorldEventDefinition,
} from './m04-content';
import type { GeneratedWorld, PointOfInterest } from '../world/world-definition';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const CORE_ELEMENTS: readonly ElementTag[] = ['FIRE', 'WATER', 'ICE', 'LIGHTNING'];

interface OpenShrineState {
  shrineId: string;
  choiceIds: readonly string[];
}

interface PlayerRogueliteState {
  acquiredUpgradeIds: string[];
  resolvedShrineIds: Set<string>;
  openShrine: OpenShrineState | null;
}

export interface ScheduledWorldEvent {
  id: string;
  startTick: number;
  endTick: number;
}

export interface RoguelitePlayerSnapshot {
  acquiredUpgradeIds: readonly string[];
  resolvedShrineIds: readonly string[];
  openShrine: OpenShrineState | null;
  maxManaMilli: number;
  synergies: readonly string[];
  tagCounts: Readonly<Record<ElementTag, number>>;
}

export interface RogueliteSnapshot {
  stateHash: string;
  players: Readonly<Record<number, RoguelitePlayerSnapshot>>;
  activeWorldEvent: ScheduledWorldEvent | null;
  nextWorldEvent: ScheduledWorldEvent | null;
  eventSchedule: readonly ScheduledWorldEvent[];
}

function hashInteger(hash: number, value: number): number {
  let result = hash;
  const normalized = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    result ^= (normalized >>> shift) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function hashString(hash: number, value: string): number {
  let result = hashInteger(hash, value.length);
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index) & 0xff;
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

function shuffleDeterministic<T>(values: readonly T[], rng: DeterministicRng): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextUint32() % (index + 1);
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current!;
  }
  return shuffled;
}

function emptyTagCounts(): Record<ElementTag, number> {
  return { FIRE: 0, WATER: 0, ICE: 0, LIGHTNING: 0, MIXED: 0 };
}

export function detectSynergies(acquiredUpgradeIds: readonly string[]): readonly string[] {
  const tags = new Set<ElementTag>();
  for (const upgradeId of acquiredUpgradeIds) {
    for (const tag of UPGRADES_BY_ID[upgradeId]?.tags ?? []) tags.add(tag);
  }
  const synergies: string[] = [];
  if (tags.has('FIRE') && tags.has('WATER')) synergies.push('STEAM_ENGINE');
  if (tags.has('FIRE') && tags.has('ICE')) synergies.push('THERMAL_SHOCK');
  if (tags.has('WATER') && tags.has('LIGHTNING')) synergies.push('STORMFRONT');
  if (tags.has('ICE') && tags.has('LIGHTNING')) synergies.push('BLACK_ICE');
  if (CORE_ELEMENTS.filter((tag) => tags.has(tag)).length >= 3) synergies.push('ELEMENTAL_CONVERGENCE');
  return synergies;
}

export function modifierFromEffects(effects: readonly UpgradeEffect[], stat: ModifierStat): number {
  return effects.reduce((total, effect) => total + (effect.kind === 'MODIFIER' && effect.stat === stat ? effect.add : 0), 0);
}

export function triggerFromEffects(
  effects: readonly UpgradeEffect[],
  trigger: TriggerId,
  action: TriggerAction,
): number {
  return effects.reduce((total, effect) => (
    total + (effect.kind === 'TRIGGER' && effect.trigger === trigger && effect.action === action ? effect.value : 0)
  ), 0);
}

export class RogueliteState {
  private readonly players = new Map<number, PlayerRogueliteState>();
  private readonly schedule: ScheduledWorldEvent[];
  private currentTick = 0;

  constructor(readonly world: GeneratedWorld) {
    this.ensurePlayer(0);
    this.ensurePlayer(1);
    this.schedule = this.createEventSchedule();
  }

  processCommand(command: M04Command, strategic: StrategicSnapshot, tick: number): boolean {
    this.currentTick = tick;
    const player = this.ensurePlayer(command.playerId);
    if (command.type === 'ACTIVATE_SHRINE') {
      const shrine = this.shrineById(command.shrineId);
      if (!shrine || strategic.poiOwners[shrine.id] !== command.playerId) return false;
      if (player.openShrine !== null || player.resolvedShrineIds.has(shrine.id)) return false;
      const choices = this.generateChoices(command.playerId, shrine, player);
      if (choices.length !== 3) return false;
      player.openShrine = { shrineId: shrine.id, choiceIds: choices.map((upgrade) => upgrade.id) };
      return true;
    }

    if (player.openShrine?.shrineId !== command.shrineId) return false;
    const choiceId = player.openShrine.choiceIds[command.choiceIndex];
    if (!choiceId || !UPGRADES_BY_ID[choiceId] || player.acquiredUpgradeIds.includes(choiceId)) return false;
    player.acquiredUpgradeIds.push(choiceId);
    player.resolvedShrineIds.add(command.shrineId);
    player.openShrine = null;
    return true;
  }

  advance(tick: number): void {
    this.currentTick = tick;
  }

  modifier(playerId: number, stat: ModifierStat): number {
    let total = 0;
    for (const upgrade of this.acquiredUpgrades(playerId)) total += modifierFromEffects(upgrade.effects, stat);
    const active = this.activeEventDefinition();
    if (active) total += active.effects.reduce((sum, effect) => sum + (effect.stat === stat ? effect.add : 0), 0);
    return total;
  }

  trigger(playerId: number, trigger: TriggerId, action: TriggerAction): number {
    let total = 0;
    for (const upgrade of this.acquiredUpgrades(playerId)) total += triggerFromEffects(upgrade.effects, trigger, action);
    return total;
  }

  maxManaMilli(playerId: number): number {
    const player = this.ensurePlayer(playerId);
    return BASE_MAX_MANA_MILLI
      + player.resolvedShrineIds.size * SHRINE_MAX_MANA_BONUS_MILLI
      + this.modifier(playerId, 'MAX_MANA_MILLI');
  }

  snapshot(): RogueliteSnapshot {
    const players: Record<number, RoguelitePlayerSnapshot> = {};
    for (const playerId of this.playerIds()) {
      const player = this.ensurePlayer(playerId);
      const tagCounts = emptyTagCounts();
      for (const upgrade of this.acquiredUpgrades(playerId)) {
        for (const tag of upgrade.tags) tagCounts[tag] += 1;
      }
      players[playerId] = {
        acquiredUpgradeIds: [...player.acquiredUpgradeIds],
        resolvedShrineIds: [...player.resolvedShrineIds].sort((a, b) => a.localeCompare(b)),
        openShrine: player.openShrine === null ? null : {
          shrineId: player.openShrine.shrineId,
          choiceIds: [...player.openShrine.choiceIds],
        },
        maxManaMilli: this.maxManaMilli(playerId),
        synergies: detectSynergies(player.acquiredUpgradeIds),
        tagCounts,
      };
    }
    const activeWorldEvent = this.activeScheduledEvent();
    const nextWorldEvent = this.schedule.find((event) => event.startTick > this.currentTick) ?? null;
    const snapshotWithoutHash = {
      players,
      activeWorldEvent,
      nextWorldEvent,
      eventSchedule: this.schedule.map((event) => ({ ...event })),
    };
    return { stateHash: this.computeHash(snapshotWithoutHash), ...snapshotWithoutHash };
  }

  private ensurePlayer(playerId: number): PlayerRogueliteState {
    let state = this.players.get(playerId);
    if (!state) {
      state = { acquiredUpgradeIds: [], resolvedShrineIds: new Set<string>(), openShrine: null };
      this.players.set(playerId, state);
    }
    return state;
  }

  private playerIds(): number[] {
    return [...this.players.keys()].sort((a, b) => a - b);
  }

  private acquiredUpgrades(playerId: number): UpgradeDefinition[] {
    const player = this.ensurePlayer(playerId);
    return player.acquiredUpgradeIds
      .map((upgradeId) => UPGRADES_BY_ID[upgradeId])
      .filter((upgrade): upgrade is UpgradeDefinition => upgrade !== undefined);
  }

  private shrineById(shrineId: string): PointOfInterest | undefined {
    return this.world.pois.find((poi) => poi.id === shrineId && poi.type === 'SHRINE');
  }

  private generateChoices(playerId: number, shrine: PointOfInterest, player: PlayerRogueliteState): UpgradeDefinition[] {
    const acquired = new Set(player.acquiredUpgradeIds);
    const eligible = UPGRADES.filter((upgrade) => !acquired.has(upgrade.id));
    if (eligible.length < 3) return [];
    const seed = [
      this.world.identity.namespace,
      this.world.identity.rulesetVersion,
      this.world.identity.blockHeight,
      this.world.generationAttempt,
      'm04-shrine',
      playerId,
      shrine.id,
      player.resolvedShrineIds.size,
    ].join(':');
    const rng = new DeterministicRng(seed);
    const region = this.world.regions[shrine.regionId];
    const affinity = region ? biomeAffinity(region.biome) : ([] as readonly ElementTag[]);
    const affinityPool = eligible.filter((upgrade) => upgrade.tags.some((tag) => affinity.includes(tag)));
    const firstPool = affinityPool.length > 0 ? affinityPool : eligible;
    const first = shuffleDeterministic(firstPool, rng)[0]!;
    const remaining = eligible.filter((upgrade) => upgrade.id !== first.id);
    const rest = shuffleDeterministic(remaining, rng).slice(0, 2);
    return [first, ...rest];
  }

  private createEventSchedule(): ScheduledWorldEvent[] {
    const seed = [
      this.world.identity.namespace,
      this.world.identity.rulesetVersion,
      this.world.identity.blockHeight,
      this.world.generationAttempt,
      'm04-world-events',
    ].join(':');
    const rng = new DeterministicRng(seed);
    const ordered = shuffleDeterministic(WORLD_EVENTS, rng);
    return ordered.slice(0, Math.min(2, ordered.length)).map((event, index) => {
      const startTick = 8_400 + index * 3_000;
      return { id: event.id, startTick, endTick: startTick + event.durationTicks };
    });
  }

  private activeScheduledEvent(): ScheduledWorldEvent | null {
    return this.schedule.find((event) => this.currentTick >= event.startTick && this.currentTick < event.endTick) ?? null;
  }

  private activeEventDefinition(): WorldEventDefinition | undefined {
    const active = this.activeScheduledEvent();
    return active ? WORLD_EVENTS.find((event) => event.id === active.id) : undefined;
  }

  private computeHash(snapshot: Omit<RogueliteSnapshot, 'stateHash'>): string {
    let hash = FNV_OFFSET;
    for (const playerId of Object.keys(snapshot.players).map(Number).sort((a, b) => a - b)) {
      const player = snapshot.players[playerId];
      if (!player) continue;
      hash = hashInteger(hash, playerId);
      hash = hashInteger(hash, player.maxManaMilli);
      for (const upgradeId of player.acquiredUpgradeIds) hash = hashString(hash, upgradeId);
      for (const shrineId of player.resolvedShrineIds) hash = hashString(hash, shrineId);
      if (player.openShrine) {
        hash = hashString(hash, player.openShrine.shrineId);
        for (const choiceId of player.openShrine.choiceIds) hash = hashString(hash, choiceId);
      }
      for (const synergy of player.synergies) hash = hashString(hash, synergy);
      for (const tag of [...CORE_ELEMENTS, 'MIXED' as const]) hash = hashInteger(hash, player.tagCounts[tag]);
    }
    for (const event of snapshot.eventSchedule) {
      hash = hashString(hash, event.id);
      hash = hashInteger(hash, event.startTick);
      hash = hashInteger(hash, event.endTick);
    }
    hash = hashString(hash, snapshot.activeWorldEvent?.id ?? '');
    hash = hashString(hash, snapshot.nextWorldEvent?.id ?? '');
    return hash.toString(16).padStart(8, '0');
  }
}
