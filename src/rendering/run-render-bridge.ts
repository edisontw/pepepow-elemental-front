import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { RunSnapshot } from '../simulation/run-state';

function material(color: pc.Color, emissive: pc.Color, opacity = 1): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = 1.45;
  result.gloss = 0.38;
  result.opacity = opacity;
  if (opacity < 1) result.blendType = pc.BLEND_NORMAL;
  result.update();
  return result;
}

export class RunRenderBridge {
  private readonly boss = new pc.Entity('M06 Boss Objective');
  private readonly bossBody = new pc.Entity('Boss Body');
  private readonly bossCore = new pc.Entity('Boss Core');
  private readonly orbitNodes: pc.Entity[] = [];
  private readonly abilityPulse = new pc.Entity('Boss Ability Pulse');
  private readonly dormantMaterial = material(new pc.Color(0.24, 0.22, 0.28), new pc.Color(0.04, 0.03, 0.05));
  private readonly frostMaterial = material(new pc.Color(0.56, 0.86, 0.96), new pc.Color(0.12, 0.3, 0.42));
  private readonly stormMaterial = material(new pc.Color(0.58, 0.48, 0.96), new pc.Color(0.25, 0.12, 0.5));
  private readonly infernalMaterial = material(new pc.Color(0.92, 0.25, 0.08), new pc.Color(0.5, 0.05, 0.01));
  private readonly pulseFrostMaterial = material(new pc.Color(0.66, 0.94, 1), new pc.Color(0.18, 0.52, 0.72), 0.34);
  private readonly pulseStormMaterial = material(new pc.Color(0.72, 0.62, 1), new pc.Color(0.36, 0.18, 0.8), 0.34);
  private readonly pulseInfernalMaterial = material(new pc.Color(1, 0.4, 0.08), new pc.Color(0.8, 0.08, 0.01), 0.34);

  constructor(private readonly app: pc.Application) {
    this.bossBody.addComponent('render', { type: 'capsule', material: this.dormantMaterial });
    this.bossBody.setLocalPosition(0, 0, 0);
    this.boss.addChild(this.bossBody);

    this.bossCore.addComponent('render', { type: 'sphere', material: this.dormantMaterial });
    this.bossCore.setLocalPosition(0, 1.2, 0);
    this.bossCore.setLocalScale(0.72, 0.72, 0.72);
    this.boss.addChild(this.bossCore);

    for (let index = 0; index < 3; index += 1) {
      const node = new pc.Entity(`Boss Orbit Node ${index + 1}`);
      node.addComponent('render', { type: 'sphere', material: this.dormantMaterial });
      node.setLocalScale(0.28, 0.28, 0.28);
      this.boss.addChild(node);
      this.orbitNodes.push(node);
    }
    this.app.root.addChild(this.boss);

    this.abilityPulse.addComponent('render', { type: 'cylinder', material: this.pulseStormMaterial });
    this.abilityPulse.setLocalScale(1, 0.028, 1);
    this.abilityPulse.enabled = false;
    this.app.root.addChild(this.abilityPulse);
  }

  sync(snapshot: RunSnapshot, tick: number, alpha = 0): void {
    const boss = snapshot.boss;
    this.boss.enabled = snapshot.mode === 'BOSS_HUNT' && boss.currentHealth > 0;
    if (!this.boss.enabled) {
      this.abilityPulse.enabled = false;
      return;
    }

    const x = boss.x / WORLD_UNITS_PER_METER;
    const z = boss.z / WORLD_UNITS_PER_METER;
    this.boss.setPosition(x, boss.active ? 2.4 : 1.25, z);
    const healthPermille = Math.max(150, Math.floor((boss.currentHealth * 1000) / boss.maxHealth));
    const scale = boss.active ? 1.2 + healthPermille / 1000 : 0.72;
    this.boss.setLocalScale(scale, boss.active ? 4.8 : 2.5, scale);

    const activeMaterial = !boss.active
      ? this.dormantMaterial
      : boss.type === 'FROST_TITAN'
        ? this.frostMaterial
        : boss.type === 'STORM_COLOSSUS'
          ? this.stormMaterial
          : this.infernalMaterial;
    if (this.bossBody.render) this.bossBody.render.material = activeMaterial;
    if (this.bossCore.render) this.bossCore.render.material = activeMaterial;

    const orbitPhase = ((tick + alpha) % 32) / 32 * Math.PI * 2;
    for (let index = 0; index < this.orbitNodes.length; index += 1) {
      const node = this.orbitNodes[index]!;
      const angle = orbitPhase + index * (Math.PI * 2 / this.orbitNodes.length);
      node.setLocalPosition(Math.cos(angle) * 1.18, 0.7 + Math.sin(angle * 2) * 0.16, Math.sin(angle) * 1.18);
      if (node.render) node.render.material = activeMaterial;
      node.enabled = boss.active;
    }

    const abilityAge = tick - boss.lastAbilityTick;
    const showAbility = boss.active && boss.lastAbilityTick >= 0 && abilityAge >= 0 && abilityAge <= 10;
    this.abilityPulse.enabled = showAbility;
    if (!showAbility) return;

    const progress = Math.max(0, Math.min(1, (abilityAge + alpha) / 10));
    this.abilityPulse.setPosition(x, 0.14, z);
    const pulseScale = 1.5 + progress * 8.5;
    this.abilityPulse.setLocalScale(pulseScale, 0.028, pulseScale);
    if (this.abilityPulse.render) {
      this.abilityPulse.render.material = boss.type === 'FROST_TITAN'
        ? this.pulseFrostMaterial
        : boss.type === 'STORM_COLOSSUS'
          ? this.pulseStormMaterial
          : this.pulseInfernalMaterial;
    }
  }

  destroy(): void {
    this.boss.destroy();
    this.abilityPulse.destroy();
    this.dormantMaterial.destroy();
    this.frostMaterial.destroy();
    this.stormMaterial.destroy();
    this.infernalMaterial.destroy();
    this.pulseFrostMaterial.destroy();
    this.pulseStormMaterial.destroy();
    this.pulseInfernalMaterial.destroy();
  }
}
