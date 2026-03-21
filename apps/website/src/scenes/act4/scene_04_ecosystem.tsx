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
} from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 900 : 1200;
const MIRROR_RES = isMobile ? 512 : 1024;

/**
 * Act 4: The Ecosystem — Aurora.
 *
 * Full aurora palette: violet + green + gold. The world is fully alive.
 * Package constellation with core at center. The node labels ARE the text —
 * no overlay copy needed. The visual communicates completeness and life.
 */
export const Scene04Ecosystem = (): JSX.Element => (
  <Scene id="website-ecosystem">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [0, 9, 28] : [0, 8, 22]}
      target={[0, 0, 0]}
      fov={isMobile ? "52deg" : "48deg"}
    />
    {/* Full aurora — violet + green + gold. The world is alive. */}
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.25} color="#0a0818" />
      <Directional intensity={0.5} color="#7B61FF" position={[-8, 14, 8]} />
      <Directional intensity={0.4} color="#00D4AA" position={[8, 10, 10]} />
      <Directional intensity={0.3} color="#FFB84D" position={[0, 6, -6]} />
    </Lighting>
    <Background color="#0A0818" opacity={1} />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0A0818"
        mirrorOpacity={0.1}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>

    <View id="eco-stage" x={"2%"} y={"5%"} w={"96%"} h={"82%"}>
      <Diagram
        id="ecosystem-diagram"
        x={0} y={0} w={"100%"} h={"100%"}
        tilt={"-0.2855993321rad"}
        scale={isMobile ? 0.65 : 0.85}
      >
        {/* Core — the glowing heart */}
        <DiagramNode id="eco-core" label="@brewsite/core" sublabel="Engine"
          icon="ui:cpu-chip" position={["50%", "45%", 0]}
          size={["0.18u", "0.14u"]} glow={{ intensity: 0.4 }} />

        {/* Inner ring — element packages */}
        <DiagramGroup id="eco-inner" variant="boundary" label="">
          <DiagramNode id="eco-diagram" label="diagram" sublabel="Nodes · Edges · Groups"
            icon="ui:squares-2x2" position={["20%", "22%", "100%"]}
            size={["0.14u", "0.11u"]} glow={{ intensity: 0.2 }} />
          <DiagramNode id="eco-model" label="model" sublabel="GLTF · Labels"
            icon="ui:sparkles" position={["80%", "22%", "100%"]}
            size={["0.14u", "0.11u"]} glow={{ intensity: 0.2 }} />
          <DiagramNode id="eco-charts" label="charts" sublabel="Bar · Line · Pie"
            icon="ui:chart-bar" position={["20%", "68%", "-100%"]}
            size={["0.14u", "0.11u"]} glow={{ intensity: 0.2 }} />
          <DiagramNode id="eco-slides" label="slides" sublabel="Decks · Presentations"
            icon="ui:presentation-chart-bar" position={["80%", "68%", "-100%"]}
            size={["0.14u", "0.11u"]} glow={{ intensity: 0.15 }} />
        </DiagramGroup>

        {/* Outer ring — support packages (desktop only) */}
        {!isMobile && (
          <DiagramGroup id="eco-outer" variant="cluster" label="">
            <DiagramNode id="eco-screens" label="screens" icon="ui:computer-desktop"
              position={["6%", "45%", "-150%"]} size={["0.11u", "0.09u"]} />
            <DiagramNode id="eco-textures" label="textures" icon="ui:swatch"
              position={["94%", "45%", "-150%"]} size={["0.11u", "0.09u"]} />
            <DiagramNode id="eco-themes" label="themes" icon="ui:paint-brush"
              position={["50%", "88%", "-150%"]} size={["0.11u", "0.09u"]} />
          </DiagramGroup>
        )}

        <DiagramEdge from="eco-core" to="eco-diagram" style="dashed" />
        <DiagramEdge from="eco-core" to="eco-model" style="dashed" />
        <DiagramEdge from="eco-core" to="eco-charts" style="dashed" />
        <DiagramEdge from="eco-core" to="eco-slides" style="dashed" />
        {!isMobile && (
          <>
            <DiagramEdge from="eco-core" to="eco-screens" style="dashed" />
            <DiagramEdge from="eco-core" to="eco-textures" style="dashed" />
            <DiagramEdge from="eco-core" to="eco-themes" style="dashed" />
          </>
        )}
      </Diagram>
    </View>

    {/* No wall of text. Just the essential facts. */}
    <div key="eco-overlay" className="scene-overlay scene-overlay--bottom">
      <div className="scene-overlay__content">
        <div className="meta-strip meta-strip--warm">
          <span>MIT Licensed</span>
          <span className="meta-strip__dot">·</span>
          <span>TypeScript</span>
          <span className="meta-strip__dot">·</span>
          <span>React 18+</span>
          <span className="meta-strip__dot">·</span>
          <span>v0.7.3</span>
        </div>
      </div>
    </div>
  </Scene>
);
