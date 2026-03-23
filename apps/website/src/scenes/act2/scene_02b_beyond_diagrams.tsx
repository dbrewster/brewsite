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
import { getMessage } from '../../content/messaging';
import { getSection } from '../../content/siteMap';
import { OverlayColumn } from '../../landing/components/OverlayColumn';
import { OverlayHeadline } from '../../landing/components/OverlayHeadline';
import { SectionLabelRow } from '../../landing/components/SectionLabelRow';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 1050 : 1400;
const MIRROR_RES = isMobile ? 512 : 1024;
const msg = getMessage('scope');
const section = getSection('primitives')!;

/**
 * Act 2b: Beyond Diagrams — content surfaces from one story.
 *
 * Warmer still. Pink + coral lighting. Multiple output surfaces
 * arranged in space, broadening beyond diagrams into the full toolkit.
 */
export const Scene02bBeyondDiagrams = (): JSX.Element => (
  <Scene id="website-beyond-diagrams">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [0, 7, 18] : [0, 6, 14]}
      target={[0, 1, 0]}
      fov={isMobile ? "54deg" : "48deg"}
    />
    {/* Pink + coral — the warmth builds */}
    <Lighting intensityScale={1.1}>
      <Ambient intensity={0.3} color="#1a0a20" />
      <Directional intensity={0.6} color="#FF61AB" position={[-6, 12, 8]} />
      <Directional intensity={0.4} color="#F25F4C" position={[8, 8, 10]} />
      <Directional intensity={0.2} color="#7B61FF" position={[0, 14, -4]} />
    </Lighting>
    <Background color="#110a18" opacity={1} />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#110a18"
        mirrorOpacity={0.1}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>

    <View id="toolkit-stage" x={"5%"} y={"5%"} w={"90%"} h={"80%"}>
      <Diagram
        id="toolkit-showcase"
        x={0} y={0} w={"100%"} h={"100%"}
        tilt={"-0.2855993321rad"}
        scale={isMobile ? 0.8 : 1.0}
      >
        <FlowLayout direction="left-right" gap={"10%"} />
        <DiagramGroup id="tk-group" variant="cluster" label="">
          <DiagramNode id="tk-diagrams" label="Diagrams" sublabel="Architecture · Flow · System"
            icon="ui:squares-2x2" position={["12%", "30%", "200%"]}
            size={["16u", "14u"]} glow={{ intensity: 0.25 }} />
          <DiagramNode id="tk-model" label="Models" sublabel="GLTF · Animations · Labels"
            icon="ui:sparkles" position={["36%", "55%", "100%"]}
            size={["16u", "14u"]} glow={{ intensity: 0.25 }} />
          <DiagramNode id="tk-charts" label="Charts" sublabel="Bar · Line · Area · Pie"
            icon="ui:chart-bar" position={["60%", "30%", 0]}
            size={["16u", "14u"]} glow={{ intensity: 0.3 }} />
          <DiagramNode id="tk-slides" label="Slides" sublabel="Decks · Presentations"
            icon="ui:presentation-chart-bar" position={["84%", "55%", "-100%"]}
            size={["16u", "14u"]} glow={{ intensity: 0.2 }} />
          <DiagramNode id="tk-screens" label="Screens" sublabel="Mockups · Demos"
            icon="ui:computer-desktop" position={["60%", "75%", "-200%"]}
            size={["16u", "14u"]} glow={{ intensity: 0.2 }} />
        </DiagramGroup>
        <DiagramEdge from="tk-diagrams" to="tk-model" style="dashed" />
        <DiagramEdge from="tk-model" to="tk-charts" style="dashed" />
        <DiagramEdge from="tk-charts" to="tk-slides" style="dashed" />
        <DiagramEdge from="tk-charts" to="tk-screens" style="dashed" />
      </Diagram>
    </View>

    <div key="beyond-overlay" className="scene-overlay scene-overlay--bottom">
      <OverlayColumn vertical="bottom">
        <SectionLabelRow number={section.navNumber} label={section.navLabel} />
        <OverlayHeadline
          headline={msg.headline}
          support={msg.support}
        />
      </OverlayColumn>
    </div>
  </Scene>
);
