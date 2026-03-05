import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene, TextBox} from '@brewsite/core';
import {Lights} from "../../Lights";
import {config} from "../../settings";

export const sceneHero: JSX.Element = (
    <Scene key="bfm-hero" id="bfm-hero">
        <ProgressManager scrollUnits={800}/>
        <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50}/>
        <Lights/>
        <Background color="#080b14"/>

        <TextBox id="bfm-hero-content" x={0.05} y={0.08} w={0.9} h={0.84}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                pointerEvents: 'none',
                textAlign: 'center',
            }}>
                <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(100, 140, 220, 0.7)',
                    marginBottom: 16,
                }}>
                    @BREWFLOW / MEMORY SUBSYSTEM
                </div>
                <h1 style={{
                    fontSize: '56px',
                    fontWeight: 700,
                    color: '#e8f0ff',
                    margin: '0 0 16px',
                    lineHeight: 1.15,
                }}>
                    Memory that compounds.
                </h1>
                <p style={{
                    fontSize: '22px',
                    color: 'rgba(180, 200, 240, 0.75)',
                    margin: '0 0 32px',
                    maxWidth: 600,
                }}>
                    Four subsystems. One loop. Each session better than the last.
                </p>
                <div>
                    <h2 style={{
                        fontSize: '22px',
                        color: 'rgba(180, 200, 240, 0.75)',
                        textAlign: 'left',
                        fontWeight: 600,
                    }}>Problem with agents today:</h2>
                    <ul style={{
                        fontSize: '18px',
                        color: 'rgba(240, 60, 60, 0.65)',
                        maxWidth: 620,
                        lineHeight: 1.7,
                        textAlign: 'left',
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        marginLeft: '20px'
                    }}>
                        <li style={{marginBottom: 8}}>• Sessions start from zero — no memory of what worked or what
                            failed.
                        </li>
                        <li style={{marginBottom: 8}}>• Mistakes are repeated because the previous session's lessons are
                            gone.
                        </li>
                        <li style={{marginBottom: 8}}>• Knowledge accumulates only inside the context window — then
                            evaporates.
                        </li>
                        <li>• There is no mechanism to make the next agent smarter than the last.</li>
                    </ul>
                </div>
            </div>
        </TextBox>
    </Scene>
);
