// pipelineScene.tsx — CI/CD pipeline diagram scene for multi-canvas demo.

import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  ManualLayout, FlowLayout,
} from '@brewsite/diagram';

/**
 * A CI/CD pipeline: Source → Build → Test → Stage → Deploy.
 */
export function PipelineScene(): JSX.Element {
  return (
    <Scene id="pipeline">
      <Diagram id="pipeline-diagram" x={0} y={0} w={"100%"} h={"100%"} tilt={"-0.2rad"} scale={1}>
        <FlowLayout gap={"20%"}/>
        <DiagramNode
          id="source"
          label="Source"
          shape="rectangle"
          icon="ui:code-bracket"
          position={["10%", "45%", 0]}
          size={["0.14u", "0.14u"]}
        />
        <DiagramNode
          id="build"
          label="Build"
          shape="rectangle"
          icon="ui:wrench"
          position={["30%", "45%", 0]}
          size={["0.14u", "0.14u"]}
        />
        <DiagramNode
          id="test"
          label="Test"
          shape="diamond"
          icon="ui:check-circle"
          position={["50%", "45%", 0]}
          size={["0.14u", "0.14u"]}
        />
        <DiagramNode
          id="stage"
          label="Staging"
          shape="rectangle"
          icon="ui:cloud"
          position={["70%", "45%", 0]}
          size={["0.14u", "0.14u"]}
        />
        <DiagramNode
          id="deploy"
          label="Production"
          shape="hexagon"
          icon="ui:cloud-arrow-up"
          position={["90%", "45%", 0]}
          size={["0.14u", "0.14u"]}
        />

        <DiagramEdge from="source" to="build" label="Push" flow="forward" />
        <DiagramEdge from="build" to="test" label="Artifacts" flow="forward" />
        <DiagramEdge from="test" to="stage" label="Pass" flow="forward" />
        <DiagramEdge from="stage" to="deploy" label="Approve" flow="forward" />
      </Diagram>
    </Scene>
  );
}
