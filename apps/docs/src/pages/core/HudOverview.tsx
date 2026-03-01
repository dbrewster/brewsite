import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import HudOverlayDemo, { CODE as HUD_CODE } from '../../demos/core/HudOverlayDemo.demo';

export default function HudOverview(): JSX.Element {
  return (
    <section>
      <h1>HUD System</h1>

      <p>
        The HUD (Heads-Up Display) renders React components as a 2D overlay on top of the Three.js
        canvas. Text, icons, labels, and UI elements can appear and disappear on scene transitions.
      </p>

      <LiveDemo title="HUD overlay appears on scene transition" code={HUD_CODE}>
        <HudOverlayDemo />
      </LiveDemo>

      <h2><code>{'<Hud>'}</code> Component</h2>

      <p>
        Declare a HUD group inside a <code>{'<Scene>'}</code>. The <code>enabled</code> prop
        controls whether the HUD is visible in this scene.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene id="intro" frames={120}>
  <Camera position={[0, 1.5, 4]} target={[0, 1, 0]} />
  <Hud enabled>
    <HudItem id="title" style={{ position: 'absolute', top: 40, left: 60 }}>
      <h2>Welcome</h2>
    </HudItem>
  </Hud>
</Scene>`}
      />

      <PropTable
        rows={[
          {
            name: 'enabled',
            type: 'boolean',
            required: false,
            defaultValue: 'true',
            description: 'Whether this HUD group is visible in this scene',
          },
        ]}
      />

      <h2><code>{'<HudItem>'}</code> Component</h2>

      <p>Each item is positioned absolutely over the canvas using standard CSS.</p>

      <CodeBlock
        language="tsx"
        code={`<HudItem
  id="subtitle"
  style={{ position: 'absolute', bottom: 60, left: 60, color: '#ffffff' }}
>
  <p>Scroll to explore</p>
</HudItem>`}
      />

      <PropTable
        rows={[
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Stable identifier for this HUD item across scenes',
          },
          {
            name: 'style',
            type: 'React.CSSProperties',
            required: false,
            defaultValue: '—',
            description:
              "CSS positioning and appearance. Use `position: 'absolute'` with `top/left/right/bottom`.",
          },
          {
            name: 'children',
            type: 'ReactNode',
            required: false,
            defaultValue: '—',
            description: 'React content to render',
          },
        ]}
      />

      <h2>Baked Visibility</h2>

      <p>
        The <code>enabled</code> prop is compiled into the SceneTrack. HUD items
        appear/disappear at scene transitions, not on arbitrary frame updates.
      </p>

      <Callout type="note">
        HUD items always render at full opacity when enabled. For fade-in/fade-out effects, use
        the Anime.js presets — see{' '}
        <Link to="/core/hud-animejs">HUD Anime.js Presets</Link>.
      </Callout>
    </section>
  );
}
