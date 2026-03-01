import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';

export default function HudAnimejs(): JSX.Element {
  return (
    <section>
      <h1>Anime.js Presets</h1>

      <p>
        The <code>hud/animejs/</code> sub-module provides entrance animation utilities for overlay
        content using anime.js. Use these to animate HTML elements that appear as children of{' '}
        <code>{'<Scene>'}</code> and are rendered by <code>{'<EngineOverlayHost>'}</code>.
      </p>

      <Callout type="note">
        anime.js is bundled with @brewsite/core — no additional install needed.
      </Callout>

      <h2>
        <code>useScrollTimeline</code>
      </h2>

      <p>
        <code>useScrollTimeline</code> returns a timeline object tied to scroll progress within the
        current scene. Attach it to your overlay elements using a ref to drive animations as the
        user scrolls through the scene.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useRef } from 'react';
import { useScrollTimeline } from '@brewsite/core/hud/animejs';

function HeroOverlay() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useScrollTimeline((timeline) => {
    // timeline.progress is 0..1 as the scene scrolls
    timeline.add({
      targets: titleRef.current,
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 400,
      easing: 'easeOutQuad',
    });
  });

  return (
    <div style={{ position: 'absolute', top: '20%', left: '10%' }}>
      <h1 ref={titleRef} style={{ color: '#ffffff' }}>Hello World</h1>
    </div>
  );
}

// Render inside a Scene as overlay content:
<Scene key="hero">
  <Camera type="world" position={[2, 1.5, 6]} />
  <HeroOverlay />
</Scene>`}
      />

      <h2>Available Presets</h2>

      <p>
        Import preset factories from <code>@brewsite/core/hud/animejs</code> and call them inside
        a <code>useScrollTimeline</code> callback. Each preset returns an anime.js animation
        configuration object.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { fadeIn, slideUp, stagger } from '@brewsite/core/hud/animejs';`}
      />

      <h2>fadeIn</h2>

      <p>
        Animates opacity from 0 to 1 when the overlay content enters. Accepts an options object to
        control timing.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useRef } from 'react';
import { useScrollTimeline, fadeIn } from '@brewsite/core/hud/animejs';

function TitleOverlay() {
  const ref = useRef<HTMLHeadingElement>(null);

  useScrollTimeline((timeline) => {
    timeline.add({
      targets: ref.current,
      ...fadeIn({
        duration: 500,   // ms
        delay: 150,      // ms before animation starts
        easing: 'easeOutQuad',
      }),
    });
  });

  return (
    <div style={{ position: 'absolute', top: 40, left: 60 }}>
      <h1 ref={ref} style={{ color: '#ffffff' }}>Scene Title</h1>
    </div>
  );
}`}
      />

      <h2>slideUp</h2>

      <p>
        Translates the element upward from an offset position while fading in. Use{' '}
        <code>distance</code> to control how far it travels.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useRef } from 'react';
import { useScrollTimeline, slideUp } from '@brewsite/core/hud/animejs';

function BodyOverlay() {
  const ref = useRef<HTMLParagraphElement>(null);

  useScrollTimeline((timeline) => {
    timeline.add({
      targets: ref.current,
      ...slideUp({
        distance: 24,   // px to travel upward
        duration: 400,
      }),
    });
  });

  return (
    <div style={{ position: 'absolute', bottom: 80, left: 60 }}>
      <p ref={ref} style={{ color: '#cccccc' }}>Supporting copy goes here.</p>
    </div>
  );
}`}
      />

      <h2>stagger</h2>

      <p>
        Apply a staggered delay across multiple overlay elements so they animate in sequence rather
        than all at once. Pass the element index and options to <code>stagger()</code> to compute
        the correct delay for each item.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { useRef } from 'react';
import { useScrollTimeline, fadeIn, stagger } from '@brewsite/core/hud/animejs';

const features = ['Feature A', 'Feature B', 'Feature C'];

function FeatureListOverlay() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useScrollTimeline((timeline) => {
    refs.current.forEach((el, i) => {
      timeline.add({
        targets: el,
        ...fadeIn({
          duration: 350,
          delay: stagger(i, { base: 100, step: 80 }),
        }),
      });
    });
  });

  return (
    <>
      {features.map((label, i) => (
        <div
          key={label}
          ref={(el) => { refs.current[i] = el; }}
          style={{ position: 'absolute', top: 40 + i * 48, left: 60 }}
        >
          {label}
        </div>
      ))}
    </>
  );
}

<Scene key="features">
  <Camera type="world" position={[0, 2, 8]} />
  <FeatureListOverlay />
</Scene>`}
      />

      <Callout type="tip">
        Combine <code>slideUp</code> + <code>fadeIn</code> options for a polished entrance effect.
        Both return plain animation property objects that can be merged before passing to{' '}
        <code>timeline.add()</code>.
      </Callout>

      <Callout type="note">
        These utilities work with the new overlay content pattern — HTML children inside{' '}
        <code>{'<Scene>'}</code>. See <Link to="/core/hud">Scene Overlay</Link> for the full
        overlay authoring guide.
      </Callout>
    </section>
  );
}
