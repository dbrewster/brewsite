import { Scene } from '@brewsite/core/compiler';
import { Camera, Background, Lighting, Ambient, Directional } from '@brewsite/core/elements';

export function IntroScene(): JSX.Element {
  return (
    <Scene id="intro">
      <Camera mode="orbit" distance={5} azimuth={0} polar={"70deg"} fov={"45deg"} />
      <Background color="#0f172a" />
      <Lighting>
        <Ambient intensity={0.4} />
        <Directional intensity={0.8} x={5} y={10} z={5} />
      </Lighting>
    </Scene>
  );
}
