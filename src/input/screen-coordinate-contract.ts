export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * PlayCanvas CameraComponent worldToScreen/screenToWorld use the graphics
 * device client rect (CSS/display pixels), not the high-DPI backbuffer size.
 */
export function clientToPlayCanvasScreen(
  clientX: number,
  clientY: number,
  bounds: ScreenRect,
): { x: number; y: number } {
  return {
    x: clientX - bounds.left,
    y: clientY - bounds.top,
  };
}
