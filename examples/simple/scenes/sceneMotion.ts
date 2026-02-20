import type {RobotMotionCommand} from '../../../robot/model/robotMotionTypes';
import type {AnnotationDefinition} from "../../../robot/annotations/annotationTypes";
import type {ReactNode} from 'react';

export const BASE_MOTION_COMMANDS: RobotMotionCommand[] = [
  {groupId: 'robot', rotate: {yawPct: -10 / 30}},
  {groupId: 'left_forearm', rotate: {yawPct: 15 / 35}},
  {groupId: 'right_forearm', rotate: {yawPct: -15 / 35}},
  {groupId: 'left_fingers', rotate: {pitchPct: 0.2}},
  {groupId: 'right_fingers', rotate: {pitchPct: 0.2}},
  {groupId: 'left_thumb', rotate: {pitchPct: 0.15, yawPct: 3}},
  {groupId: 'right_thumb', rotate: {pitchPct: 0.15, yawPct: -3}},
];

export const message = (content: ReactNode, sceneProgress: number, displayRange: [number, number] = [0, 1]) => {
  const opacity = 1- Math.max(0, Math.min(1, (sceneProgress - displayRange[0]) / (displayRange[1] - displayRange[0])));
  return {
    id: 'hero-overlay',
    label: 'Hero overlay',
    content: { node: content },
    labelAnchor: {
      reference: {x: 'left', y: 'top'},
      offset: {xPct: 0.07, yPct: 0.3},
    },
    style: {
      anchorX: 'left',
      css: {
        fontFamily: 'General Sans',
        opacity,
      },
      lineOpacity: 0,
      lineThickness: 0,
    }
  } as AnnotationDefinition
}

export const logo = () => {
  return {
    id: 'hero-logo',
    label: 'Hero logo',
    mode: 'screen',
    contentId: 'hero-logo',
    labelAnchor: {
      reference: {x: 'left', y: 'top'},
      offset: {xPct: 0.03, yPct: 0.02},
    },
    style: {
      css: {opacity: 1},
      lineOpacity: 0,
      lineThickness: 0,
    }
  } as AnnotationDefinition
}

export const brainLabels = (style: 'intro' | 'exit', sceneProgressIn: number) => {
  let sceneProgress;
  if (style === 'intro') {
    sceneProgress = Math.max(0, (sceneProgressIn - 0.2) / 1.2);
  } else {
    sceneProgress = Math.min(1 - (sceneProgressIn - 0.2) * 1.2);
  }
  return [
    {
      id: 'brain-anno-green',
      label: 'Interface',
      mode: 'world',
      target: {targetPartId: 'marker_bottom_left'},
      labelAnchor: {labelOffset: [-14.5, -8, 15.5]},
      style: {
        lineOpacity: 0.65 * sceneProgress,
        labelOpacity: 0.85 * sceneProgress,
        lineThickness: 0.1
      },
    },
    {
      id: 'brain-anno-yellow',
      label: 'Action',
      mode: 'world',
      target: {targetPartId: 'marker_top_left'},
      labelAnchor: {labelOffset: [1, 2.3, 12]},
      style: {
        lineOpacity: 0.65 * sceneProgress,
        labelOpacity: 0.85 * sceneProgress,
        lineThickness: 0.1
      },
    },
    {
      id: 'brain-anno-red',
      label: 'Memory',
      mode: 'world',
      target: {targetPartId: 'marker_back_left'},
      labelAnchor: {labelOffset: [7.0, -5.2, 10.0]},
      style: {
        lineOpacity: 0.65 * sceneProgress,
        labelOpacity: 0.85 * sceneProgress,
        lineThickness: 0.1
      },
    },
    {
      id: 'brain-anno-teal',
      label: 'Executive Control',
      mode: 'world',
      target: {targetPartId: 'marker_front_left'},
      labelAnchor: {labelOffset: [-5, 1.4, 16]},
      style: {
        lineOpacity: 0.65 * sceneProgress,
        labelOpacity: 0.85 * sceneProgress,
        lineThickness: 0.1
      },
    },
    {
      id: 'brain-anno-brown',
      label: 'Message Bus',
      mode: 'world',
      target: {targetPartId: 'marker_spine'},
      labelAnchor: {labelOffset: [-15, -10.4, 12]},
      style: {
        lineOpacity: 0.65 * sceneProgress,
        labelOpacity: 0.85 * sceneProgress,
        lineThickness: 0.1
      },
    },
  ] as AnnotationDefinition[]
}
