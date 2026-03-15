import { Scene } from '@brewsite/core/compiler';
import { Camera, Background, Lighting, Ambient, Directional } from '@brewsite/core/elements';

export function IntroScene(): JSX.Element {
  return (
    <Scene id="intro">
      <Camera
        x={0.5}
        y={0.5}
        w={1}
        h={1}
        fov={45}
        lookAtX={0}
        lookAtY={1}
        lookAtZ={0}
        distance={5}
        azimuth={0}
        polar={70}
      />
      <Background color="#0f172a" />
      <Lighting>
        <Ambient intensity={0.4} />
        <Directional intensity={0.8} x={5} y={10} z={5} />
      </Lighting>
    </Scene>
  );
}
