import { AttunementState, type AttunementSnapshot, type StartingAttunements } from './attunement-state';
import {
  CommandQueue,
  SemanticSpellCommandQueue,
  type CastCommand,
  type CastStrategicSpellCommand,
  type CastTacticalSpellCommand,
  type GameCommand,
  type M04GameCommand,
  type TerrainCastCommand,
} from './commands';
import type { ElementId, StrategicSpellId, TacticalSpellId } from './element-types';
import type { M03Command, TrainCommand } from './m03-commands';
import { M03CommandQueue } from './m03-commands';
import type { M04Command } from './m04-commands';
import { M04CommandQueue } from './m04-commands';
import { M03Simulation, type M03SimulationSnapshot } from './m03-simulation';
import { RogueliteState, type RogueliteSnapshot } from './roguelite-state';
import {
  ELEMENTAL_SPELLS,
  type ElementalCastEffectId,
  type ModifierStat,
} from './m04-content';
import { STRATEGIC_PULSE_INTERVAL_TICKS, STRATEGIC_SPELLS, TACTICAL_SPELLS } from './spell-content';
import { applyThunderstormPulse, applyV2TerrainPulse } from './spell-resolution';
import { SpellAuthorityState, type SpellAuthoritySnapshot } from './spell-state';
import type { GeneratedWorld } from '../world/world-definition';

export interface M04SimulationOptions {
  /** M04 historical tests remain compatible; M05/M06 enable the player Mana rules by default. */
  playerManaRules?: boolean;
  startingAttunementsByPlayer?: Partial<Record<number, StartingAttunements>>;
}

export interface ElementalManaPlayerSnapshot {
  currentManaMilli: number;
  maxManaMilli: number;
  cooldownTicks: Readonly<Record<ElementalCastEffectId, number>>;
}

export interface ElementalCastResult {
  tick: number;
  playerId: number;
  effectId: ElementalCastEffectId;
  status: 'CAST' | 'NO_MANA' | 'COOLDOWN';
}

export interface ElementalManaSnapshot {
  enabled: boolean;
  players: Readonly<Record<number, ElementalManaPlayerSnapshot>>;
  lastCastResult: ElementalCastResult | null;
}

export interface ActiveStrategicZoneSnapshot {
  id: number;
  playerId: number;
  spellId: StrategicSpellId;
  targetX: number;
  targetZ: number;
  startTick: number;
  endTick: number;
  nextPulseTick: number;
}

export interface V2SpellCastResult {
  tick: number;
  playerId: number;
  layer: 'TACTICAL' | 'STRATEGIC';
  spellId: TacticalSpellId | StrategicSpellId;
  status: 'CAST' | 'INVALID' | 'NO_MANA' | 'COOLDOWN';
  casterEntityId: number | null;
  anchorBuildingId: number | null;
}

export interface ElementalAuthoritySnapshot {
  attunements: AttunementSnapshot;
  spells: SpellAuthoritySnapshot;
  alignedElementalists: readonly { entityId: number; element: ElementId }[];
  pendingProductionAlignments: readonly { productionOrderId: number; element: ElementId }[];
  activeStrategicZones: readonly ActiveStrategicZoneSnapshot[];
  lastCastResult: V2SpellCastResult | null;
}

export interface M04SimulationSnapshot extends M03SimulationSnapshot {
  roguelite: RogueliteSnapshot;
  elementalMana: ElementalManaSnapshot;
  elementalAuthority: ElementalAuthoritySnapshot;
}

const PLAYER_ID = 0;
const SPELL_IDS = Object.keys(ELEMENTAL_SPELLS) as ElementalCastEffectId[];
const DEFAULT_STARTING_ATTUNEMENTS: Readonly<Record<number, StartingAttunements>> = {
  0: ['FIRE', 'WATER'],
  1: ['ICE', 'LIGHTNING'],
};

interface PendingTrainIntent {
  playerId: number;
  buildingId: number;
  alignment: ElementId;
}

function radiusModifierStat(effectId: TerrainCastCommand['effectId']): ModifierStat {
  if (effectId === 'FIRE') return 'FIRE_RADIUS_PERMILLE';
  if (effectId === 'HEAT') return 'HEAT_RADIUS_PERMILLE';
  return 'FREEZE_RADIUS_PERMILLE';
}

function v2RadiusModifierStat(spellId: TacticalSpellId): ModifierStat | null {
  if (spellId === 'FIREBOLT') return 'FIRE_RADIUS_PERMILLE';
  if (spellId === 'FREEZE') return 'FREEZE_RADIUS_PERMILLE';
  return null;
}

function sameFreezeAction(left: CastCommand, right: CastCommand | undefined): boolean {
  return right !== undefined
    && left.effectId === 'FREEZE'
    && right.effectId === 'FREEZE'
    && left.playerId === right.playerId
    && left.targetTick === right.targetTick
    && left.targetX === right.targetX
    && left.targetZ === right.targetZ
    && left.radius === right.radius;
}

export class M04Simulation extends M03Simulation {
  readonly roguelite: RogueliteState;
  readonly attunements: AttunementState;
  readonly spellAuthority = new SpellAuthorityState();
  private readonly rogueliteCommands = new M04CommandQueue();
  private readonly elementalCastCommands = new CommandQueue();
  private readonly semanticSpellCommands = new SemanticSpellCommandQueue();
  private readonly alignedTrainCommands = new M03CommandQueue();
  private readonly playerManaRules: boolean;
  private readonly spellReadyTick = new Map<ElementalCastEffectId, number>();
  private readonly productionAlignments = new Map<number, ElementId>();
  private activeStrategicZones: ActiveStrategicZoneSnapshot[] = [];
  private nextStrategicZoneId = 1;
  private lastCastResult: ElementalCastResult | null = null;
  private lastV2CastResult: V2SpellCastResult | null = null;

  constructor(generatedWorld: GeneratedWorld, options: M04SimulationOptions = {}) {
    super(generatedWorld);
    this.roguelite = new RogueliteState(generatedWorld);
    this.playerManaRules = options.playerManaRules ?? false;
    const initial: Record<number, StartingAttunements> = {
      0: options.startingAttunementsByPlayer?.[0] ?? DEFAULT_STARTING_ATTUNEMENTS[0]!,
      1: options.startingAttunementsByPlayer?.[1] ?? DEFAULT_STARTING_ATTUNEMENTS[1]!,
    };
    this.attunements = new AttunementState(initial);
    for (const effectId of SPELL_IDS) this.spellReadyTick.set(effectId, 0);
  }

  enqueueRogueliteCommand(command: M04Command): void {
    this.rogueliteCommands.enqueue(command);
  }

  override enqueueStrategicCommand(command: M03Command): void {
    if (!this.playerManaRules || command.type !== 'TRAIN') {
      super.enqueueStrategicCommand(command);
      return;
    }
    if (command.unitType !== 'ELEMENTALIST') {
      if (command.elementalistAlignment === undefined) super.enqueueStrategicCommand(command);
      return;
    }

    let alignment = command.elementalistAlignment;
    if (alignment === undefined && command.playerId !== PLAYER_ID) {
      const unlocked = this.attunements.unlocked(command.playerId);
      alignment = unlocked[(command.buildingId + command.targetTick) % unlocked.length];
    }
    if (alignment === undefined) return;
    this.alignedTrainCommands.enqueue({ ...command, elementalistAlignment: alignment });
  }

  override enqueueCommand(command: M04GameCommand): void {
    if (command.type === 'CAST_TACTICAL' || command.type === 'CAST_STRATEGIC') {
      if (this.playerManaRules) this.semanticSpellCommands.enqueue(command);
      return;
    }
    if (command.type !== 'CAST') {
      super.enqueueCommand(command);
      return;
    }
    if (!this.playerManaRules || command.playerId !== PLAYER_ID) {
      this.dispatchCast(command);
      return;
    }
    // Legacy player CAST remains regression-compatible during migration. Player UI should issue semantic v2 casts.
    this.elementalCastCommands.enqueue(command);
  }

  override step(): M04SimulationSnapshot {
    const nextTick = super.snapshot().tick + 1;
    const strategicBeforeCommands = this.strategy.snapshot();
    const entityIdsBefore = new Set(this.entities.entityIds());
    const trainIntents = this.forwardAlignedTrainCommands(nextTick);

    for (const command of this.rogueliteCommands.drainForTick(nextTick)) {
      this.roguelite.processCommand(command, strategicBeforeCommands, nextTick);
    }

    if (this.playerManaRules) {
      this.strategy.clampManaMilli(PLAYER_ID, this.roguelite.maxManaMilli(PLAYER_ID));
      this.advanceStrategicZones(nextTick);
      this.processSemanticSpells(nextTick);
      this.processElementalCasts(nextTick);
    }

    const frame = super.step();
    this.reconcileProductionAlignments(strategicBeforeCommands, entityIdsBefore, trainIntents);
    this.roguelite.advance(frame.tick);
    if (this.playerManaRules) {
      this.strategy.clampManaMilli(PLAYER_ID, this.roguelite.maxManaMilli(PLAYER_ID));
    }
    return this.snapshot();
  }

  override snapshot(): M04SimulationSnapshot {
    const base = super.snapshot();
    const roguelite = this.roguelite.snapshot();
    const elementalMana = this.elementalManaSnapshot(base.tick, base.strategic);
    const elementalAuthority = this.elementalAuthoritySnapshot();
    const cooldownHash = this.playerManaRules
      ? SPELL_IDS.map((effectId) => `${effectId}:${this.spellReadyTick.get(effectId) ?? 0}`).join(',')
      : 'off';
    return {
      ...base,
      stateHash: `${base.stateHash}:${roguelite.stateHash}:mana:${cooldownHash}:attune:${elementalAuthority.attunements.stateHash}:spell:${elementalAuthority.spells.stateHash}:align:${this.alignmentHash()}:zones:${this.zoneHash()}`,
      queuedCommandCount: base.queuedCommandCount
        + this.rogueliteCommands.size
        + this.elementalCastCommands.size
        + this.semanticSpellCommands.size
        + this.alignedTrainCommands.size,
      roguelite,
      elementalMana,
      elementalAuthority,
    };
  }

  private forwardAlignedTrainCommands(tick: number): PendingTrainIntent[] {
    const intents: PendingTrainIntent[] = [];
    for (const command of this.alignedTrainCommands.drainForTick(tick)) {
      if (command.type !== 'TRAIN' || command.unitType !== 'ELEMENTALIST') continue;
      const alignment = command.elementalistAlignment;
      if (!alignment || !this.attunements.has(command.playerId, alignment)) continue;
      super.enqueueStrategicCommand(command);
      intents.push({ playerId: command.playerId, buildingId: command.buildingId, alignment });
    }
    return intents;
  }

  private reconcileProductionAlignments(
    strategicBefore: M03SimulationSnapshot['strategic'],
    entityIdsBefore: ReadonlySet<number>,
    intents: readonly PendingTrainIntent[],
  ): void {
    const strategicAfter = this.strategy.snapshot();
    const beforeOrderIds = new Set(strategicBefore.productionQueue.map((order) => order.id));
    const remainingIntents = [...intents];
    const newOrders = strategicAfter.productionQueue
      .filter((order) => !beforeOrderIds.has(order.id) && order.unitType === 'ELEMENTALIST')
      .sort((left, right) => left.id - right.id);
    for (const order of newOrders) {
      const index = remainingIntents.findIndex((intent) => (
        intent.playerId === order.playerId && intent.buildingId === order.buildingId
      ));
      if (index < 0) continue;
      const [intent] = remainingIntents.splice(index, 1);
      if (intent) this.productionAlignments.set(order.id, intent.alignment);
    }

    const afterOrderIds = new Set(strategicAfter.productionQueue.map((order) => order.id));
    const completedOrders = strategicBefore.productionQueue
      .filter((order) => this.productionAlignments.has(order.id) && !afterOrderIds.has(order.id))
      .sort((left, right) => left.completeTick - right.completeTick || left.id - right.id);
    const newElementalists = this.entities.entityIds()
      .filter((entityId) => !entityIdsBefore.has(entityId) && this.entities.archetypes.get(entityId) === 'ELEMENTALIST')
      .sort((left, right) => left - right);
    const available = [...newElementalists];
    for (const order of completedOrders) {
      const alignment = this.productionAlignments.get(order.id);
      this.productionAlignments.delete(order.id);
      if (!alignment) continue;
      const index = available.findIndex((entityId) => this.entities.factions.get(entityId)?.playerId === order.playerId);
      if (index < 0) continue;
      const [entityId] = available.splice(index, 1);
      if (entityId !== undefined) this.entities.setElementalAlignment(entityId, alignment);
    }
  }

  private processSemanticSpells(tick: number): void {
    for (const command of this.semanticSpellCommands.drainForTick(tick)) {
      if (command.type === 'CAST_TACTICAL') this.processTacticalSpell(command, tick);
      else this.processStrategicSpell(command, tick);
    }
  }

  private processTacticalSpell(command: CastTacticalSpellCommand, tick: number): void {
    const spell = TACTICAL_SPELLS[command.spellId];
    const caster = this.spellAuthority.selectTacticalCaster(
      command.playerId,
      command.spellId,
      command.candidateCasterIds,
      command.target,
      tick,
      this.entities,
      this.attunements,
      this.visibility,
      this.navigation,
    );
    if (caster === null) {
      this.lastV2CastResult = {
        tick, playerId: command.playerId, layer: 'TACTICAL', spellId: command.spellId,
        status: 'INVALID', casterEntityId: null, anchorBuildingId: null,
      };
      return;
    }
    if (!this.strategy.spendManaMilli(command.playerId, spell.manaCostMilli)) {
      this.lastV2CastResult = {
        tick, playerId: command.playerId, layer: 'TACTICAL', spellId: command.spellId,
        status: 'NO_MANA', casterEntityId: caster, anchorBuildingId: null,
      };
      return;
    }
    this.spellAuthority.startTacticalCooldown(caster, command.spellId, tick);

    if (command.spellId === 'CHAIN_LIGHTNING' && command.target.kind === 'ENTITY') {
      this.dispatchCast({
        type: 'CAST', targetTick: tick, playerId: command.playerId,
        effectId: 'CHAIN_LIGHTNING', targetEntityId: command.target.entityId,
      });
    } else if (command.target.kind === 'POINT') {
      const stat = v2RadiusModifierStat(command.spellId);
      const modifier = stat === null ? 0 : this.roguelite.modifier(command.playerId, stat);
      const radius = Math.max(0, Math.round((spell.radius * (1000 + modifier)) / 1000));
      applyV2TerrainPulse(
        spell.resolver as 'FIRE' | 'WATER' | 'FREEZE',
        command.playerId,
        spell.impactFactionPolicy,
        command.target.x,
        command.target.z,
        radius,
        this.entities,
        this.terrain,
        this.navigation,
      );
    }
    this.lastV2CastResult = {
      tick, playerId: command.playerId, layer: 'TACTICAL', spellId: command.spellId,
      status: 'CAST', casterEntityId: caster, anchorBuildingId: null,
    };
  }

  private processStrategicSpell(command: CastStrategicSpellCommand, tick: number): void {
    const spell = STRATEGIC_SPELLS[command.spellId];
    if (!this.spellAuthority.strategicReady(command.playerId, command.spellId, tick)) {
      this.lastV2CastResult = {
        tick, playerId: command.playerId, layer: 'STRATEGIC', spellId: command.spellId,
        status: 'COOLDOWN', casterEntityId: null, anchorBuildingId: null,
      };
      return;
    }
    const strategic = this.strategy.snapshot();
    const anchor = this.spellAuthority.selectStrategicAnchor(
      command.playerId,
      command.spellId,
      command.target,
      tick,
      strategic,
      this.attunements,
      this.visibility,
      this.navigation,
    );
    if (anchor === null) {
      this.lastV2CastResult = {
        tick, playerId: command.playerId, layer: 'STRATEGIC', spellId: command.spellId,
        status: 'INVALID', casterEntityId: null, anchorBuildingId: null,
      };
      return;
    }
    if (!this.strategy.spendManaMilli(command.playerId, spell.manaCostMilli)) {
      this.lastV2CastResult = {
        tick, playerId: command.playerId, layer: 'STRATEGIC', spellId: command.spellId,
        status: 'NO_MANA', casterEntityId: null, anchorBuildingId: anchor,
      };
      return;
    }
    this.spellAuthority.startStrategicCooldown(command.playerId, command.spellId, tick);
    const zone: ActiveStrategicZoneSnapshot = {
      id: this.nextStrategicZoneId,
      playerId: command.playerId,
      spellId: command.spellId,
      targetX: command.target.x,
      targetZ: command.target.z,
      startTick: tick,
      endTick: tick + spell.durationTicks,
      nextPulseTick: tick + STRATEGIC_PULSE_INTERVAL_TICKS,
    };
    this.nextStrategicZoneId += 1;
    this.activeStrategicZones.push(zone);
    this.applyStrategicPulse(zone);
    this.lastV2CastResult = {
      tick, playerId: command.playerId, layer: 'STRATEGIC', spellId: command.spellId,
      status: 'CAST', casterEntityId: null, anchorBuildingId: anchor,
    };
  }

  private advanceStrategicZones(tick: number): void {
    const next: ActiveStrategicZoneSnapshot[] = [];
    for (const zone of [...this.activeStrategicZones].sort((left, right) => left.id - right.id)) {
      if (tick >= zone.endTick) continue;
      if (tick >= zone.nextPulseTick) {
        this.applyStrategicPulse(zone);
        zone.nextPulseTick += STRATEGIC_PULSE_INTERVAL_TICKS;
      }
      next.push(zone);
    }
    this.activeStrategicZones = next;
  }

  private applyStrategicPulse(zone: ActiveStrategicZoneSnapshot): void {
    const spell = STRATEGIC_SPELLS[zone.spellId];
    if (zone.spellId === 'INFERNO') {
      applyV2TerrainPulse('FIRE', zone.playerId, 'ALL_FACTIONS', zone.targetX, zone.targetZ, spell.radius, this.entities, this.terrain, this.navigation);
      return;
    }
    if (zone.spellId === 'DELUGE') {
      applyV2TerrainPulse('WATER', zone.playerId, 'ALL_FACTIONS', zone.targetX, zone.targetZ, spell.radius, this.entities, this.terrain, this.navigation);
      return;
    }
    if (zone.spellId === 'BLIZZARD') {
      applyV2TerrainPulse('FREEZE', zone.playerId, 'ALL_FACTIONS', zone.targetX, zone.targetZ, spell.radius, this.entities, this.terrain, this.navigation);
      return;
    }
    const changes = this.terrain.applyEffects([{
      effectId: 'WATER', targetX: zone.targetX, targetZ: zone.targetZ, radius: spell.radius, sourcePlayerId: zone.playerId,
    }]);
    this.navigation.applyWalkabilityChanges(changes);
    applyThunderstormPulse(zone.targetX, zone.targetZ, spell.radius, this.entities, this.terrain, this.navigation);
  }

  private processElementalCasts(tick: number): void {
    const due = this.elementalCastCommands.drainForTick(tick).filter((command): command is CastCommand => command.type === 'CAST');
    for (let index = 0; index < due.length; index += 1) {
      const command = due[index]!;
      const group = sameFreezeAction(command, due[index + 1])
        ? [command, due[index + 1]!] as const
        : [command] as const;
      if (group.length === 2) index += 1;

      const spell = ELEMENTAL_SPELLS[command.effectId];
      const readyTick = this.spellReadyTick.get(command.effectId) ?? 0;
      if (tick < readyTick) {
        this.lastCastResult = { tick, playerId: command.playerId, effectId: command.effectId, status: 'COOLDOWN' };
        continue;
      }
      if (!this.strategy.spendManaMilli(command.playerId, spell.manaCostMilli)) {
        this.lastCastResult = { tick, playerId: command.playerId, effectId: command.effectId, status: 'NO_MANA' };
        continue;
      }

      this.spellReadyTick.set(command.effectId, tick + spell.cooldownTicks);
      for (const grouped of group) this.dispatchCast(grouped);
      this.lastCastResult = { tick, playerId: command.playerId, effectId: command.effectId, status: 'CAST' };
    }
  }

  private dispatchCast(command: CastCommand): void {
    if (command.effectId !== 'CHAIN_LIGHTNING') {
      const additivePermille = this.roguelite.modifier(command.playerId, radiusModifierStat(command.effectId));
      const radius = Math.max(0, Math.round((command.radius * (1000 + additivePermille)) / 1000));
      super.enqueueCommand({ ...command, radius });
      return;
    }

    super.enqueueCommand(command);
    let extraCasts = this.roguelite.trigger(command.playerId, 'CAST_CHAIN_LIGHTNING', 'EXTRA_LIGHTNING_CAST');
    if (this.entities.statuses.get(command.targetEntityId)?.wet === true) {
      extraCasts += this.roguelite.trigger(command.playerId, 'CAST_CHAIN_LIGHTNING_ON_WET_TARGET', 'EXTRA_LIGHTNING_CAST');
    }
    for (let index = 0; index < Math.min(3, extraCasts); index += 1) super.enqueueCommand(command);
  }

  private elementalManaSnapshot(
    tick: number,
    strategic: M03SimulationSnapshot['strategic'],
  ): ElementalManaSnapshot {
    const current = strategic.resources[PLAYER_ID]?.manaMilli ?? 0;
    const cooldownTicks = Object.fromEntries(SPELL_IDS.map((effectId) => [
      effectId,
      Math.max(0, (this.spellReadyTick.get(effectId) ?? 0) - tick),
    ])) as Record<ElementalCastEffectId, number>;
    return {
      enabled: this.playerManaRules,
      players: {
        [PLAYER_ID]: {
          currentManaMilli: current,
          maxManaMilli: this.roguelite.maxManaMilli(PLAYER_ID),
          cooldownTicks,
        },
      },
      lastCastResult: this.lastCastResult === null ? null : { ...this.lastCastResult },
    };
  }

  private elementalAuthoritySnapshot(): ElementalAuthoritySnapshot {
    const alignedElementalists = [...this.entities.elementalAlignments.entries()]
      .map(([entityId, alignment]) => ({ entityId, element: alignment.element }))
      .sort((left, right) => left.entityId - right.entityId);
    const pendingProductionAlignments = [...this.productionAlignments.entries()]
      .map(([productionOrderId, element]) => ({ productionOrderId, element }))
      .sort((left, right) => left.productionOrderId - right.productionOrderId);
    return {
      attunements: this.attunements.snapshot(),
      spells: this.spellAuthority.snapshot(),
      alignedElementalists,
      pendingProductionAlignments,
      activeStrategicZones: this.activeStrategicZones.map((zone) => ({ ...zone })).sort((left, right) => left.id - right.id),
      lastCastResult: this.lastV2CastResult === null ? null : { ...this.lastV2CastResult },
    };
  }

  private alignmentHash(): string {
    return [...this.entities.elementalAlignments.entries()]
      .sort(([left], [right]) => left - right)
      .map(([entityId, alignment]) => `${entityId}:${alignment.element}`)
      .concat([...this.productionAlignments.entries()].sort(([left], [right]) => left - right).map(([orderId, element]) => `p${orderId}:${element}`))
      .join(',');
  }

  private zoneHash(): string {
    return this.activeStrategicZones
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((zone) => `${zone.id}:${zone.playerId}:${zone.spellId}:${zone.targetX}:${zone.targetZ}:${zone.startTick}:${zone.endTick}:${zone.nextPulseTick}`)
      .join(',');
  }
}
