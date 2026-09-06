import { BiomeType, TerrainType, type GeneratedWorld, type GridPoint } from './world-definition';

function pointCenter(point: GridPoint, scaleX: number, scaleY: number): [number, number] {
  return [(point.x + 0.5) * scaleX, (point.z + 0.5) * scaleY];
}

function drawMarker(context: CanvasRenderingContext2D, point: GridPoint, scaleX: number, scaleY: number, radius: number, fill: string): void {
  const [x, y] = pointCenter(point, scaleX, scaleY);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = '#07100f';
  context.lineWidth = 1;
  context.stroke();
}

export function renderWorldDebug(canvas: HTMLCanvasElement, world: GeneratedWorld): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Generated-world debug canvas 2D context is unavailable.');
  const scaleX = canvas.width / world.width;
  const scaleY = canvas.height / world.height;
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const index = z * world.width + x;
      const terrain = world.terrain[index] ?? TerrainType.GROUND;
      const biome = world.biome[index] ?? BiomeType.PLAINS;
      context.fillStyle = terrain === TerrainType.WATER
        ? '#185784'
        : terrain === TerrainType.CROSSING
          ? '#66bfd0'
          : biome === BiomeType.WOODLAND
            ? '#285f37'
            : biome === BiomeType.HIGHLANDS
              ? '#77776c'
              : '#597a52';
      context.fillRect(x * scaleX, z * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
    }
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

  context.font = '9px ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const region of world.regions) {
    drawMarker(context, region.center, scaleX, scaleY, 4, '#f4de7a');
    const [x, y] = pointCenter(region.center, scaleX, scaleY);
    context.fillStyle = '#07100f';
    context.fillText(String(region.id + 1), x, y + 0.5);
  }
  for (const resource of world.resources) drawMarker(context, resource.cell, scaleX, scaleY, 2.2, resource.type === 'MATERIAL' ? '#dfb66d' : '#9c79e3');
  for (const poi of world.pois) drawMarker(context, poi.cell, scaleX, scaleY, 1.8, '#f2f2df');
  const player = world.spawns.find((spawn) => spawn.id === 'PLAYER');
  const enemy = world.spawns.find((spawn) => spawn.id === 'ENEMY');
  if (player) drawMarker(context, player.cell, scaleX, scaleY, 4.5, '#58e1c1');
  if (enemy) drawMarker(context, enemy.cell, scaleX, scaleY, 4.5, '#f07062');
  drawMarker(context, world.objective.cell, scaleX, scaleY, 4.2, '#fff2a0');
  drawMarker(context, world.boss.cell, scaleX, scaleY, 5, '#e458d2');
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
