import type {JSX} from "react";
import {Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene, View} from "@brewsite/core";
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout} from "@brewsite/diagram";

export const V = { x: "15%", y: "10%", w: "70%", h: "78%" } as const;

export const OverviewScene = (): JSX.Element => (
  <Scene id="cs-overview">
    <ProgressManager scrollUnits={1800}/>
    <Camera mode="world" position={[0, 8, 38]} target={[0, 0, 0]} fov={"50deg"}/>
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff"/>
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 25]}/>
      <Directional intensity={0.3} color="#6677ff" position={[-12, 5, 10]}/>
    </Lighting>
    <Background/>

    <View id="cs-stage" x={V.x} y={V.y} w={V.w} h={V.h}>
      <Diagram
        id="cs-overview-diagram"
        x={0}
        y={0}
        w={"100%"}
        h={"100%"}
        tilt={"-0.2617993878rad"}
        scale={1.0}
      >
        <FlowLayout direction='left-right' gap={"10%"}/>

        <DiagramGroup
          id="layer-author"
          label="Author (DSL) — pure JSX, no Three.js"
          variant="boundary"
        >
          <DiagramNode
            id="ov-scene"
            label="<Scene>"
            sublabel="key/id · easing · overlay children"
            icon="ui:document-text"
            position={["12%", "50%", 0]}
            size={["0.16u", "0.14u"]}
          />
        </DiagramGroup>

        <DiagramGroup
          id="layer-compiler"
          label="Compile (compiler/) — pure functions, zero Three.js"
          variant="swimlane"
        >
          <DiagramNode
            id="ov-frames"
            label="SceneFrame[]"
            sublabel="one snapshot per scene · accumulated from JSX"
            icon="ui:squares-2x2"
            position={["37%", "35%", 0]}
            size={["0.16u", "0.14u"]}
          />
          <DiagramNode
            id="ov-track"
            label="SceneTrack"
            sublabel="flat tick[] · pre-baked · O(1) sampling"
            icon="ui:circle-stack"
            position={["37%", "65%", 0]}
            size={["0.16u", "0.14u"]}
            glow={{intensity: 0.2}}
          />
        </DiagramGroup>

        <DiagramGroup
          id="layer-runtime"
          label="Execute (runtime/) — rAF loop, O(1) per frame"
          variant="cluster"
        >
          <DiagramNode
            id="ov-driver"
            label="RuntimeDriverImpl"
            sublabel="sample SceneTrack → WidgetState dispatch"
            icon="ui:cpu-chip"
            position={["62%", "35%", 0]}
            size={["0.16u", "0.14u"]}
          />
          <DiagramNode
            id="ov-registry"
            label="WidgetRegistry"
            sublabel="routes state by id → IWidget.apply()"
            icon="ui:puzzle-piece"
            position={["62%", "65%", 0]}
            size={["0.16u", "0.14u"]}
          />
        </DiagramGroup>

        <DiagramGroup
          id="layer-output"
          label="Output (player/) — React integration surface"
          variant="boundary"
        >
          <DiagramNode
            id="ov-canvas"
            label="SceneCanvas"
            sublabel="WebGLRenderer · Three.js scene root"
            icon="ui:photo"
            position={["88%", "35%", 0]}
            size={["0.16u", "0.14u"]}
          />
          <DiagramNode
            id="ov-overlay"
            label="EngineOverlayHost"
            sublabel="React HUD over canvas"
            icon="ui:chat-bubble-left-right"
            position={["88%", "65%", 0]}
            size={["0.16u", "0.14u"]}
          />
        </DiagramGroup>

        <DiagramEdge from="ov-scene" to="ov-frames" label="JSX tree" flow="forward"/>
        <DiagramEdge from="ov-frames" to="ov-track" label="bake tick[]" flow="forward"/>
        <DiagramEdge from="ov-track" to="ov-driver" label="sample(progress)" flow="forward"/>
        <DiagramEdge from="ov-driver" to="ov-registry" label="dispatch" flow="forward"/>
        <DiagramEdge from="ov-overlay" to="ov-canvas" label="apply()" flow="forward"/>
        <DiagramEdge from="ov-registry" to="ov-overlay" style="dashed" arrowEnd="open"/>
      </Diagram>
    </View>
  </Scene>
);