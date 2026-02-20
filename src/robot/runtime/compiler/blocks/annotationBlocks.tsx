import type {ReactNode} from 'react';
import {Annotation} from '../primitives';
import {hexToRgb} from "../sceneUtils";

export const MessageAnnotation = ({
  content,
  id,
  color = "#aeddff",
  placement = 'top',
}: {
  content: ReactNode;
  id: string;
  color?: string;
  placement?: 'top' | 'bottom';
}) => {
  const opacity = 1
  const anchor =
    placement === 'bottom'
      ? {
          reference: {x: 'left', y: 'bottom'} as const,
          offset: {xPct: 0, yPct: 0},
        }
      : {
          reference: {x: 'center', y: 'top'} as const,
          offset: {xPct: 0, yPct: 0.03},
        };
  return (
    <Annotation
      id={id}
      label="Hero overlay"
      mode="screen"
      labelAnchor={anchor}
      content={{
        node: (
          content
/*
          <div className='glass'>
            <div className="glass__noise"></div>
            <div className="glass__content">
              {content}
            </div>
          </div>
*/
        )
      }}
      style={{
        anchorX: placement === 'bottom' ? 'left' : 'center',
        anchorY: placement === 'bottom' ? 'bottom' : 'top',
        backgroundOpacity: 0,
        backgroundColor: 'rgba(0,0,0,0)',
        css: {
          fontFamily: 'General Sans',
          '--agent-color': hexToRgb(color),
          opacity,
        },
        lineOpacity: 0,
        lineThickness: 0,
      }}
    />
  );
};

export const LogoAnnotation = () => (
  <Annotation
    id="hero-logo"
    label="Hero logo"
    mode="screen"
    contentId="hero-logo"
    labelAnchor={{
      reference: {x: 'left', y: 'top'},
      offset: {xPct: 0.03, yPct: 0.02},
    }}
    style={{
      css: {opacity: 1},
      lineOpacity: 0,
      lineThickness: 0,
    }}
  />
);

export interface BrainLabelAnnotationProps {
  parts?: 'all' | Array<'interface' | 'action' | 'memory' | 'executive' | 'bus'>
  side?: 'left' | 'right'
}

export const BrainLabelAnnotations = ({parts = 'all', side='left'}: BrainLabelAnnotationProps) => {
  const opacity = 1;
  let activeParts = new Set<string>();
  if (!parts || parts === 'all') {
    activeParts = new Set(['interface', 'action', 'memory', 'executive', 'bus']);
  } else {
    activeParts = new Set(parts);
  }
  return (
    <>
      <Annotation
        id="brain-anno-green"
        label="Interface"
        mode="world"
        enabled={activeParts.has('interface')}
        targetPartId={"marker_bottom_" + side}
        labelOffset={[-11.5, -2, 10.5]}
        style={{
          lineOpacity: 0.65 * opacity,
          labelOpacity: 0.85 * opacity,
          lineThickness: 0.1,
        }}
      />
      <Annotation
        id="brain-anno-yellow"
        label="Action"
        mode="world"
        enabled={activeParts.has('action')}
        targetPartId={"marker_top_" + side}
        labelOffset={[4, .3, 12]}
        style={{
          lineOpacity: 0.65 * opacity,
          labelOpacity: 0.85 * opacity,
          lineThickness: 0.1,
        }}
      />
      <Annotation
        id="brain-anno-red"
        label="Memory"
        mode="world"
        enabled={activeParts.has('memory')}
        targetPartId={"marker_back_" + side}
        labelOffset={[3.0, -2.2, 10.0]}
        style={{
          lineOpacity: 0.65 * opacity,
          labelOpacity: 0.85 * opacity,
          lineThickness: 0.1,
        }}
      />
      <Annotation
        id="brain-anno-teal"
        label="Executive Control"
        mode="world"
        enabled={activeParts.has('executive')}
        targetPartId={"marker_front_" + side}
        labelOffset={[-5, 0, 16]}
        style={{
          lineOpacity: 0.65 * opacity,
          labelOpacity: 0.85 * opacity,
          lineThickness: 0.1,
        }}
      />
      <Annotation
        id="brain-anno-brown"
        label="Message Bus"
        mode="world"
        enabled={activeParts.has('bus')}
        targetPartId={"marker_spine"}
        labelOffset={[-10, -4.4, 12]}
        style={{
          lineOpacity: 0.65 * opacity,
          labelOpacity: 0.85 * opacity,
          lineThickness: 0.1,
        }}
      />
    </>
  );
};
