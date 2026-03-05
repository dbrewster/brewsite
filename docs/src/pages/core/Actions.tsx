import type { ReactElement } from 'react';
import { Section, CodeBlock, PropTable, Callout, DocsDemo } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { InputActionsDemo } from '../../demos/core/InputActionsDemo.demo';

export function ActionsPage(): ReactElement {
  return (
    <Section<SectionId> id="input-actions" title="Input Actions">
      <p>
        The action input system maps user gestures (pointer drag, mouse wheel, pinch) to named
        semantic actions. Built-in actions include camera orbit, dolly (zoom), pan, and reset.
      </p>

      <DocsDemo title="Orbit and dolly on the demo canvas" scrollUnits={2400} height={480}>
        <InputActionsDemo />
      </DocsDemo>

      <h2><code>InputController</code> and <code>Action</code> DSL</h2>

      <CodeBlock
        language="tsx"
        code={`<InputController>
  <Action
    type="camera.orbit"
    pointer={{ button: 0, drag: true }}
    touch={{ fingers: 1, drag: true }}
  />
  <Action
    type="camera.dolly"
    wheel={{ enabled: true }}
    touch={{ fingers: 2, pinch: true }}
  />
  <Action
    type="camera.reset"
    pointer={{ button: 1 }}
    key={{ code: 'KeyR' }}
  />
</InputController>`}
      />

      <PropTable
        rows={[
          { name: 'type', type: 'string', required: true, description: 'Semantic action name.' },
          { name: 'pointer', type: 'PointerMap', required: false, defaultValue: '—', description: 'Bind this action to a pointer (mouse/stylus) gesture' },
          { name: 'touch', type: 'TouchMap', required: false, defaultValue: '—', description: 'Bind this action to a touch gesture' },
          { name: 'wheel', type: 'WheelMap', required: false, defaultValue: '—', description: 'Bind this action to mouse wheel input' },
          { name: 'key', type: 'KeyMap', required: false, defaultValue: '—', description: 'Bind this action to a keyboard key' },
        ]}
      />

      <h2>Built-in Action Types</h2>
      <PropTable
        rows={[
          { name: 'camera.orbit', type: 'built-in', description: 'Rotate the camera around its target' },
          { name: 'camera.dolly', type: 'built-in', description: 'Zoom in/out' },
          { name: 'camera.reset', type: 'built-in', description: 'Reset camera to its DSL-defined position' },
          { name: 'camera.pan', type: 'built-in', description: 'Strafe the camera laterally' },
          { name: 'canvas.focus', type: 'built-in', description: 'Click to focus camera on a clicked object' },
        ]}
      />

      <Callout type="tip">
        Use <code>guard: true</code> on wheel actions whenever the page also uses scroll-driven
        scene navigation.
      </Callout>
    </Section>
  );
}
