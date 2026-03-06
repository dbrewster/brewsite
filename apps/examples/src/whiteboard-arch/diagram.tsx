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
                         position={[-27, 4, 0]} size={[5, 4]} color="#33aa66"/>
            <DiagramNode id="user-db" label="User DB"
                         icon="flow:cylinder"
                         position={[-27, -4, 0]} size={[5, 2]} color="#33aa66"/>
            <DiagramNode id="fw-url-update" label="FW URL Update"
                         shape="rectangle"
                         position={[-11, 17, 0]} size={[6, 2.5]} color="#33aa66"/>
            <DiagramNode id="app-catalog" label="App Catalog"
                         shape="rectangle"
                         position={[-4, 17, 0]} size={[6, 2.5]} color="#33aa66"/>
            <DiagramNode id="app-repo" label="App repo"
                         shape="rectangle"
                         position={[-1, 19.5, 0]} size={[4, 1.5]} color="#33aa66"/>

            {/* Red current-state standalone nodes */}
            <DiagramNode id="destination" label="Destination"
                         position={[8, 17, 0]} size={[7, 3]} color="#cc3333"/>
            <DiagramNode id="j-junction" label="J"
                         shape="circle"
                         position={[-10, 1, 0]} size={[2.5, 2.5]} color="#cc3333"/>
            <DiagramNode id="kong" label="KONG"
                         shape="circle"
                         position={[30, 7, 0]} size={[6, 5]} color="#cc3333"/>
            <DiagramNode id="atlas" label="ATLAS"
                         position={[30, 1, 0]} size={[6, 3]} color="#cc3333"/>
            <DiagramNode id="kafka" label="Kafka"
                         position={[38, 3, 0]} size={[5, 9]} color="#cc3333"/>
            <DiagramNode id="gr" label="GR"
                         position={[45, 3, 0]} size={[5, 8]} color="#cc3333"/>

            {/* Blue future-state standalone nodes */}
            <DiagramNode id="rust-oval" label="RUST"
                         shape="oval"
                         position={[7, 13, 0]} size={[4, 2]} color="#3366cc"/>
            <DiagramNode id="hook-policy" label="hook policy (JWT)"
                         position={[5, -5, 0]} size={[7, 2]} color="#3366cc"/>
            <DiagramNode id="streaming" label="Streaming"
                         position={[17, -5, 0]} size={[6, 2]} color="#3366cc"/>
            <DiagramNode id="isc" label="ISC"
                         position={[45, -1, 0]} size={[4, 1.5]} color="#3366cc"/>
            <DiagramNode id="openai-pipeline" label="inputs → compile → OpenAI"
                         position={[27, -6, 0]} size={[9, 2]} color="#3366cc"/>
            <DiagramNode id="xchange" label="x-change"
                         position={[30, 4.5, 0]} size={[4, 1.5]} color="#3366cc"/>

            {/* ── FW Cloud group (Red, boundary dashed) ── */}
            <DiagramGroup id="fw-cloud-group" label="FW Cloud" color="#cc3333"
                          variant="boundary" borderStyle="dashed" fillOpacity={0.12}>
                <DiagramNode id="zsl" label="ZSL"
                             position={[-18, 8, 0]} size={[4, 2.5]} color="#cc3333"/>
                <DiagramNode id="pa" label="PA"
                             position={[-11, 8, 0]} size={[4, 2.5]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── Client group (Red, container) ── */}
            <DiagramGroup id="client-group" label="Client" color="#cc3333" variant="container">
                <DiagramNode id="wa" label="WA"
                             position={[-18, -12, 0]} size={[5, 2.5]} color="#cc3333"/>
                <DiagramNode id="fc" label="FC"
                             position={[-11, -12, 0]} size={[5, 2.5]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── Proxy Pod group (Red, container) ── */}
            <DiagramGroup id="proxy-pod-group" label="Pod / Proxy (S3)" color="#cc3333" variant="container">
                <DiagramNode id="rust-mitm" label="RUST MITM"
                             sublabel='Port: 8443 / 4128 / 443 / 80'
                             position={[3, 9, 0]} size={[5, 3]} color="#cc3333"/>
                <DiagramNode id="vscode-proxy" label="Vscode"
                             position={[8.5, 9, 0]} size={[4, 2]} color="#cc3333"/>
                <DiagramNode id="parsolib" label="Parsolib"
                             position={[3, 5.5, 0]} size={[5, 1.5]} color="#cc3333"/>
            </DiagramGroup>

            {/* ── ALB (UDP) group (Blue, container) ── */}
            <DiagramGroup id="alb-group" label="ALB (UDP)" color="#3366cc" variant="container">
                <DiagramNode id="ct-http" label="CT(P/IP) HTTP"
                             position={[14, 11, 0]} size={[7, 2.5]} color="#3366cc"/>
                <DiagramNode id="icap" label="ICAP"
                             position={[14, 8, 0]} size={[7, 2.5]} color="#3366cc"/>
                <DiagramNode id="quix-ws" label="QUIX / WebSocket"
                             position={[14, 5, 0]} size={[7, 2.5]} color="#3366cc"/>

                {/* ── Protoparser Pod group (Blue, container) nested inside alb-group ── */}
                <DiagramGroup id="protoparser-pod-group" label="Protoparser Pod" color="#3366cc" variant="container">
                    <DiagramNode id="vscode-proto" label="Vscode"
                                 position={[22, 11, 0]} size={[4.5, 2]} color="#3366cc"/>
                    <DiagramNode id="gemini" label="Gemini"
                                 position={[22, 8, 0]} size={[4.5, 2]} color="#3366cc"/>
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
