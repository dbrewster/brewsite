import {Camera, Scene} from '@brewsite/core';
import { Diagram, DiagramEdge, DiagramNode, ImagePanel, Screen } from '@brewsite/diagram';

const PLACEHOLDER_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

export const scene01Diagram = {
  id: 'diagram-overview',
  index: 0,
  getFrame: () => (
    <Scene id="diagram-overview">
      <Camera
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={40}
        lookAtZ={-200}
      />
      <Diagram id="diagram-basic" layout="manual">
        <DiagramNode id="frontend" label="Frontend" shape="flow:rounded" position={[-6, 2, 0]} />
        <DiagramNode id="api" label="API" shape="flow:rect" position={[0, 2, 0]} />
        <DiagramNode id="db" label="Database" shape="flow:cylinder" position={[6, 2, 0]} />

        <DiagramEdge from="frontend" to="api" />
        <DiagramEdge from="api" to="db" />
      </Diagram>

      <ImagePanel
        id="diagram-image"
        src={PLACEHOLDER_IMAGE}
        position={[-4, -6, 6]}
        rotation={[0, -0.2, 0]}
        width={8}
        bezel="dark"
        gloss={0.6}
        selfIllumination={0.2}
        glow={true}
        glowColor="#4488ff"
      />

      <Screen
        id="diagram-screen"
        src="https://example.com"
        position={[6, -6, 6]}
        rotation={[0, 0, 0]}
        width={8}
        height={4.5}
        bezel="chrome"
        glow={true}
        glowColor="#6699ff"
        opacity={1}
      />
    </Scene>
  ),
};
