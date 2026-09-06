import { describe, expect, it } from 'vitest';
import { UNITS } from '../../src/simulation/m03-content';
import { finaleUnlockTick, phaseForTick } from '../../src/simulation/m06-content';
import { M06Simulation, isM06ReplayPacket } from '../../src/simulation/m06-simulation';
import { generateWorld } from '../../src/world/generator';

function livingIds(simulation: M06Simulation, playerId: number): number[] {
  return simulation.snapshot().entities
    .filter((entity) => entity.playerId === playerId && entity.alive)
    .map((entity) => entity.id);
}

function placeAndBuff(
  simulation: M06Simulation,
  playerId: number,
  x: number,
  z: number,
  damage: number,
): void {
  for (const entityId of livingIds(simulation, playerId)) {
    const position = simulation.entities.positions.get(entityId);
    const combat = simulation.entities.combat.get(entityId);
    if (position) {
      position.x = x;
      position.z = z;
    }
    if (combat) {
      combat.attackDamage = damage;
      combat.attackIntervalTicks = 1;
    }
  }
}

describe('M06 full run', () => {
  it('opens a deterministic smoke finale without bypassing the authoritative tick loop', () => {
    const world = generateWorld(1_000_000);
    const first = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    const second = new M06Simulation(world, { pace: 'SMOKE', difficulty: 'CASUAL' });
    for (let tick = 1; tick <= 299; tick += 1) {
      first.step();
      second.step();
    }
    expect(first.snapshot().run.finaleUnlocked).toBe(false);
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
    first.step();
    second.step();
    expect(first.snapshot().run).toMatchObject({
      phase: 'FINALE',
      finaleUnlocked: true,
      finaleUnlockedTick: 300,
      finaleUnlockReason: 'TIME',
    });
    expect(first.snapshot().stateHash).toBe(second.snapshot().stateHash);
  }, 15_000);

  it('completes Destroy with authoritative Core damage, victory, and score', () => {
    const simulation = new M06Simulation(generateWorld(1_000_001), {
      mode: 'DESTROY',
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    for (let tick = 1; tick < 300; tick += 1) simulation.step();
    const enemyCore = simulation.run.snapshot().enemyCore;
    placeAndBuff(simulation, 0, enemyCore.x, enemyCore.z, 5_000);
    const final = simulation.step();
    expect(final.run.outcome).toBe('VICTORY');
    expect(final.run.enemyCore).toMatchObject({ currentHealth: 0, state: 'DESTROYED' });
    expect(final.run.result?.reason).toBe('ENEMY_CORE_DESTROYED');
    expect(final.run.result?.score.victory).toBe(10_000);
    expect(final.run.result?.score.total).toBeGreaterThanOrEqual(10_000);
    expect(simulation.step().stateHash).toBe(final.stateHash);
  }, 15_000);

  it('uses the one-time 30-second Core Critical window, Engineer recovery, then final defeat', () => {
    const simulation = new M06Simulation(generateWorld(1_000_002), {
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    const playerCore = simulation.run.snapshot().playerCore;
    const enemyId = livingIds(simulation, 1)[0];
    expect(enemyId).toBeDefined();
    if (enemyId === undefined) return;
    const enemyPosition = simulation.entities.positions.get(enemyId)!;
    const enemyCombat = simulation.entities.combat.get(enemyId)!;
    enemyPosition.x = playerCore.x;
    enemyPosition.z = playerCore.z;
    enemyCombat.attackDamage = 50_000;
    enemyCombat.attackIntervalTicks = 1;

    simulation.step();
    expect(simulation.run.snapshot().playerCore).toMatchObject({
      currentHealth: 0,
      state: 'CRITICAL',
      criticalUsed: true,
    });
    expect(simulation.run.snapshot().playerCore.criticalTicksRemaining).toBeGreaterThanOrEqual(298);

    enemyPosition.x += 100_000;
    enemyPosition.z += 100_000;
    simulation.entities.createUnit({
      archetype: 'ENGINEER',
      playerId: 0,
      x: playerCore.x,
      z: playerCore.z,
      ...UNITS.ENGINEER.spawn,
    });
    for (let tick = 0; tick < 100; tick += 1) simulation.step();
    expect(simulation.run.snapshot().playerCore).toMatchObject({
      currentHealth: 500,
      state: 'ACTIVE',
      criticalUsed: true,
      criticalTicksRemaining: 0,
    });

    enemyPosition.x = playerCore.x;
    enemyPosition.z = playerCore.z;
    simulation.step();
    expect(simulation.run.snapshot().outcome).toBe('DEFEAT');
    expect(simulation.run.snapshot().result?.reason).toBe('PLAYER_CORE_DESTROYED');
  });

  it('activates a deterministic battlefield-modifying boss in Boss Hunt', () => {
    const simulation = new M06Simulation(generateWorld(1_000_003), {
      mode: 'BOSS_HUNT',
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    for (let tick = 1; tick <= 380; tick += 1) simulation.step();
    const run = simulation.run.snapshot();
    expect(run.finaleUnlocked).toBe(true);
    expect(run.boss.active).toBe(true);
    expect(run.boss.lastAbilityTick).toBeGreaterThan(300);
    expect(['FROST_TITAN', 'STORM_COLOSSUS', 'INFERNAL_BEHEMOTH']).toContain(run.boss.type);
  }, 15_000);

  it('defeats the generated boss and produces a Boss Hunt result', () => {
    const simulation = new M06Simulation(generateWorld(1_000_004), {
      mode: 'BOSS_HUNT',
      pace: 'SMOKE',
      difficulty: 'CASUAL',
    });
    for (let tick = 1; tick < 300; tick += 1) simulation.step();
    const boss = simulation.run.snapshot().boss;
    placeAndBuff(simulation, 0, boss.x, boss.z, 10_000);
    const final = simulation.step();
    expect(final.run.outcome).toBe('VICTORY');
    expect(final.run.boss.currentHealth).toBe(0);
    expect(final.run.result?.reason).toBe('BOSS_DEFEATED');
  }, 15_000);

  it('records a versioned replay packet with exact world/run/enemy identity', () => {
    const simulation = new M06Simulation(generateWorld(1_000_005), {
      mode: 'DESTROY',
      pace: 'SMOKE',
      faction: 'FLAME_CULT',
      difficulty: 'CASUAL',
    });
    simulation.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'STOP',
      entityIds: livingIds(simulation, 0),
    });
    for (let tick = 1; tick < 300; tick += 1) simulation.step();
    const enemyCore = simulation.run.snapshot().enemyCore;
    placeAndBuff(simulation, 0, enemyCore.x, enemyCore.z, 5_000);
    simulation.step();
    const packet = simulation.replayPacket();
    expect(packet).not.toBeNull();
    expect(isM06ReplayPacket(packet)).toBe(true);
    expect(packet?.header).toMatchObject({
      version: 'm06-replay-v1',
      blockHeight: 1_000_005,
      mode: 'DESTROY',
      pace: 'SMOKE',
      faction: 'FLAME_CULT',
      difficulty: 'CASUAL',
    });
    expect(packet?.commands).toHaveLength(1);
    expect(packet?.commands[0]?.channel).toBe('GAME');
    expect(packet?.finalStateHash).toBe(simulation.snapshot().stateHash);
  }, 15_000);

  it('replays a checkpoint to MATCH and flags a tampered command stream as DIVERGED', () => {
    const world = generateWorld(1_000_006);
    const options = {
      mode: 'DESTROY' as const,
      pace: 'SMOKE' as const,
      faction: 'IRON_LEGION' as const,
      difficulty: 'CASUAL' as const,
    };
    const source = new M06Simulation(world, options);
    const playerIds = livingIds(source, 0);
    source.enqueueCommand({
      targetTick: 1,
      playerId: 0,
      type: 'MOVE',
      entityIds: playerIds,
      targetX: 12_000,
      targetZ: 12_000,
    });
    for (let tick = 1; tick <= 120; tick += 1) source.step();
    const packet = source.replayCheckpointPacket();
    expect(packet.finalTick).toBe(120);
    expect(packet.outcome).toBe('IN_PROGRESS');

    const replay = new M06Simulation(world, options);
    replay.loadReplay(packet);
    for (let tick = 1; tick <= packet.finalTick; tick += 1) replay.step();
    expect(replay.snapshot().replayVerification).toBe('MATCH');
    expect(replay.snapshot().stateHash).toBe(packet.finalStateHash);

    const tampered = {
      ...packet,
      commands: packet.commands.map((entry, index) => index === 0
        ? {
          channel: 'GAME' as const,
          command: {
            targetTick: 1,
            playerId: 0,
            type: 'STOP' as const,
            entityIds: playerIds,
          },
        }
        : entry),
    };
    const divergentReplay = new M06Simulation(world, options);
    divergentReplay.loadReplay(tampered);
    for (let tick = 1; tick <= tampered.finalTick; tick += 1) divergentReplay.step();
    expect(divergentReplay.snapshot().replayVerification).toBe('DIVERGED');
    expect(divergentReplay.snapshot().stateHash).not.toBe(tampered.finalStateHash);
  }, 15_000);

  it('defers replay commands until their authoritative target tick', () => {
    const world = generateWorld(1_000_008);
    const options = {
      mode: 'DESTROY' as const,
      pace: 'SMOKE' as const,
      difficulty: 'CASUAL' as const,
    };
    const source = new M06Simulation(world, options);
    source.enqueueCommand({
      targetTick: 5,
      playerId: 0,
      type: 'CAST',
      effectId: 'FIRE',
      targetX: 0,
      targetZ: 0,
      radius: 1_000,
    });
    for (let tick = 1; tick <= 5; tick += 1) source.step();
    const packet = source.replayCheckpointPacket();

    const replay = new M06Simulation(world, options);
    replay.loadReplay(packet);
    expect(replay.snapshot().queuedCommandCount).toBe(0);
    for (let tick = 1; tick < 5; tick += 1) replay.step();
    expect(replay.snapshot().replayVerification).toBe('PENDING');
    replay.step();
    expect(replay.snapshot().replayVerification).toBe('MATCH');
    expect(replay.snapshot().stateHash).toBe(packet.finalStateHash);
  });

  it('aligns standard five-act and world-event pacing with the intended run envelope', () => {
    expect(phaseForTick(0, 'STANDARD')).toBe('DISCOVERY');
    expect(phaseForTick(3_000, 'STANDARD')).toBe('COMMITMENT');
    expect(phaseForTick(7_200, 'STANDARD')).toBe('EXPANSION');
    expect(phaseForTick(12_000, 'STANDARD')).toBe('ESCALATION');
    expect(finaleUnlockTick('STANDARD')).toBe(16_200);
    expect(phaseForTick(16_200, 'STANDARD')).toBe('FINALE');

    const simulation = new M06Simulation(generateWorld(1_000_007), {
      pace: 'STANDARD',
      difficulty: 'CASUAL',
    });
    const schedule = simulation.roguelite.snapshot().eventSchedule;
    expect(schedule.map((event) => event.startTick)).toEqual([8_400, 11_400]);
    expect(schedule.every((event) => event.endTick < finaleUnlockTick('STANDARD'))).toBe(true);
  });
});
