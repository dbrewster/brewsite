import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  ProgressManager,
  Scene,
  View,
} from '@brewsite/core';
import {
  Diagram,
  DiagramEdge,
  DiagramNode,
  FlowLayout,
} from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 900 : 1200;

/**
 * Act 3b: The Pipeline.
 *
 * Warm amber → transitioning toward green/violet aurora.
 * The compiler pipeline visualized as a flowing chain.
 * One line of text: "Write state. Compile to film."
 */
export const Scene03bPipeline = (): JSX.Element => (
  <Scene id="website-pipeline">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [0, 6, 22] : [0, 5, 18]}
      target={[0, 0, 0]}
      fov={isMobile ? "52deg" : "46deg"}
    />
    {/* Amber + violet — transitioning toward the aurora */}
    <Lighting intensityScale={1.0}>
      <Ambient intensity={0.3} color="#120a1a" />
      <Directional intensity={0.5} color="#FFB84D" position={[-5, 12, 8]} />
      <Directional intensity={0.4} color="#7B61FF" position={[6, 8, 10]} />
      <Directional intensity={0.2} color="#00D4AA" position={[0, 6, -6]} />
    </Lighting>
    <Background color="#0D0A14" opacity={1} />

    <View id="pipeline-stage" x={"5%"} y={"10%"} w={"90%"} h={"65%"}>
      <Diagram
        id="pipeline-diagram"
        x={0} y={0} w={"100%"} h={"100%"}
        tilt={"-0.2617993878rad"}
        scale={isMobile ? 0.7 : 0.9}
      >
        <FlowLayout direction={isMobile ? 'top-down' : 'left-right'} gap={"8%"} />
        <DiagramNode id="pipe-dsl" label="JSX" sublabel="Declare"
          icon="ui:code-bracket"
          position={isMobile ? ["50%", "12%", 0] : ["10%", "40%", 0]}
          size={isMobile ? ["0.2u", "0.09u"] : ["0.13u", "0.12u"]}
          glow={{ intensity: 0.2 }} />
        <DiagramNode id="pipe-frames" label="Frames" sublabel="Snapshot"
          icon="ui:squares-2x2"
          position={isMobile ? ["50%", "32%", 0] : ["30%", "40%", 0]}
          size={isMobile ? ["0.2u", "0.09u"] : ["0.13u", "0.12u"]} />
        <DiagramNode id="pipe-track" label="Track" sublabel="Pre-bake"
          icon="ui:circle-stack"
          position={isMobile ? ["50%", "52%", 0] : ["50%", "40%", 0]}
          size={isMobile ? ["0.2u", "0.09u"] : ["0.13u", "0.12u"]}
          glow={{ intensity: 0.3 }} />
        <DiagramNode id="pipe-runtime" label="Runtime" sublabel="O(1)"
          icon="ui:cpu-chip"
          position={isMobile ? ["50%", "72%", 0] : ["70%", "40%", 0]}
          size={isMobile ? ["0.2u", "0.09u"] : ["0.13u", "0.12u"]} />
        <DiagramNode id="pipe-canvas" label="60fps" sublabel="Render"
          icon="ui:photo"
          position={isMobile ? ["50%", "92%", 0] : ["90%", "40%", 0]}
          size={isMobile ? ["0.2u", "0.09u"] : ["0.13u", "0.12u"]}
          glow={{ intensity: 0.2 }} />
        <DiagramEdge from="pipe-dsl" to="pipe-frames" flow="forward" />
        <DiagramEdge from="pipe-frames" to="pipe-track" flow="forward" />
        <DiagramEdge from="pipe-track" to="pipe-runtime" flow="forward" />
        <DiagramEdge from="pipe-runtime" to="pipe-canvas" flow="forward" />
      </Diagram>
    </View>

    <div key="pipeline-overlay" className="scene-overlay scene-overlay--bottom">
      <div className="scene-overlay__content">
        <h2 className="scene-punchline scene-punchline--warm">Write state. Compile to film.</h2>
      </div>
    </div>
  </Scene>
);
