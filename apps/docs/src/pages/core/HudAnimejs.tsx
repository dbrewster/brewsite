import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';

export default function HudAnimejs(): JSX.Element {
  return (
    <section>
      <h1>HUD Anime.js Presets</h1>

      <p>
        The <code>hud/animejs/</code> sub-module provides ready-made entrance animations for HUD
        items using anime.js. These are applied via the <code>animations</code> prop on{' '}
        <code>{'<HudItem>'}</code>.
      </p>

      <Callout type="note">
        anime.js is bundled with @brewsite/core — no additional install needed.
      </Callout>

      <h2>Available Presets</h2>

      <CodeBlock
        language="tsx"
        code={`import { fadeIn, slideUp, stagger } from '@brewsite/core/hud/animejs';

<HudItem id="title" animations={[fadeIn({ duration: 400, delay: 100 })]}>
  My Title
</HudItem>`}
      />

      <h2>fadeIn</h2>

      <p>
        Animates opacity from 0 to 1 when the HUD item becomes visible. Accepts an options object
        to control timing.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { fadeIn } from '@brewsite/core/hud/animejs';

<HudItem
  id="headline"
  style={{ position: 'absolute', top: 40, left: 60 }}
  animations={[
    fadeIn({
      duration: 500,   // ms
      delay: 150,      // ms before animation starts
      easing: 'easeOutQuad',
    }),
  ]}
>
  <h1>Scene Title</h1>
</HudItem>`}
      />

      <h2>slideUp</h2>

      <p>
        Translates the element upward from an offset position while fading in. Use <code>distance</code>{' '}
        to control how far it travels.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { slideUp } from '@brewsite/core/hud/animejs';

<HudItem
  id="body-text"
  style={{ position: 'absolute', bottom: 80, left: 60 }}
  animations={[
    slideUp({
      distance: 24,   // px to travel upward
      duration: 400,
    }),
  ]}
>
  <p>Supporting copy goes here.</p>
</HudItem>`}
      />

      <h2>stagger</h2>

      <p>
        Apply a staggered delay across multiple sibling HUD items so they animate in sequence
        rather than all at once.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { fadeIn, stagger } from '@brewsite/core/hud/animejs';

<Hud enabled>
  {['Feature A', 'Feature B', 'Feature C'].map((label, i) => (
    <HudItem
      key={label}
      id={\`feature-\${i}\`}
      style={{ position: 'absolute', top: 40 + i * 48, left: 60 }}
      animations={[
        fadeIn({
          duration: 350,
          delay: stagger(i, { base: 100, step: 80 }),
        }),
      ]}
    >
      {label}
    </HudItem>
  ))}
</Hud>`}
      />

      <Callout type="tip">
        Combine <code>slideUp</code> + <code>fadeIn</code> for a polished entrance effect.
      </Callout>
    </section>
  );
}
