// AR-locked container with scale mode handling and --scene-scale CSS variable injection.

import {
  createContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

/**
 * The four scale modes that govern how the fixed-AR container fits inside the
 * available parent space.
 */
export type ScaleMode = 'fit-width' | 'fit-height' | 'contain' | 'cover';

/**
 * Props for the EngineARContainer component.
 */
export type EngineARContainerProps = {
  /**
   * Fixed aspect ratio for the engine container.
   * All 3D content and NVS-positioned elements are authored for this AR.
   * Default: 16/9
   */
  aspectRatio?: number;

  /**
   * The pixel width at which --scene-scale = 1.0.
   * TextBox content authored in reference-resolution pixels scales proportionally
   * from this baseline. Default: 1920
   */
  referenceWidth?: number;

  /**
   * How the fixed-AR container fits inside the available parent space.
   *
   * 'fit-width'  — Width fills the parent; height is derived from AR. Default.
   * 'fit-height' — Height fills the parent; width is derived from AR.
   * 'contain'    — Both dimensions fit; the shorter axis letterboxes.
   * 'cover'      — Both dimensions fill; content that exceeds bounds is clipped.
   *
   * Default: 'fit-width'
   */
  scaleMode?: ScaleMode;

  /** className applied to the AR-locked container div. */
  className?: string;

  /**
   * style applied to the outer wrapper div (not the AR container).
   * Use to set the background color of letterbox areas, for example.
   */
  style?: CSSProperties;

  /** All children — SceneCanvas, EngineOverlayHost, EngineInputRegion, etc. */
  children: ReactNode;
};

/**
 * Viewport scaling context. Provided by EngineARContainer.
 *
 * Consumed by @brewsite/model's LabelPositioner to compute correct label
 * screen positions regardless of the enclosing layout component.
 *
 * Replaces EngineARContainerContext as the label-positioning contract so that
 * custom layouts (not just EngineARContainer) can provide it.
 */
export type ViewportScaleContextValue = {
  containerWidth: number;
  containerHeight: number;
  /**
   * The AR-calculated content height derived from computeContainerDims.
   * This is the correct sticky-region height for EngineInputRegion — it is
   * computed from the outer div's width (which is viewport-bounded), NOT
   * from the outer div's full observed height (which can be 5000px when the
   * scroll spacer is present). Zero until the outer div has a valid width.
   */
  computedArHeight: number;
  referenceWidth: number;
  scaleMode: ScaleMode;
};

/** @deprecated Use ViewportScaleContextValue. Alias will be removed in v3. */
export type EngineARContainerContextValue = ViewportScaleContextValue;

/**
 * Context exported so children can read container dimensions if needed.
 */
export const ViewportScaleContext = createContext<ViewportScaleContextValue>({
  containerWidth: 0,
  containerHeight: 0,
  computedArHeight: 0,
  referenceWidth: 1920,
  scaleMode: 'fit-width',
});

/** @deprecated Use ViewportScaleContext. Alias will be removed in v3. */
export const EngineARContainerContext = ViewportScaleContext;

/**
 * Computes the --scene-scale value and container pixel dimensions
 * for the given outer dimensions, AR, scale mode, and reference width.
 * Pure function — no DOM reads.
 */
export function computeContainerDims(
  outerWidth: number,
  outerHeight: number,
  aspectRatio: number,
  scaleMode: ScaleMode,
  referenceWidth: number,
): { containerW: number; containerH: number; sceneScale: number } {
  if (outerWidth <= 0 || outerHeight <= 0) {
    return { containerW: 0, containerH: 0, sceneScale: 0 };
  }
  let containerW: number;
  let containerH: number;

  switch (scaleMode) {
    case 'fit-width':
      containerW = outerWidth;
      containerH = outerWidth / aspectRatio;
      break;
    case 'fit-height':
      containerH = outerHeight;
      containerW = outerHeight * aspectRatio;
      break;
    case 'contain': {
      const byWidth = outerWidth / aspectRatio;
      if (byWidth <= outerHeight) {
        containerW = outerWidth;
        containerH = byWidth;
      } else {
        containerH = outerHeight;
        containerW = outerHeight * aspectRatio;
      }
      break;
    }
    case 'cover': {
      const byWidth = outerWidth / aspectRatio;
      if (byWidth >= outerHeight) {
        containerW = outerWidth;
        containerH = byWidth;
      } else {
        containerH = outerHeight;
        containerW = outerHeight * aspectRatio;
      }
      break;
    }
    default: {
      containerW = outerWidth;
      containerH = outerWidth / aspectRatio;
    }
  }

  const sceneScale = containerW / referenceWidth;
  return { containerW, containerH, sceneScale };
}

/**
 * Returns the CSS style for the inner AR-locked div based on scale mode.
 */
function computeContainerStyle(
  outerWidth: number,
  outerHeight: number,
  aspectRatio: number,
  scaleMode: ScaleMode,
): CSSProperties {
  const { containerW, containerH } = computeContainerDims(
    outerWidth,
    outerHeight,
    aspectRatio,
    scaleMode,
    1920, // referenceWidth irrelevant for style
  );

  const baseStyle: CSSProperties = {
    position: 'relative',
    overflow: scaleMode === 'cover' ? 'hidden' : 'visible',
    width: containerW > 0 ? `${containerW}px` : '100%',
    height: containerH > 0 ? `${containerH}px` : 'auto',
  };

  // fit-height: MUST stay position:relative (in-flow) so the EngineInputRegion scroll
  // spacer's height propagates through the CSS scrollable overflow rectangle to the page.
  // position:absolute causes the scroll spacer to be treated as content overflow of an
  // out-of-flow element — CSS only includes the absolute element's border box in the
  // page scroll area, not its children's overflow. With containerH = outerH, maxScroll
  // collapses to 0 and the page becomes unscrollable.
  if (scaleMode === 'fit-height') {
    return {
      ...baseStyle,
      // position stays 'relative' (inherited from baseStyle) — in-flow is required.
      left: '50%',
      transform: 'translateX(-50%)',
    };
  }

  if (scaleMode === 'contain') {
    return {
      ...baseStyle,
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return baseStyle;
}

/**
 * AR-locked container that maintains a fixed aspect ratio, injects the
 * `--scene-scale` CSS custom property on every resize, and provides
 * container dimensions to children via EngineARContainerContext.
 *
 * The outer div fills its parent (width: 100%; height: 100%; position: relative).
 * The inner div is sized according to the scaleMode and centered as needed.
 */
export const EngineARContainer = ({
  aspectRatio = 16 / 9,
  referenceWidth = 1920,
  scaleMode = 'fit-width',
  className,
  style,
  children,
}: EngineARContainerProps): ReactElement => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ outerW: 0, outerH: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDims({ outerW: width, outerH: height });
      // Compute and inject --scene-scale immediately on every resize.
      const scale = computeContainerDims(width, height, aspectRatio, scaleMode, referenceWidth);
      el.style.setProperty('--scene-scale', String(scale.sceneScale));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio, scaleMode, referenceWidth]);

  const containerStyle = computeContainerStyle(
    dims.outerW,
    dims.outerH,
    aspectRatio,
    scaleMode,
  );

  // computedArHeight is derived from the outer width (viewport-bounded), not
  // the outer height (which inflates to 5000px when the scroll spacer is present).
  const { containerH: arH } = computeContainerDims(dims.outerW, dims.outerH, aspectRatio, scaleMode, referenceWidth);
  const computedArHeight = arH > 0 ? arH : 0;

  const contextValue: ViewportScaleContextValue = {
    containerWidth: dims.outerW,
    containerHeight: dims.outerH,
    computedArHeight,
    referenceWidth,
    scaleMode,
  };

  return (
    <div ref={outerRef} style={{ position: 'relative', height: '100%', width: '100%', ...(scaleMode === 'fit-height' ? { overflowX: 'clip' } : {}), ...style }}>
      <ViewportScaleContext.Provider value={contextValue}>
        <div className={className} style={containerStyle}>
          {children}
        </div>
      </ViewportScaleContext.Provider>
    </div>
  );
};
