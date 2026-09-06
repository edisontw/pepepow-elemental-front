import * as pc from 'playcanvas';
import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import type { RunSnapshot } from '../simulation/run-state';

function material(color: pc.Color, emissive: pc.Color): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.emissive = emissive;
  result.emissiveIntensity = 1.25;
  result.gloss = 0.35;
  result.update();
  return result;
}

export class RunRenderBridge {
  private readonly boss: pc.Entity;
  private readonly dormantMaterial = material(new pc.Color(0.24, 0.22, 0.28), new pc.Color(0.04, 0.03, 0.05));
  private readonly frostMaterial = material(new pc.Color(0.56, 0.86, 0.96), new pc.Color(0.12, 0.3, 0.42));
  private readonly stormMaterial = material(new pc.Color(0.58, 0.48, 0.96), new pc.Color(0.25, 0.12, 0.5));
  private readonly infernalMaterial = material(new pc.Color(0.92, 0.25, 0.08), new pc.Color(0.5, 0.05, 0.01));

  constructor(private readonly app: pc.Application) {
    this.boss = new pc.Entity('M06 Boss Objective');
    this.boss.addComponent('render', { type: 'capsule', material: this.dormantMaterial });
    this.app.root.addChild(this.boss);
  }

  sync(snapshot: RunSnapshot): void {
    const boss = snapshot.boss;
    this.boss.enabled = snapshot.mode === 'BOSS_HUNT' && boss.currentHealth > 0;
    if (!this.boss.enabled) return;
    this.boss.setPosition(
      boss.x / WORLD_UNITS_PER_METER,
      boss.active ? 2.4 : 1.25,
      boss.z / WORLD_UNITS_PER_METER,
    );
    const healthPermille = Math.max(150, Math.floor((boss.currentHealth * 1000) / boss.maxHealth));
    const scale = boss.active ? 1.2 + healthPermille / 1000 : 0.72;
    this.boss.setLocalScale(scale, boss.active ? 4.8 : 2.5, scale);
    if (!this.boss.render) return;
    if (!boss.active) this.boss.render.material = this.dormantMaterial;
    else if (boss.type === 'FROST_TITAN') this.boss.render.material = this.frostMaterial;
    else if (boss.type === 'STORM_COLOSSUS') this.boss.render.material = this.stormMaterial;
    else this.boss.render.material = this.infernalMaterial;
  }

  destroy(): void {
    this.boss.destroy();
    this.dormantMaterial.destroy();
    this.frostMaterial.destroy();
    this.stormMaterial.destroy();
    this.infernalMaterial.destroy();
  }
}
