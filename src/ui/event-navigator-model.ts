import type { M06SimulationSnapshot } from '../simulation/m06-simulation';
import type { GeneratedWorld } from '../world/world-definition';
import { worldCellToSimulationPosition } from '../world/world-arena';

export type EventNavigatorKind =
  | 'BATTLE'
  | 'GUARD'
  | 'OUTPOST'
  | 'SHRINE'
  | 'CAMP'
  | 'VETERAN'
  | 'OBJECTIVE';

export interface EventNavigatorCandidate {
  key: string;
  kind: EventNavigatorKind;
  label: string;
  detail: string;
  x: number;
  z: number;
  priority: number;
}

const OUTPOST_THREAT_RADIUS = 12_000;
const VETERAN_CRITICAL_RATIO = 0.35;

function distanceSquared(
  left: { x: number; z: number },
  right: { x: number; z: number },
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

function engagedPlayerUnits(snapshot: M06SimulationSnapshot) {
  const byId = new Map(snapshot.entities.map((entity) => [entity.id, entity] as const));
  return snapshot.entities.filter((entity) => {
    if (entity.playerId !== 0 || !entity.alive || entity.attackTargetEntityId === null) return false;
    const target = byId.get(entity.attackTargetEntityId);
    return target?.alive === true && target.playerId !== 0;
  });
}

function centroid(units: readonly { x: number; z: number }[]): { x: number; z: number } | null {
  if (units.length === 0) return null;
  return {
    x: Math.round(units.reduce((sum, unit) => sum + unit.x, 0) / units.length),
    z: Math.round(units.reduce((sum, unit) => sum + unit.z, 0) / units.length),
  };
}

function guardedSquadThreats(snapshot: M06SimulationSnapshot): Map<number, { x: number; z: number }> {
  const entities = new Map(snapshot.entities.map((entity) => [entity.id, entity] as const));
  const threats = new Map<number, { x: number; z: number }>();
  for (const squad of snapshot.squads.squads) {
    if (squad.playerId !== 0 || squad.currentOrder !== 'GUARD') continue;
    const engaged = squad.memberEntityIds
      .map((entityId) => entities.get(entityId))
      .filter((entity): entity is NonNullable<typeof entity> => {
        if (entity === undefined || !entity.alive || entity.attackTargetEntityId === null) return false;
        const target = entities.get(entity.attackTargetEntityId);
        return target?.alive === true && target.playerId !== 0;
      });
    if (engaged.length === 0) continue;
    const center = centroid(engaged) ?? {
      x: squad.targetX ?? engaged[0]!.x,
      z: squad.targetZ ?? engaged[0]!.z,
    };
    threats.set(squad.id, center);
  }
  return threats;
}

function threatenedOutposts(snapshot: M06SimulationSnapshot): Map<number, { x: number; z: number }> {
  const visibleEnemies = snapshot.entities.filter((entity) => (
    entity.playerId === 1 && entity.alive && entity.visibleToPlayer
  ));
  const threatened = new Map<number, { x: number; z: number }>();
  const radiusSquared = OUTPOST_THREAT_RADIUS * OUTPOST_THREAT_RADIUS;
  for (const building of snapshot.strategic.buildings) {
    if (
      building.playerId !== 0
      || building.type !== 'OUTPOST'
      || !building.completed
      || building.destroyed
    ) continue;
    if (visibleEnemies.some((enemy) => distanceSquared(building, enemy) <= radiusSquared)) {
      threatened.set(building.id, { x: building.x, z: building.z });
    }
  }
  return threatened;
}

function criticalVeterans(snapshot: M06SimulationSnapshot): Map<number, {
  x: number;
  z: number;
  archetype: string;
  level: number;
}> {
  const critical = new Map<number, { x: number; z: number; archetype: string; level: number }>();
  for (const entity of snapshot.entities) {
    if (
      entity.playerId !== 0
      || !entity.alive
      || entity.level < 2
      || entity.currentHealth / Math.max(1, entity.maxHealth) > VETERAN_CRITICAL_RATIO
    ) continue;
    critical.set(entity.id, {
      x: entity.x,
      z: entity.z,
      archetype: entity.archetype,
      level: entity.level,
    });
  }
  return critical;
}

function labelArchetype(value: string): string {
  return value.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' ');
}

export function deriveEventNavigatorCandidates(
  previous: M06SimulationSnapshot,
  current: M06SimulationSnapshot,
  world: GeneratedWorld,
): EventNavigatorCandidate[] {
  const events: EventNavigatorCandidate[] = [];

  const previousEngaged = engagedPlayerUnits(previous);
  const currentEngaged = engagedPlayerUnits(current);
  if (previousEngaged.length === 0 && currentEngaged.length > 0) {
    const center = centroid(currentEngaged)!;
    events.push({
      key: 'battle',
      kind: 'BATTLE',
      label: 'Battle started',
      detail: `${currentEngaged.length} unit${currentEngaged.length === 1 ? '' : 's'} engaged`,
      x: center.x,
      z: center.z,
      priority: 60,
    });
  }

  const previousGuard = guardedSquadThreats(previous);
  const currentGuard = guardedSquadThreats(current);
  for (const [squadId, position] of currentGuard) {
    if (previousGuard.has(squadId)) continue;
    events.push({
      key: `guard:${squadId}`,
      kind: 'GUARD',
      label: `Squad ${squadId} under attack`,
      detail: 'Guarded front engaged',
      x: position.x,
      z: position.z,
      priority: 100,
    });
  }

  const previousOutposts = threatenedOutposts(previous);
  const currentOutposts = threatenedOutposts(current);
  for (const [buildingId, position] of currentOutposts) {
    if (previousOutposts.has(buildingId)) continue;
    events.push({
      key: `outpost:${buildingId}`,
      kind: 'OUTPOST',
      label: 'Outpost threatened',
      detail: `Outpost #${buildingId}`,
      x: position.x,
      z: position.z,
      priority: 90,
    });
  }

  const previousOwners = previous.strategic.poiOwners;
  for (const poi of world.pois.filter((candidate) => candidate.type === 'SHRINE')) {
    if (previousOwners[poi.id] === 0 || current.strategic.poiOwners[poi.id] !== 0) continue;
    const position = worldCellToSimulationPosition(world, poi.cell);
    events.push({
      key: `shrine:${poi.id}`,
      kind: 'SHRINE',
      label: 'Shrine secured',
      detail: 'Upgrade choice available',
      x: position.x,
      z: position.z,
      priority: 55,
    });
  }

  const previousCamps = new Map(previous.neutralEncounters.camps.map((camp) => [camp.id, camp] as const));
  for (const camp of current.neutralEncounters.camps) {
    if (!camp.cleared || camp.rewardPlayerId !== 0 || previousCamps.get(camp.id)?.cleared) continue;
    events.push({
      key: `camp:${camp.id}`,
      kind: 'CAMP',
      label: 'Neutral camp cleared',
      detail: `+${camp.rewardXp} XP shared`,
      x: camp.x,
      z: camp.z,
      priority: 50,
    });
  }

  const previousVeterans = criticalVeterans(previous);
  const currentVeterans = criticalVeterans(current);
  for (const [entityId, veteran] of currentVeterans) {
    if (previousVeterans.has(entityId)) continue;
    events.push({
      key: `veteran:${entityId}`,
      kind: 'VETERAN',
      label: 'Veteran critical',
      detail: `Lv${veteran.level} ${labelArchetype(veteran.archetype)} #${entityId}`,
      x: veteran.x,
      z: veteran.z,
      priority: 95,
    });
  }

  if (!previous.run.finaleUnlocked && current.run.finaleUnlocked && current.run.mode !== 'TOWER_DEFENSE') {
    const objective = current.run.mode === 'BOSS_HUNT' ? current.run.boss : current.run.enemyCore;
    events.push({
      key: 'objective:finale',
      kind: 'OBJECTIVE',
      label: current.run.mode === 'BOSS_HUNT' ? 'Boss exposed' : 'Enemy Core exposed',
      detail: current.run.finaleUnlockReason === 'MOMENTUM' ? 'Unlocked by momentum' : 'Finale phase available',
      x: objective.x,
      z: objective.z,
      priority: 85,
    });
  }

  return events.sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key));
}
