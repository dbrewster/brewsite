import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Background, Directional, Environment, Floor, Hud, HudItem, Lighting, Scene } from '@brewsite/core';
import { Fade } from '../../../src/hud/animejs';
import { backgrounds, sceneLighting } from './sceneAssets';

export const scene05Outro: SceneDefinition = {
  id: 'complex-outro',
  index: 4,
  getFrame: () => (
    <Scene id="complex-outro">
      <Background imageUrl={backgrounds.outro} opacity={1} cssSize="cover" cssPosition="center" />
      <Lighting intensityScale={1}>
        <Ambient intensity={sceneLighting.soft.ambient * 0.6} color="#d9e0ff" />
        <Directional intensity={sceneLighting.soft.directional * 0.6} color="#ffffff" position={sceneLighting.soft.direction} />
      </Lighting>
      <Hud>
        <HudItem id="complex-hud">
          <Fade duration={1200}>
            <div className="complex-hud complex-hud--bottom">
              <div className="complex-hud__eyebrow">Outro</div>
              <h2 className="complex-hud__title">Wrap the story with a calm glide-out.</h2>
              <div className="complex-hud__body">
                The HUD returns to the lower frame to close the sequence and reset the viewer’s
                attention for the next chapter.
              </div>
            </div>
          </Fade>
        </HudItem>
      </Hud>
    </Scene>
  ),
};
