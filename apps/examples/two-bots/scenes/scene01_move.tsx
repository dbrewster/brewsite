import {BodyParts} from '@brewsite/core';
import {Ambient, Directional, Lighting, Scene} from '@brewsite/core';
import {Robot} from '../../generated/sceneDsl.generated';

export const scene01Move= (
    <Scene id="move-left">
      <Lighting intensityScale={1}>
        <Ambient intensity={2.2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[20, 30, 40]} />
      </Lighting>
      <Robot
        id="robot-1"
        position={[-18, 0, 20]}
        rotation={[0, .2, 0]}
        scale={0.1}
        metalness={.9}
        roughness={.2}
      >
        <BodyParts>
          <Robot.Chest color='#ff0000'/>
        </BodyParts>
      </Robot>
      <Robot
        id="robot-2"
        position={[0, 0, -20]}
        rotation={[0, .2, 0]}
        scale={0.1}
        metalness={.9}
        roughness={.1}
      />
    </Scene>
);
