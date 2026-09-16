/** Atlas images and UVs both start at the top-left. Keep texture.flipY=false:
 * ImageBitmap ignores WebGL UNPACK_FLIP_Y_WEBGL, unlike HTMLImageElement.
 * This convention gives both browser decoding paths identical frame selection.
 */
export function environmentAtlasUv(
  frame: number, columns: number, rows: number,
  horizontal: number, fromTop: number, inset = 0.008,
): readonly [number, number] {
  return [
    (frame % columns + inset + horizontal * (1 - 2 * inset)) / columns,
    (Math.floor(frame / columns) + inset + fromTop * (1 - 2 * inset)) / rows,
  ];
}
