import * as pc from 'playcanvas';
import type { M04SimulationSnapshot } from '../simulation/m04-simulation';
import type { M06SimulationSnapshot } from '../simulation/m06-simulation';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { EntityID } from '../simulation/components';
import type { EntitySnapshot, SimulationSnapshot } from '../simulation/simulation';
import { BattleVfx } from './battle-vfx';
import { UnitAnimationController } from './unit-animation-controller';
import { UnitRenderBridge } from './unit-render-bridge';
import { VisualAssetLibrary } from './visual-asset-library';

function snapshotMap(snapshot: SimulationSnapshot): Map<EntityID, EntitySnapshot> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

function modelIdForUnit(
  unit: EntitySnapshot,
  alignments: ReadonlyMap<number, string>,
): string {
  if (unit.archetype === 'VANGUARD') return 'unit.vanguard';
  if (unit.archetype === 'ELEMENTALIST') {
    const alignment = alignments.get(unit.id);
    return alignment ? `unit.elementalist.${alignment.toLowerCase()}` : '';
  }
  const specialistModelId: Readonly<Record<string, string>> = {
    SPEAR_GUARD: 'unit.spear-guard',
    RANGER: 'unit.ranger',
    SCOUT: 'unit.scout',
    ENGINEER: 'unit.engineer',
    GOLEM: 'unit.golem',
    SIEGE_CONSTRUCT: 'unit.siege-construct',
  };
  return specialistModelId[unit.archetype] ?? '';
}

function loadedModelRoot(unitRoot: pc.Entity): pc.Entity | null {
  for (const child of unitRoot.children) {
    const entity = child as pc.Entity;
    if (!entity.enabled) continue;
    if (entity.findByName('ModelRoot') || entity.findByName('LegL') || entity.findByName('Weapon')) return entity;
  }
  return null;
}

/**
 * U0 migration wrapper: preserves the authoritative UnitRenderBridge and layers
 * clip playback/grounding on top. This can be collapsed into UnitRenderBridge
 * after the animated asset pipeline is proven across the roster.
 */
export class AnimatedUnitRenderBridge extends UnitRenderBridge {
  private animationControllers: Map<EntityID, UnitAnimationController> | undefined;
  private lastFacingYaw: Map<EntityID, number> | undefined;

  constructor(
    private readonly animationApp: pc.Application,
    initialSnapshot: SimulationSnapshot,
    unitMaterials: { player: pc.Material; enemyMelee: pc.Material; enemyRanged: pc.Material },
    selectionMaterial: pc.Material,
    healthMaterial: pc.Material,
    visualAssets: VisualAssetLibrary,
    effects: BattleVfx,
  ) {
    super(animationApp, initialSnapshot, unitMaterials, selectionMaterial, healthMaterial, visualAssets, effects);
    this.animationControllers = new Map();
    this.lastFacingYaw = new Map();
  }

  override sync(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number): void {
    super.sync(previous, current, alpha);
    if (!this.animationControllers || !this.lastFacingYaw) return;

    const previousById = snapshotMap(previous);
    const authority = (current as Partial<M04SimulationSnapshot>).elementalAuthority;
    const alignments = new Map<number, string>(
      authority?.alignedElementalists.map((entry) => [entry.entityId, entry.element]) ?? [],
    );
    const cast = authority?.lastCastResult;
    const run = (current as Partial<M06SimulationSnapshot>).run;
    const objectiveAttackIds = new Set(run?.objectiveAttackOrders.map((order) => order.entityId) ?? []);

    for (const unit of current.entities) {
      const modelId = modelIdForUnit(unit, alignments);
      if (!modelId) continue;
      const unitRoot = this.animationApp.root.findByName(`Unit ${unit.id}`) as pc.Entity | null;
      if (!unitRoot) continue;
      const modelRoot = loadedModelRoot(unitRoot);
      let controller = this.animationControllers.get(unit.id);
      if (!controller) {
        controller = new UnitAnimationController(this.animationApp);
        this.animationControllers.set(unit.id, controller);
      }

      const prior = previousById.get(unit.id) ?? unit;
      const moving = unit.frozenTicks === 0 && (unit.x !== prior.x || unit.z !== prior.z);
      const attacked = unit.alive
        && (unit.attackTargetEntityId !== null || objectiveAttackIds.has(unit.id))
        && unit.nextAttackTick > prior.nextAttackTick;
      const casted = unit.alive
        && cast?.status === 'CAST'
        && cast.casterEntityId === unit.id
        && cast.tick === current.tick;
      const hit = prior.alive && prior.currentHealth > unit.currentHealth;
      const displacementMetres = Math.hypot(unit.x - prior.x, unit.z - prior.z) / WORLD_UNITS_PER_METER;
      const movePlaybackRate = moving ? pc.math.clamp(displacementMetres / 0.34, 0.72, 1.35) : 1;

      controller.sync(modelId, modelRoot, {
        tick: current.tick,
        moving,
        frozen: unit.frozenTicks > 0,
        attack: attacked,
        cast: casted,
        hit,
        dead: !unit.alive,
        movePlaybackRate,
      });

      if (!modelRoot) continue;
      const position = unitRoot.getPosition();
      if (unit.alive) {
        // Remove the legacy full-body sinusoidal bob once a real GLB is loaded.
        // Locomotion now comes from clips (or, for missing clips, named-node gait).
        unitRoot.setPosition(position.x, 0, position.z);
        this.lastFacingYaw.set(unit.id, unitRoot.getEulerAngles().y);
      } else if (unitRoot.enabled && controller.hasClip('DEATH')) {
        // Keep the existing renderer cleanup window authoritative. The clip may
        // pose a dying unit, but it must not resurrect a root after cleanup.
        const x = pc.math.lerp(prior.x, unit.x, alpha) / WORLD_UNITS_PER_METER;
        const z = pc.math.lerp(prior.z, unit.z, alpha) / WORLD_UNITS_PER_METER;
        unitRoot.setPosition(x, 0, z);
        unitRoot.setEulerAngles(0, this.lastFacingYaw.get(unit.id) ?? 0, 0);
      }

      if (controller.hasAnyClip) {
        // The generated/current GLBs are +Z-forward with an identity model root.
        // Reset legacy renderer recoil tilt on the instantiated container; clips
        // own only local presentation pose, never authoritative world facing.
        modelRoot.setLocalEulerAngles(0, 0, 0);
      }
    }
  }

  override destroy(): void {
    for (const controller of this.animationControllers?.values() ?? []) controller.destroy();
    this.animationControllers?.clear();
    this.lastFacingYaw?.clear();
    super.destroy();
  }
}
