import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Floor,
  FloorMirror,
  Lighting,
  ProgressManager,
  Scene,
  View,
} from '@brewsite/core';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  FlowLayout,
} from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 1200 : 1600;
const MIRROR_RES = isMobile ? 512 : 1024;

/**
 * Act 2a: The Dimensional Shift.
 *
 * THE emotional peak. Same nodes from Scene 1, now exploded into Z-space
 * with violet/pink lighting, floor mirror, dramatic camera.
 * The color temperature shifts from grey to violet — the world comes alive.
 *
 * Text appears only AFTER the transformation lands: "Same data. New dimension."
 */
export const Scene02aDimensionalShift = (): JSX.Element => (
  <Scene id="website-dimensional-shift">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [5, 9, 20] : [4, 8, 16]}
      target={[0, 1.5, 0]}
      fov={isMobile ? "54deg" : "48deg"}
    />
    {/* Violet + pink lighting — the world warms up */}
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.25} color="#1a0a30" />
      <Directional intensity={0.7} color="#7B61FF" position={[-8, 14, 10]} />
      <Directional intensity={0.5} color="#FF61AB" position={[10, 6, 12]} />
      <Directional intensity={0.2} color="#00d8ff" position={[0, 10, -5]} />
    </Lighting>
    <Background color="#0F0E17" opacity={1} />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0F0E17"
        mirrorOpacity={0.15}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>

    <View id="dim-stage" x={"3%"} y={"3%"} w={"94%"} h={"88%"}>
      <Diagram
        id="dim-arch-diagram"
        x={0} y={0} w={"100%"} h={"100%"}
        tilt={"-0.3490658504rad"}
        scale={isMobile ? 0.8 : 1.0}
      >
        <FlowLayout direction="left-right" gap={"10%"} />

        {/* Frontend — closest to viewer */}
        <DiagramGroup id="dim-front" variant="boundary" label="Frontend">
          <DiagramNode id="dim-web" label="Frontend" icon="ui:globe-alt"
            position={["15%", "40%", "300%"]} size={["0.15u", "0.13u"]}
            glow={{ intensity: 0.3 }} />
        </DiagramGroup>

        {/* Services — middle depth */}
        <DiagramGroup id="dim-svc" variant="swimlane" label="Services">
          <DiagramNode id="dim-api" label="API" icon="ui:server"
            position={["42%", "28%", 0]} size={["0.15u", "0.13u"]}
            glow={{ intensity: 0.35 }} />
          <DiagramNode id="dim-auth" label="Auth" icon="ui:lock-closed"
            position={["42%", "68%", 0]} size={["0.15u", "0.13u"]}
            glow={{ intensity: 0.15 }} />
        </DiagramGroup>

        {/* Data — farthest from viewer */}
        <DiagramGroup id="dim-data" variant="cluster" label="Data">
          <DiagramNode id="dim-cache" label="Cache" icon="ui:bolt"
            position={["72%", "25%", "-300%"]} size={["0.15u", "0.13u"]}
            glow={{ intensity: 0.15 }} />
          <DiagramNode id="dim-db" label="Database" icon="ui:circle-stack"
            position={["72%", "62%", "-300%"]} size={["0.15u", "0.13u"]}
            glow={{ intensity: 0.3 }} />
        </DiagramGroup>

        <DiagramEdge from="dim-web" to="dim-api" flow="forward" />
        <DiagramEdge from="dim-api" to="dim-auth" flow="forward" />
        <DiagramEdge from="dim-api" to="dim-cache" flow="forward" />
        <DiagramEdge from="dim-api" to="dim-db" flow="forward" />
        <DiagramEdge from="dim-auth" to="dim-db" style="dashed" />
      </Diagram>
    </View>

    {/* The punchline — appears after the visual lands */}
    <div key="dim-overlay" className="scene-overlay scene-overlay--bottom">
      <div className="scene-overlay__content">
        <h2 className="scene-punchline">Same data. New dimension.</h2>
      </div>
    </div>
  </Scene>
);
