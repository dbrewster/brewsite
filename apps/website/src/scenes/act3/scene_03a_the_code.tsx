import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  ProgressManager,
  Scene,
} from '@brewsite/core';
import { getMessage } from '../../content/messaging';
import { getSection } from '../../content/siteMap';
import { OverlayColumn } from '../../landing/components/OverlayColumn';
import { OverlayHeadline } from '../../landing/components/OverlayHeadline';
import { SectionLabelRow } from '../../landing/components/SectionLabelRow';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 1200 : 1600;
const msg = getMessage('authoring');
const section = getSection('authoring')!;

/**
 * Act 3a: The Code Reveal.
 *
 * Golden-amber lighting. The mood shifts to intimacy and discovery.
 * The code block IS the visual — showing how simple the JSX authoring is.
 */
export const Scene03aTheCode = (): JSX.Element => (
  <Scene id="website-the-code">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={[0, 2, 8]}
      target={[0, 1, 0]}
      fov={isMobile ? "55deg" : "48deg"}
    />
    {/* Golden amber — intimate, warm, like firelight */}
    <Lighting intensityScale={0.6}>
      <Ambient intensity={0.3} color="#1a1008" />
      <Directional intensity={0.5} color="#FFB84D" position={[-4, 10, 8]} />
      <Directional intensity={0.2} color="#F25F4C" position={[6, 6, 6]} />
    </Lighting>
    <Background color="#0F0D08" opacity={1} />

    {/* The code reveal — centered, the star of the scene */}
    <div key="code-overlay" className="scene-overlay">
      <OverlayColumn align="left" tone="warm">
        <SectionLabelRow number={section.navNumber} label={section.navLabel} />
        <OverlayHeadline
          headline={msg.headline}
          support={msg.support}
          tone="warm"
        />

        <div className="code-block code-block--warm" style={{ textAlign: 'left', pointerEvents: 'auto', marginTop: 24 }}>
          <div className="code-block__header">
            <span className="code-block__dot code-block__dot--red" />
            <span className="code-block__dot code-block__dot--yellow" />
            <span className="code-block__dot code-block__dot--green" />
            <span style={{ marginLeft: 'auto' }}>scene.tsx</span>
          </div>
          <div className="code-block__body">
            <span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Scene</span>
            <span className="tok-prop"> id</span><span className="tok-jsx">=</span>
            <span className="tok-string">"arch"</span>
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Camera</span>
            <span className="tok-prop"> position</span>={'{'}<span className="tok-string">[4, 8, 16]</span>{'}'}{' '}
            <span className="tok-prop">fov</span>={'{'}<span className="tok-string">"48deg"</span>{'}'}{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Lighting</span>
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Directional</span>
            <span className="tok-prop"> color</span>=<span className="tok-string">"#7B61FF"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Directional</span>
            <span className="tok-prop"> color</span>=<span className="tok-string">"#FF61AB"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'</'}</span>
            <span className="tok-keyword">Lighting</span>
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Floor</span>
            <span className="tok-prop"> enabled</span>
            <span className="tok-jsx">{'>'}</span>
            <span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">FloorMirror</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            <span className="tok-jsx">{'</'}</span>
            <span className="tok-keyword">Floor</span>
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">Diagram</span>
            <span className="tok-prop"> tilt</span>={'{'}<span className="tok-string">"-20deg"</span>{'}'}{' '}
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">DiagramNode</span>
            <span className="tok-prop"> label</span>=<span className="tok-string">"Frontend"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">DiagramNode</span>
            <span className="tok-prop"> label</span>=<span className="tok-string">"API"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">DiagramNode</span>
            <span className="tok-prop"> label</span>=<span className="tok-string">"Database"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'    '}<span className="tok-jsx">{'<'}</span>
            <span className="tok-keyword">DiagramEdge</span>
            <span className="tok-prop"> from</span>=<span className="tok-string">"Frontend"</span>
            <span className="tok-prop"> to</span>=<span className="tok-string">"API"</span>{' '}
            <span className="tok-jsx">{'/>'}</span>
            {'\n'}
            {'  '}<span className="tok-jsx">{'</'}</span>
            <span className="tok-keyword">Diagram</span>
            <span className="tok-jsx">{'>'}</span>
            {'\n'}
            <span className="tok-jsx">{'</'}</span>
            <span className="tok-keyword">Scene</span>
            <span className="tok-jsx">{'>'}</span>
          </div>
        </div>
      </OverlayColumn>
    </div>
  </Scene>
);
