import {Ambient, Directional, Lighting} from "@brewsite/core";
import {config} from "./settings";

export const Lights = () => (
    <Lighting intensityScale={1}>
        <Ambient intensity={2.6} color="#8899cc" />
        <Directional id={'d1'} intensity={.4} color={config.lightColor} position={[ config.lightOffset,  config.lightOffset, 10]} />
        <Directional id={'d2'} intensity={.4} color={config.lightColor} position={[ 0,            config.lightOffset, 10]} />
        <Directional id={'d3'} intensity={.4} color={config.lightColor} position={[-config.lightOffset,  config.lightOffset, 10]} />
        <Directional id={'d4'} intensity={.4} color={config.lightColor} position={[ config.lightOffset,  0,           10]} />
        <Directional id={'d5'} intensity={.4} color={config.lightColor} position={[ 0,            0,           10]} />
        <Directional id={'d6'} intensity={.4} color={config.lightColor} position={[-config.lightOffset,  0,           10]} />
        <Directional id={'d7'} intensity={.4} color={config.lightColor} position={[ config.lightOffset,  -config.lightOffset, 10]} />
        <Directional id={'d8'} intensity={.4} color={config.lightColor} position={[ 0,            -config.lightOffset, 10]} />
        <Directional id={'d9'} intensity={.4} color={config.lightColor} position={[-config.lightOffset,  -config.lightOffset, 10]} />
    </Lighting>
)
