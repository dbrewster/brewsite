// DeployPipelineScene.tsx — CI/CD pipeline diagram for the MDX embed example.

import type { JSX } from 'react';
import { Scene, Camera } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  FlowLayout,
} from '@brewsite/diagram';

export function DeployPipelineScene(): JSX.Element {
  return (
    <Scene id="deploy-pipeline">
      <Camera mode='world' position={[0, 3, 6]} target={[0, 0, 0]}/>
      <Diagram id="pipeline-diagram" x={0} y={0} w="100%" h="100%" scale={1}>
        <FlowLayout gap="20%" />

        <DiagramNode
          id="commit"
          label="Commit"
          shape="rectangle"
          icon="ui:code-bracket"
          position={["10%", "50%", 0]}
          size={["13u", "13u"]}
        />
        <DiagramNode
          id="ci"
          label="CI Build"
          shape="rectangle"
          icon="ui:wrench"
          position={["30%", "50%", 0]}
          size={["13u", "13u"]}
        />
        <DiagramNode
          id="test"
          label="Tests"
          shape="diamond"
          icon="ui:check-circle"
          position={["50%", "50%", 0]}
          size={["13u", "13u"]}
        />
        <DiagramNode
          id="staging"
          label="Staging"
          shape="rectangle"
          icon="ui:cloud"
          position={["70%", "50%", 0]}
          size={["13u", "13u"]}
        />
        <DiagramNode
          id="prod"
          label="Production"
          shape="hexagon"
          icon="ui:cloud-arrow-up"
          position={["90%", "50%", 0]}
          size={["13u", "13u"]}
        />

        <DiagramEdge from="commit" to="ci" label="Push" flow="forward" />
        <DiagramEdge from="ci" to="test" label="Artifacts" flow="forward" />
        <DiagramEdge from="test" to="staging" label="Pass" flow="forward" />
        <DiagramEdge from="staging" to="prod" label="Approve" flow="forward" />
      </Diagram>
    </Scene>
  );
}
