import { JSX } from 'react';

export default function ModelIntroduction(): JSX.Element {
  return (
    <section>
      <h1>@brewsite/model</h1>
      <p>
        <code>@brewsite/model</code> is a separate package that provides GLTF/GLB model
        loading, animation playback, bone-tracked label positioning, and 3D label rendering
        on top of <code>@brewsite/core</code>.
      </p>
      <p>
        Full documentation is coming soon. The <strong>Model Element</strong> and{' '}
        <strong>Label System</strong> pages below contain reference docs that have been
        migrated from the core package.
      </p>
    </section>
  );
}
