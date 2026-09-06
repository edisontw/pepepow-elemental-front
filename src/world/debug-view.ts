import { WORLD_UNITS_PER_METER } from '../simulation/arena';
import { SurfaceType } from '../simulation/terrain-state';
import { BiomeType, TerrainType, type GeneratedWorld, type GridPoint } from './world-definition';

export interface TerritoryDebugState {
  regionOwners: readonly number[];
  contestedRegions: readonly number[];
  suppliedRegions?: Readonly<Record<number, readonly number[]>>;
}

export interface MinimapEntityState {
  x: number;
  z: number;
  playerId: number;
  alive: boolean;
  visibleToPlayer: boolean;
}

export interface MinimapObjectiveState {
  x: number;
  z: number;
}

export interface MinimapBossState extends MinimapObjectiveState {
  active: boolean;
}

export interface MinimapLiveState {
  entities: readonly MinimapEntityState[];
  playerCore?: MinimapObjectiveState;
  enemyCore?: MinimapObjectiveState;
  boss?: MinimapBossState;
  surface?: Uint8Array;
  burningCells?: readonly { column: number; row: number }[];
}

function pointCenter(point: GridPoint, scaleX: number, scaleY: number): [number, number] {
  return [(point.x + 0.5) * scaleX, (point.z + 0.5) * scaleY];
}

export function simulationPositionToMinimapFraction(
  world: GeneratedWorld,
  x: number,
  z: number,
): [number, number] {
  const originX = -Math.floor((world.width * WORLD_UNITS_PER_METER) / 2);
  const originZ = -Math.floor((world.height * WORLD_UNITS_PER_METER) / 2);
  const spanX = world.width * WORLD_UNITS_PER_METER;
  const spanZ = world.height * WORLD_UNITS_PER_METER;
  return [
    Math.max(0, Math.min(1, (x - originX) / spanX)),
    Math.max(0, Math.min(1, (z - originZ) / spanZ)),
  ];
}

function drawMarker(
  context: CanvasRenderingContext2D,
  point: GridPoint,
  scaleX: number,
  scaleY: number,
  radius: number,
  fill: string,
): void {
  const [x, y] = pointCenter(point, scaleX, scaleY);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = '#07100f';
  context.lineWidth = 1;
  context.stroke();
}

function drawSimulationMarker(
  context: CanvasRenderingContext2D,
  world: GeneratedWorld,
  x: number,
  z: number,
  radius: number,
  fill: string,
): void {
  const [fractionX, fractionY] = simulationPositionToMinimapFraction(world, x, z);
  const canvasX = fractionX * context.canvas.width;
  const canvasY = fractionY * context.canvas.height;
  context.beginPath();
  context.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = 'rgba(4, 13, 12, .82)';
  context.lineWidth = 0.8;
  context.stroke();
}

function drawSimulationSquare(
  context: CanvasRenderingContext2D,
  world: GeneratedWorld,
  point: MinimapObjectiveState,
  size: number,
  fill: string,
): void {
  const [fractionX, fractionY] = simulationPositionToMinimapFraction(world, point.x, point.z);
  const x = fractionX * context.canvas.width;
  const y = fractionY * context.canvas.height;
  context.fillStyle = fill;
  context.fillRect(x - size / 2, y - size / 2, size, size);
  context.strokeStyle = '#07100f';
  context.lineWidth = 1.2;
  context.strokeRect(x - size / 2, y - size / 2, size, size);
}

export function renderWorldDebug(
  canvas: HTMLCanvasElement,
  world: GeneratedWorld,
  territory?: TerritoryDebugState,
  live?: MinimapLiveState,
): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Generated-world minimap canvas 2D context is unavailable.');
  const scaleX = canvas.width / world.width;
  const scaleY = canvas.height / world.height;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const contested = new Set(territory?.contestedRegions ?? []);

  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = z * world.width + x;
      const terrain = world.terrain[index] ?? TerrainType.GROUND;
      const biome = world.biome[index] ?? BiomeType.PLAINS;
      const liveSurface = live?.surface?.[index];
      context.fillStyle = liveSurface === SurfaceType.ICE
        ? '#9ddce8'
        : terrain === TerrainType.WATER
          ? '#185784'
          : terrain === TerrainType.CROSSING
            ? '#c0985b'
            : biome === BiomeType.WOODLAND
              ? '#285f37'
              : biome === BiomeType.HIGHLANDS
                ? '#77776c'
                : '#597a52';
      context.fillRect(x * scaleX, z * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));

      if (territory) {
        const regionId = world.regionByCell[index];
        const owner = regionId === undefined ? -1 : territory.regionOwners[regionId] ?? -1;
        if (regionId !== undefined && contested.has(regionId)) context.fillStyle = 'rgba(255, 209, 82, .28)';
        else if (owner === 0) context.fillStyle = 'rgba(63, 231, 190, .22)';
        else if (owner === 1) context.fillStyle = 'rgba(244, 91, 79, .20)';
        else continue;
        context.fillRect(x * scaleX, z * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }
  }

  for (const cell of live?.burningCells ?? []) {
    context.fillStyle = 'rgba(255, 93, 24, .78)';
    context.fillRect(cell.column * scaleX, cell.row * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
  }

  context.lineWidth = 1.5;
  context.strokeStyle = 'rgba(245, 210, 112, .88)';
  for (const route of world.routes) {
    const first = route.path[0];
    if (!first) continue;
    const [startX, startY] = pointCenter(first, scaleX, scaleY);
    context.beginPath();
    context.moveTo(startX, startY);
    for (let index = 1; index < route.path.length; index += 1) {
      const point = route.path[index];
      if (!point) continue;
      const [x, y] = pointCenter(point, scaleX, scaleY);
      context.lineTo(x, y);
    }
    context.stroke();
  }

  const supplied = new Set(territory?.suppliedRegions?.[0] ?? []);
  context.font = '9px ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const region of world.regions) {
    drawMarker(context, region.center, scaleX, scaleY, 4, '#f4de7a');
    const [x, y] = pointCenter(region.center, scaleX, scaleY);
    if (supplied.has(region.id)) {
      context.beginPath();
      context.arc(x, y, 6.2, 0, Math.PI * 2);
      context.strokeStyle = '#65d9bd';
      context.lineWidth = 1.2;
      context.stroke();
    }
    context.fillStyle = '#07100f';
    context.fillText(String(region.id + 1), x, y + 0.5);
  }

  for (const resource of world.resources) {
    drawMarker(context, resource.cell, scaleX, scaleY, 2.2, resource.type === 'MATERIAL' ? '#dfb66d' : '#9c79e3');
  }
  for (const poi of world.pois) drawMarker(context, poi.cell, scaleX, scaleY, 1.8, '#f2f2df');
  drawMarker(context, world.objective.cell, scaleX, scaleY, 4.2, '#fff2a0');
  drawMarker(context, world.boss.cell, scaleX, scaleY, 5, '#e458d2');

  if (live) {
    for (const entity of live.entities) {
      if (!entity.alive) continue;
      if (entity.playerId !== 0 && !entity.visibleToPlayer) continue;
      drawSimulationMarker(
        context,
        world,
        entity.x,
        entity.z,
        entity.playerId === 0 ? 1.9 : 1.8,
        entity.playerId === 0 ? '#58e1c1' : '#f07062',
      );
    }
    if (live.playerCore) drawSimulationSquare(context, world, live.playerCore, 7, '#58e1c1');
    if (live.enemyCore) drawSimulationSquare(context, world, live.enemyCore, 7, '#f07062');
    if (live.boss?.active) drawSimulationMarker(context, world, live.boss.x, live.boss.z, 6, '#ff6bea');
  } else {
    const player = world.spawns.find((spawn) => spawn.id === 'PLAYER');
    const enemy = world.spawns.find((spawn) => spawn.id === 'ENEMY');
    if (player) drawMarker(context, player.cell, scaleX, scaleY, 4.5, '#58e1c1');
    if (enemy) drawMarker(context, enemy.cell, scaleX, scaleY, 4.5, '#f07062');
  }

  context.strokeStyle = 'rgba(220, 238, 232, .38)';
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  context.font = '700 10px ui-monospace, monospace';
  context.textAlign = 'right';
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(220, 238, 232, .82)';
  context.fillText('N', canvas.width - 5, 4);
}

export function worldDebugSummary(world: GeneratedWorld): string {
  return [
    `Block ${world.identity.blockHeight}`,
    `Rules ${world.identity.rulesetVersion}`,
    `Attempt ${world.generationAttempt}`,
    `Quality ${world.quality.score}/100`,
    `Regions ${world.regions.length} / Routes ${world.routes.length}`,
    `Resources ${world.resources.length} / POIs ${world.pois.length}`,
    `World hash ${world.gameplayHash}`,
  ].join('\n');
}
