import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import InputActionsDemo, { CODE as ACTIONS_CODE } from '../../demos/core/InputActionsDemo.demo';

export default function Actions(): JSX.Element {
  return (
    <section>
      <h1>Input Actions</h1>

      <p>
        The action input system maps user gestures (pointer drag, mouse wheel, pinch) to named
        semantic actions. Built-in actions include camera orbit, dolly (zoom), pan, and reset.
      </p>

      <LiveDemo title="Orbit and dolly on the demo canvas" code={ACTIONS_CODE}>
        <InputActionsDemo />
      </LiveDemo>

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
          {
            name: 'type',
            type: 'string',
            required: true,
            description:
              'Semantic action name. See Built-in Action Types below for available values.',
          },
          {
            name: 'pointer',
            type: 'PointerMap',
            required: false,
            defaultValue: '—',
            description: 'Bind this action to a pointer (mouse/stylus) gesture',
          },
          {
            name: 'touch',
            type: 'TouchMap',
            required: false,
            defaultValue: '—',
            description: 'Bind this action to a touch gesture',
          },
          {
            name: 'wheel',
            type: 'WheelMap',
            required: false,
            defaultValue: '—',
            description: 'Bind this action to mouse wheel input',
          },
          {
            name: 'key',
            type: 'KeyMap',
            required: false,
            defaultValue: '—',
            description: 'Bind this action to a keyboard key',
          },
        ]}
      />

      <h2>Built-in Action Types</h2>

      <PropTable
        rows={[
          {
            name: 'camera.orbit',
            type: 'built-in',
            description: 'Rotate the camera around its target',
          },
          {
            name: 'camera.dolly',
            type: 'built-in',
            description: 'Zoom in/out (move camera along look vector)',
          },
          {
            name: 'camera.reset',
            type: 'built-in',
            description: 'Reset camera to its DSL-defined position',
          },
          {
            name: 'camera.pan',
            type: 'built-in',
            description: 'Strafe the camera laterally',
          },
          {
            name: 'canvas.focus',
            type: 'built-in',
            description: 'Click to focus camera on a clicked object',
          },
        ]}
      />

      <h2>Gesture Maps</h2>

      <p>
        <strong>PointerMap</strong> — bind to mouse/stylus gestures:
      </p>

      <PropTable
        rows={[
          {
            name: 'button',
            type: '0 | 1 | 2',
            required: false,
            defaultValue: '—',
            description: 'Mouse button: 0 = left, 1 = middle, 2 = right',
          },
          {
            name: 'drag',
            type: 'boolean',
            required: false,
            defaultValue: '—',
            description: 'Whether the pointer must be dragged (held and moved) to trigger',
          },
          {
            name: 'click',
            type: 'boolean',
            required: false,
            defaultValue: '—',
            description: 'Whether a single click triggers the action',
          },
        ]}
      />

      <p>
        <strong>WheelMap</strong> — bind to mouse wheel:
      </p>

      <PropTable
        rows={[
          {
            name: 'enabled',
            type: 'boolean',
            required: false,
            defaultValue: '—',
            description: 'Whether the wheel triggers this action',
          },
          {
            name: 'sensitivity',
            type: 'number',
            required: false,
            defaultValue: '—',
            description: 'Multiplier applied to the raw wheel delta',
          },
        ]}
      />

      <h2>wheelGuard</h2>

      <p>
        When a <code>ScenePlayer</code> uses scroll for scene navigation and{' '}
        <code>InputController</code> needs wheel for dolly, <code>wheelGuard</code> prevents
        conflicts:
      </p>

      <CodeBlock
        language="tsx"
        code={`<Action type="camera.dolly" wheel={{ enabled: true, guard: true }} />`}
      />

      <Callout type="tip">
        Use <code>guard: true</code> on wheel actions whenever the page also uses scroll-driven
        scene navigation.
      </Callout>
    </section>
  );
}
