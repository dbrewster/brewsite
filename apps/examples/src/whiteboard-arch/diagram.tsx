// Shared diagram tree for the whiteboard architecture slide deck — used by every scene.
import type {JSX} from 'react';
import {
    Diagram,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    ManualLayout,
} from '@brewsite/diagram';

/** Returns the full whiteboard architecture <Diagram> JSX tree. */
export function makeWhiteboardDiagram(): JSX.Element {
    return (
        <Diagram id="whiteboard-arch-diagram">
            <ManualLayout/>

            {/* ── Standalone nodes ── */}

            {/* Green control plane nodes */}
            <DiagramNode id="peas" label="PEAS"
                         shape="circle"
                         position={[0.05, 0.486, 0]} size={[0.062, 0.11]} color="#33aa66"/>
            <DiagramNode id="user-db" label="User DB"
                         icon="flow:cylinder"
                         position={[0.05, 0.705, 0]} size={[0.062, 0.055]} color="#33aa66"/>
            <DiagramNode id="fw-url-update" label="FW URL Update"
                         shape="rectangle"
                         position={[0.25, 0.13, 0]} size={[0.075, 0.068]} color="#33aa66"/>
            <DiagramNode id="app-catalog" label="App Catalog"
                         shape="rectangle"
                         position={[0.338, 0.13, 0]} size={[0.075, 0.068]} color="#33aa66"/>
            <DiagramNode id="app-repo" label="App repo"
                         shape="rectangle"
                         position={[0.375, 0.062, 0]} size={[0.05, 0.041]} color="#33aa66"/>

            {/* Red current-state standalone nodes */}
            <DiagramNode id="destination" label="Destination"
                         position={[0.487, 0.13, 0]} size={[0.087, 0.082]} color="#cc3333"/>
            <DiagramNode id="j-junction" label="J"
                         shape="circle"
                         position={[0.263, 0.568, 0]} size={[0.031, 0.068]} color="#cc3333"/>
            <DiagramNode id="kong" label="KONG"
                         shape="circle"
                         position={[0.762, 0.404, 0]} size={[0.075, 0.137]} color="#cc3333"/>
            <DiagramNode id="atlas" label="ATLAS"
                         position={[0.762, 0.568, 0]} size={[0.075, 0.082]} color="#cc3333"/>
            <DiagramNode id="kafka" label="Kafka"
                         position={[0.863, 0.514, 0]} size={[0.062, 0.247]} color="#cc3333"/>
            <DiagramNode id="gr" label="GR"
                         position={[0.95, 0.514, 0]} size={[0.062, 0.219]} color="#cc3333"/>

            {/* Blue future-state standalone nodes */}
            <DiagramNode id="rust-oval" label="RUST"
                         shape="oval"
                         position={[0.475, 0.24, 0]} size={[0.05, 0.055]} color="#3366cc"/>
            <DiagramNode id="hook-policy" label="hook policy (JWT)"
                         position={[0.45, 0.733, 0]} size={[0.087, 0.055]} color="#3366cc"/>
            <DiagramNode id="streaming" label="Streaming"
                         position={[0.6, 0.733, 0]} size={[0.075, 0.055]} color="#3366cc"/>
            <DiagramNode id="isc" label="ISC"
                         position={[0.95, 0.623, 0]} size={[0.05, 0.041]} color="#3366cc"/>
            <DiagramNode id="openai-pipeline" label="inputs → compile → OpenAI"
                         position={[0.725, 0.76, 0]} size={[0.113, 0.055]} color="#3366cc"/>
            <DiagramNode id="xchange" label="x-change"
                         position={[0.762, 0.473, 0]} size={[0.05, 0.041]} color="#3366cc"/>

            {/* ── FW Cloud group (Red, boundary dashed) ── */}
            <DiagramGroup id="fw-cloud-group" label="FW Cloud" color="#cc3333"
                          variant="boundary" borderStyle="dashed" fillOpacity={0.12}>
                <DiagramNode id="zsl" label="ZSL"
                             position={[0.163, 0.377, 0]} size={[0.05, 0.068]} color="#cc3333"/>
                <DiagramNode id="pa" label="PA"
                             position={[0.25, 0.377, 0]} size={[0.05, 0.068]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── Client group (Red, container) ── */}
            <DiagramGroup id="client-group" label="Client" color="#cc3333" variant="container">
                <DiagramNode id="wa" label="WA"
                             position={[0.163, 0.925, 0]} size={[0.062, 0.068]} color="#cc3333"/>
                <DiagramNode id="fc" label="FC"
                             position={[0.25, 0.925, 0]} size={[0.062, 0.068]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── Proxy Pod group (Red, container) ── */}
            <DiagramGroup id="proxy-pod-group" label="Pod / Proxy (S3)" color="#cc3333" variant="container">
                <DiagramNode id="rust-mitm" label="RUST MITM"
                             sublabel='Port: 8443 / 4128 / 443 / 80'
                             position={[0.425, 0.349, 0]} size={[0.062, 0.082]} color="#cc3333"/>
                <DiagramNode id="vscode-proxy" label="Vscode"
                             position={[0.494, 0.349, 0]} size={[0.05, 0.055]} color="#cc3333"/>
                <DiagramNode id="parsolib" label="Parsolib"
                             position={[0.425, 0.445, 0]} size={[0.062, 0.041]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── ALB (UDP) group (Blue, container) ── */}
            <DiagramGroup id="alb-group" label="ALB (UDP)" color="#3366cc" variant="container">
                <DiagramNode id="ct-http" label="CT(P/IP) HTTP"
                             position={[0.562, 0.295, 0]} size={[0.087, 0.068]} color="#3366cc"/>
                <DiagramNode id="icap" label="ICAP"
                             position={[0.562, 0.377, 0]} size={[0.087, 0.068]} color="#3366cc"/>
                <DiagramNode id="quix-ws" label="QUIX / WebSocket"
                             position={[0.562, 0.459, 0]} size={[0.087, 0.068]} color="#3366cc"/>

                {/* ── Protoparser Pod group (Blue, container) nested inside alb-group ── */}
                <DiagramGroup id="protoparser-pod-group" label="Protoparser Pod" color="#3366cc" variant="container">
                    <DiagramNode id="vscode-proto" label="Vscode"
                                 position={[0.662, 0.295, 0]} size={[0.056, 0.055]} color="#3366cc"/>
                    <DiagramNode id="gemini" label="Gemini"
                                 position={[0.662, 0.377, 0]} size={[0.056, 0.055]} color="#3366cc"/>
                </DiagramGroup>
            </DiagramGroup>

            {/* ── Edges ── */}

            {/* Green EDL edges */}
            <DiagramEdge id="edl-peas" from="peas" to="zsl"
                         label="EDL" color="#33aa66" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="edl-fw-url" from="fw-url-update" to="pa"
                         label="EDL" color="#33aa66" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="edl-app-catalog" from="app-catalog" to="pa"
                         color="#33aa66" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="app-repo-to-catalog" from="app-repo" to="app-catalog"
                         label="App repo" color="#33aa66" style="solid" arrowEnd="open"/>

            {/* Red Pchain edges */}
            <DiagramEdge id="pchain-cloud-proxy" from="pa" to="rust-mitm"
                         label="Pchain / NLB" color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="pchain-client-proxy" from="fc" to="rust-mitm"
                         label="Pchain" color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="pchain-cloud-client" from="pa" to="j-junction"
                         color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="pchain-junction-client" from="j-junction" to="wa"
                         color="#cc3333" style="solid" arrowEnd="open"/>

            {/* Blue proxy → ALB edges */}
            <DiagramEdge id="proxy-to-alb" from="vscode-proxy" to="ct-http"
                         color="#3366cc" style="solid" arrowEnd="open"/>
            <DiagramEdge id="proxy-to-icap" from="rust-mitm" to="icap"
                         color="#3366cc" style="solid" arrowEnd="open"/>

            {/* Blue ALB → protoparser edges */}
            <DiagramEdge id="alb-to-proto" from="ct-http" to="vscode-proto"
                         color="#3366cc" style="solid" arrowEnd="open"/>

            {/* Blue protoparser → downstream */}
            <DiagramEdge id="proto-to-kong" from="gemini" to="kong"
                         label="Streaming" color="#3366cc" style="solid" arrowEnd="open"/>

            {/* Red downstream chain */}
            <DiagramEdge id="kong-to-atlas" from="kong" to="atlas"
                         label="HTTP" color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="atlas-to-kafka" from="atlas" to="kafka"
                         color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="kafka-to-gr" from="kafka" to="gr"
                         color="#cc3333" style="solid" arrowEnd="open"/>
            <DiagramEdge id="kafka-to-isc" from="kafka" to="isc"
                         color="#cc3333" style="solid" arrowEnd="open"/>

            {/* Blue future annotations (dashed) */}
            <DiagramEdge id="hook-to-proxy" from="hook-policy" to="rust-mitm"
                         color="#3366cc" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="streaming-to-proto" from="streaming" to="gemini"
                         color="#3366cc" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="streaming-to-proto" from="streaming" to="atlas"
                         color="#3366cc" style="dashed" arrowEnd="open"/>
            <DiagramEdge id="atlas-to-openai" from="atlas" to="openai-pipeline"
                         color="#3366cc" style="dashed" arrowEnd="open"/>

            {/* Destination link */}
            <DiagramEdge id="dest-to-proxy" from="destination" to="rust-oval"
                         color="#cc3333" style="solid" arrowEnd="none"/>
        </Diagram>
    );
}
