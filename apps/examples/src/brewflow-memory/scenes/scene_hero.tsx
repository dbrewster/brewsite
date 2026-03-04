import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {Lights} from "../../Lights";
import {config} from "../../settings";

export const sceneHero: JSX.Element = (
    <Scene key="bfm-hero" id="bfm-hero">
        <ProgressManager scrollUnits={800}/>
        <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50}/>
        <Lights/>
        <Background color="#080b14"/>

        <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '0 40px',
            textAlign: 'center',
        }}>
            <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.72rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase' as const,
                color: 'rgba(100, 140, 220, 0.7)',
                marginBottom: 16,
            }}>
                @BREWFLOW / MEMORY SUBSYSTEM
            </div>
            <h1 style={{
                fontSize: 'clamp(1.89rem, 4.9vw, 3.5rem)',
                fontWeight: 700,
                color: '#e8f0ff',
                margin: '0 0 16px',
                lineHeight: 1.15,
            }}>
                Memory that compounds.
            </h1>
            <p style={{
                fontSize: 'clamp(0.94rem, 2.2vw, 1.33rem)',
                color: 'rgba(180, 200, 240, 0.75)',
                margin: '0 0 32px',
                maxWidth: 600,
            }}>
                Four subsystems. One loop. Each session better than the last.
            </p>
            <div>
                <h2 style={{
                    fontSize: 'clamp(0.94rem, 2.2vw, 1.33rem)',
                    color: 'rgba(180, 200, 240, 0.75)',
                    textAlign: 'left',
                    fontWeight: 600,
                }}>Problem with agents today:</h2>
                <ul style={{
                    fontSize: 'clamp(0.89rem, 1.7vw, 1.11rem)',
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
    </Scene>
);
