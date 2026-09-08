import { CommandQueue, type CastCommand, type GameCommand, type TerrainCastCommand } from './commands';
import type { M04Command } from './m04-commands';
import { M04CommandQueue } from './m04-commands';
import { M03Simulation, type M03SimulationSnapshot } from './m03-simulation';
import { RogueliteState, type RogueliteSnapshot } from './roguelite-state';
import {
  ELEMENTAL_SPELLS,
  type ElementalCastEffectId,
  type ModifierStat,
} from './m04-content';
import type { GeneratedWorld } from '../world/world-definition';

export interface M04SimulationOptions {
  /** M04 historical tests remain compatible; M05/M06 enable the player Mana rules by default. */
  playerManaRules?: boolean;
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

export interface M04SimulationSnapshot extends M03SimulationSnapshot {
  roguelite: RogueliteSnapshot;
  elementalMana: ElementalManaSnapshot;
}

const PLAYER_ID = 0;
const SPELL_IDS = Object.keys(ELEMENTAL_SPELLS) as ElementalCastEffectId[];

function radiusModifierStat(effectId: TerrainCastCommand['effectId']): ModifierStat {
  if (effectId === 'FIRE') return 'FIRE_RADIUS_PERMILLE';
  if (effectId === 'HEAT') return 'HEAT_RADIUS_PERMILLE';
  return 'FREEZE_RADIUS_PERMILLE';
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
  private readonly rogueliteCommands = new M04CommandQueue();
  private readonly elementalCastCommands = new CommandQueue();
  private readonly playerManaRules: boolean;
  private readonly spellReadyTick = new Map<ElementalCastEffectId, number>();
  private lastCastResult: ElementalCastResult | null = null;

  constructor(generatedWorld: GeneratedWorld, options: M04SimulationOptions = {}) {
    super(generatedWorld);
    this.roguelite = new RogueliteState(generatedWorld);
    this.playerManaRules = options.playerManaRules ?? false;
    for (const effectId of SPELL_IDS) this.spellReadyTick.set(effectId, 0);
  }

  enqueueRogueliteCommand(command: M04Command): void {
    this.rogueliteCommands.enqueue(command);
  }

  override enqueueCommand(command: GameCommand): void {
    if (command.type !== 'CAST') {
      super.enqueueCommand(command);
      return;
    }
    if (!this.playerManaRules || command.playerId !== PLAYER_ID) {
      this.dispatchCast(command);
      return;
    }
    this.elementalCastCommands.enqueue(command);
  }

  override step(): M04SimulationSnapshot {
    const nextTick = super.snapshot().tick + 1;
    const strategic = this.strategy.snapshot();
    for (const command of this.rogueliteCommands.drainForTick(nextTick)) {
      this.roguelite.processCommand(command, strategic, nextTick);
    }

    if (this.playerManaRules) {
      this.strategy.clampManaMilli(PLAYER_ID, this.roguelite.maxManaMilli(PLAYER_ID));
      this.processElementalCasts(nextTick);
    }

    const frame = super.step();
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
    const cooldownHash = this.playerManaRules
      ? SPELL_IDS.map((effectId) => `${effectId}:${this.spellReadyTick.get(effectId) ?? 0}`).join(',')
      : 'off';
    return {
      ...base,
      stateHash: `${base.stateHash}:${roguelite.stateHash}:mana:${cooldownHash}`,
      queuedCommandCount: base.queuedCommandCount + this.rogueliteCommands.size + this.elementalCastCommands.size,
      roguelite,
      elementalMana,
    };
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
}
