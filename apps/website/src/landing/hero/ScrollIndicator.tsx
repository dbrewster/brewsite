import type { JSX } from 'react';
import { useEngineState } from '@brewsite/core';

export function ScrollIndicator(): JSX.Element {
  // sceneProgress is the local [0..1] progress within the current scene.
  // Hide the indicator once the user has scrolled meaningfully past the prompt.
  // autoAdvance max is 0.80, so this stays visible throughout idle auto-play.
  const { sceneProgress } = useEngineState();
  const visible = sceneProgress < 0.85;

  return (
    <div
      className={`scroll-indicator${visible ? '' : ' scroll-indicator--hidden'}`}
      aria-hidden="true"
    >
      <span className="scroll-indicator__label">scroll to explore</span>
      <div className="scroll-indicator__arrows">
        <span className="scroll-indicator__arrow" />
        <span className="scroll-indicator__arrow" />
      </div>
    </div>
  );
}
