export const VANGUARD_IMPOSTOR_FRAME_FILES = [
  'assets/impostors/vanguard/00-front.webp',
  'assets/impostors/vanguard/01-front-left.webp',
  'assets/impostors/vanguard/02-left.webp',
  'assets/impostors/vanguard/03-rear-left.webp',
  'assets/impostors/vanguard/04-rear.webp',
  'assets/impostors/vanguard/05-rear-right.webp',
  'assets/impostors/vanguard/06-right.webp',
  'assets/impostors/vanguard/07-front-right.webp',
] as const;

export function vanguardImpostorFrameUrl(frame: number, baseUrl: string): string {
  const normalized = ((Math.round(frame) % VANGUARD_IMPOSTOR_FRAME_FILES.length) + VANGUARD_IMPOSTOR_FRAME_FILES.length)
    % VANGUARD_IMPOSTOR_FRAME_FILES.length;
  return `${baseUrl}${VANGUARD_IMPOSTOR_FRAME_FILES[normalized]}`;
}
