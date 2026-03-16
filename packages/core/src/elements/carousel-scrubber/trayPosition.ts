// Pure position math for carousel scrubber tray placement in world space.

/**
 * Minimal coordinate conversion interface for position computation.
 * Abstracted from NVSCoordService to allow pure testing without Three.js.
 */
export type TrayCoordService = {
  toWorld(nvsX: number, nvsY: number, nvsZ: number): readonly [number, number, number];
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number];
  visibleWorldHeight: number;
};

/** Result of tray position computation. */
export type TrayPositionResult = {
  /** World Y coordinate for the top edge of the tray. */
  topY: number;
  /** World Y coordinate for the bottom edge of the tray. */
  bottomY: number;
  /** Effective depth — at least trayDepth, may be larger to fill available space. */
  effectiveDepth: number;
  /** World Z coordinate for the tray center. */
  centerZ: number;
};

/**
 * Computes world-space position for the tray top, bottom, and center.
 *
 * Top edge is derived from the view extent bottom with a margin.
 * Bottom edge snaps to the floor (if provided) plus gap, or falls back
 * to topY minus trayDepth. Effective depth is at least trayDepth.
 *
 * @param viewExtent - Tight NVS bounding box of resolved view positions.
 * @param zStep - Z-depth step per carousel position.
 * @param loop - Whether the carousel loops (ring mode).
 * @param trayDepth - Minimum tray depth (thickness in world Y).
 * @param gap - Gap between tray bottom edge and floor top.
 * @param coords - Coordinate conversion service.
 * @param floorY - Floor mesh Y position, or null if no floor exists.
 */
export function computeTrayPosition(
  viewExtent: { x: number; y: number; w: number; h: number },
  zStep: number,
  loop: boolean,
  trayDepth: number,
  gap: number,
  coords: TrayCoordService,
  floorY: number | null,
): TrayPositionResult {
  // Convert the actual view extent bottom edge to world Y.
  const extBottomX = viewExtent.x + viewExtent.w / 2;
  const extBottomY = viewExtent.y + viewExtent.h;
  const [, viewBottomWorldY] = coords.toWorld(extBottomX, extBottomY, 0);

  // Push the tray top DOWN from the view extent bottom to leave room for
  // content that hangs below the NVS bounds (chart axis labels, tick marks).
  const topMargin = coords.visibleWorldHeight * 0.08;
  const topY = viewBottomWorldY - topMargin;

  let bottomY: number;
  if (floorY !== null) {
    bottomY = floorY + gap;
  } else {
    bottomY = topY - trayDepth;
  }

  // The effective depth is the distance between top and bottom, but never
  // less than the compiled trayDepth.
  const spaceAvailable = topY - bottomY;
  const effectiveDepth = Math.max(trayDepth, spaceAvailable);

  // If effectiveDepth exceeds spaceAvailable (no floor or floor too close),
  // push bottomY down to accommodate.
  if (effectiveDepth > spaceAvailable) {
    bottomY = topY - effectiveDepth;
  }

  // Z: ring center is at -zStep/2 for loop carousels, 0 for linear.
  const centerZ = loop && zStep > 0 ? -zStep / 2 : 0;

  return { topY, bottomY, effectiveDepth, centerZ };
}

/**
 * Computes world-space tray width from view extent NVS dimensions.
 * Adds 10% padding (5% each side) for visual breathing room.
 */
export function computeTrayWorldWidth(
  viewExtentW: number,
  viewExtentH: number,
  coords: TrayCoordService,
): number {
  const [wW] = coords.toWorldSize(viewExtentW, viewExtentH);
  const padding = wW * 0.05;
  return wW + padding * 2;
}

/**
 * Computes the Y rotation angle for ring carousel tray tracking.
 * The tray rotates to follow the active item around the ring.
 *
 * @param activeIndex - Current active carousel index.
 * @param childCount - Total number of children in the carousel.
 */
export function computeRingRotation(activeIndex: number, childCount: number): number {
  if (childCount === 0) return 0;
  return -(activeIndex / childCount) * Math.PI * 2;
}
