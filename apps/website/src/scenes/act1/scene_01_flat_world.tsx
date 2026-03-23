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

const SCROLL = isMobile ? 900 : 1200;
const msg = getMessage('recognition');
const section = getSection('problem')!;

/**
 * Act 1: The Flat World.
 *
 * A compressed, deliberately dull scene. Flat diagram, muted lighting,
 * no mirror, no glow. Exists to create contrast with Scene 2.
 */
export const Scene01FlatWorld = (): JSX.Element => (
  <Scene id="website-flat-world">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [0, 10, 22] : [0, 8, 18]}
      target={[0, 0, 0]}
      fov={isMobile ? "52deg" : "45deg"}
    />
    {/* Deliberately flat, grey lighting — no drama, no color */}
    <Lighting intensityScale={0.5}>
      <Ambient intensity={0.6} color="#1a1a2e" />
      <Directional intensity={0.3} color="#7777aa" position={[0, 15, 10]} />
    </Lighting>
    <Background color="#0a0a14" opacity={1} />

    <View id="flat-stage" x={"5%"} y={"10%"} w={"90%"} h={"80%"}>
      <Diagram
        id="flat-arch-diagram"
        x={0} y={0} w={"100%"} h={"100%"}
        tilt={0}
        scale={isMobile ? 0.8 : 1.0}
      >
        <FlowLayout direction="left-right" gap={"10%"} />
        <DiagramGroup id="flat-group" variant="boundary" label="">
          <DiagramNode id="flat-web" label="Frontend" icon="ui:globe-alt"
            position={["12%", "35%", 0]} size={["13u", "11u"]} />
          <DiagramNode id="flat-api" label="API" icon="ui:server"
            position={["37%", "35%", 0]} size={["13u", "11u"]} />
          <DiagramNode id="flat-auth" label="Auth" icon="ui:lock-closed"
            position={["62%", "25%", 0]} size={["13u", "11u"]} />
          <DiagramNode id="flat-cache" label="Cache" icon="ui:bolt"
            position={["62%", "50%", 0]} size={["13u", "11u"]} />
          <DiagramNode id="flat-db" label="Database" icon="ui:circle-stack"
            position={["87%", "35%", 0]} size={["13u", "11u"]} />
        </DiagramGroup>
        <DiagramEdge from="flat-web" to="flat-api" flow="forward" />
        <DiagramEdge from="flat-api" to="flat-auth" flow="forward" />
        <DiagramEdge from="flat-api" to="flat-cache" flow="forward" />
        <DiagramEdge from="flat-api" to="flat-db" flow="forward" />
        <DiagramEdge from="flat-auth" to="flat-db" style="dashed" />
      </Diagram>
    </View>

    <div key="flat-overlay" className="scene-overlay scene-overlay--bottom">
      <OverlayColumn vertical="bottom">
        <SectionLabelRow number={section.navNumber} label={section.navLabel} />
        <OverlayHeadline
          headline={msg.headline}
          support={msg.support}
        />
        {msg.punchline && (
          <p className="scene-whisper">{msg.punchline}</p>
        )}
      </OverlayColumn>
    </div>
  </Scene>
);
