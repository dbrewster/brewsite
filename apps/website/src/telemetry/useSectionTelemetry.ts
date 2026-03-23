// Hook that emits section_view when the current scene changes.

import { useEffect, useRef } from 'react';
import { useCurrentScene } from '@brewsite/core';
import { getSectionBySceneId } from '../content/siteMap';
import { emit } from './emit';

/**
 * Emits a `section_view` telemetry event each time the active scene changes.
 * Must be rendered inside a SceneEngine context.
 */
export function useSectionTelemetry(): void {
  const { id: sceneId } = useCurrentScene();
  const prevSceneId = useRef<string | null>(null);

  useEffect(() => {
    if (sceneId === prevSceneId.current) return;
    prevSceneId.current = sceneId;

    const section = getSectionBySceneId(sceneId);
    if (!section) return;

    emit('section_view', {
      sectionId: section.id,
      sceneId: section.sceneId,
    });
  }, [sceneId]);
}
