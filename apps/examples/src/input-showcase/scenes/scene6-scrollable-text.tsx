// Scene 6: Scrollable Text — TextBox with inner overflow:auto div.
// The left panel shows a LineChart; the right panel has a scrollable docs section.
// ctrl+scroll is reserved for 3D dolly; plain scroll goes to the textbox native scroll.
import type { JSX } from 'react';
import {
  Ambient,
  Camera,
  Directional,
  detectPlatform,
  formatModifier,
  Lighting,
  ProgressManager,
  Scene,
  TextBox,
  View,
} from '@brewsite/core';
import {
  ChartAxis,
  ChartData,
  ChartSeries,
  LineChart,
} from '@brewsite/charts';

const isMac = detectPlatform() === 'mac';

const CAM_POS: [number, number, number] = [0, 1.5, 7];
const CAM_TGT: [number, number, number] = [0, 0, 0];

const monthlyData = [
  { month: 'Jan', interactions: 1200 },
  { month: 'Feb', interactions: 1850 },
  { month: 'Mar', interactions: 2100 },
  { month: 'Apr', interactions: 1980 },
  { month: 'May', interactions: 2640 },
  { month: 'Jun', interactions: 3200 },
  { month: 'Jul', interactions: 3050 },
  { month: 'Aug', interactions: 3700 },
  { month: 'Sep', interactions: 4100 },
  { month: 'Oct', interactions: 3900 },
  { month: 'Nov', interactions: 4450 },
  { month: 'Dec', interactions: 5100 },
];

// ─── Styled text primitives ────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#a0c8ff',
  margin: '18px 0 6px',
  paddingBottom: 4,
  borderBottom: '1px solid rgba(70, 130, 220, 0.2)',
};

const bodyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(180, 210, 255, 0.75)',
  lineHeight: 1.7,
  margin: '0 0 8px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  marginBottom: 10,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  background: 'rgba(30, 60, 100, 0.5)',
  color: '#8ab4f8',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid rgba(40, 80, 140, 0.2)',
  color: 'rgba(170, 200, 255, 0.7)',
  verticalAlign: 'top',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 10,
  background: 'rgba(20, 50, 100, 0.5)',
  padding: '1px 5px',
  borderRadius: 3,
  color: '#7ad0ff',
};

export const ScrollableTextScene = (): JSX.Element => {
  return (
    <Scene id="input-scrollable-text">
      <ProgressManager scrollUnits={900} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={"50deg"} />
      <Lighting intensityScale={1}>
        <Ambient intensity={0.5} color="#d7e8ff" />
        <Directional intensity={1.2} color="#b0ccff" position={[-4, 10, 8]} />
      </Lighting>

      {/* Left: line chart */}
      <View id="st-chart-view" x={"2%"} y={"6%"} w={"45%"} h={"86%"}>
        <LineChart
          id="is-monthly-interactions"
          data={monthlyData}
          x={0} y={0} w={"100%"} h={"100%"}
          lineShape="circle"
          lineSmoothness={0.5}
          showPoints
          depth={0.3}
        >
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="interactions" label="Interactions" />
          <ChartSeries field="interactions" label="Interactions" />
        </LineChart>
      </View>

      {/* Right: scrollable documentation panel.
           pointerEvents:'auto' opts this content back in so the native scroll
           gesture reaches the DOM (the overlay container is pointer-events:none
           via passthroughPointerEvents on EngineOverlayHost). */}
      <TextBox id="st-docs" x={"49%"} y={"6%"} w={"49%"} h={"88%"} overflow="hidden" layer={2}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '20px 24px',
            background: 'rgba(4, 12, 28, 0.88)',
            backdropFilter: 'blur(16px)',
            borderRadius: 10,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ fontSize: 18, color: '#e0eaff', margin: '0 0 6px' }}>
            TextBox Scrollable Content
          </h2>
          <p style={{ ...bodyStyle, fontSize: 11, color: 'rgba(140,180,240,0.55)', marginBottom: 14 }}>
            Scroll this panel with a normal scroll gesture. {formatModifier('ctrl')}+Scroll is reserved for the 3D camera zoom.
          </p>

          {/* InputController */}
          <h3 style={sectionStyle}>InputController — The Root Container</h3>
          <p style={bodyStyle}>
            <code style={codeStyle}>InputController</code> is the outermost DSL block that declares how a scene responds
            to pointer, wheel, pinch, and keyboard input. It contains one or more <code style={codeStyle}>Action</code> children,
            each of which has one or more input map children.
          </p>
          <p style={bodyStyle}>
            The <code style={codeStyle}>scope</code> prop controls where event listeners are attached. Use
            <code style={codeStyle}> scope="canvas"</code> to restrict input to the canvas bounding box, or
            <code style={codeStyle}> scope="window"</code> to capture input anywhere in the browser window.
          </p>

          {/* PointerMap */}
          <h3 style={sectionStyle}>PointerMap — Mouse &amp; Touch</h3>
          <p style={bodyStyle}>
            Responds to pointer events: dragging (mousemove while pressed) or clicking (mouseup without movement).
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Prop</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['event', '"drag" | "click"', 'Trigger type. Default: "drag"'],
                ['button', '"left" | "right" | "middle"', 'Mouse button filter. Default: "left"'],
                ['modifiers', 'ModifierKey[]', 'Required modifier keys (alt, ctrl, meta, shift)'],
                ['axis', '"x" | "y" | "xy"', 'Restrict drag axis. Default: "xy"'],
                ['lockAxis', '"sticky" | "free"', 'Axis lock behaviour for drag'],
              ].map(([prop, type, desc]) => (
                <tr key={prop}>
                  <td style={tdStyle}><code style={codeStyle}>{prop}</code></td>
                  <td style={tdStyle}><span style={{ color: '#7ad0ff', fontSize: 10 }}>{type}</span></td>
                  <td style={tdStyle}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* WheelMap */}
          <h3 style={sectionStyle}>WheelMap — Scroll Wheel &amp; Trackpad</h3>
          <p style={bodyStyle}>
            Responds to the wheel event (mouse scroll wheel or trackpad two-finger swipe). Modifier keys allow
            separate bindings for plain scroll vs {formatModifier('ctrl')}+scroll.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Prop</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['modifiers', 'ModifierKey[]', `Required modifier keys (e.g. ["ctrl"] for ${formatModifier('ctrl')}+scroll)`],
                ['axis', '"x" | "y" | "xy"', 'Scroll axis. Default: "y"'],
                ['lockAxis', '"sticky" | "free"', 'Axis lock behaviour'],
              ].map(([prop, type, desc]) => (
                <tr key={prop}>
                  <td style={tdStyle}><code style={codeStyle}>{prop}</code></td>
                  <td style={tdStyle}><span style={{ color: '#7ad0ff', fontSize: 10 }}>{type}</span></td>
                  <td style={tdStyle}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PinchMap */}
          <h3 style={sectionStyle}>PinchMap — Pinch Gesture</h3>
          <p style={bodyStyle}>
            Responds to two-finger pinch gestures on trackpads and touch screens. Use <code style={codeStyle}>direction</code> to
            restrict to pinch-in, pinch-out, or both.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Prop</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['direction', '"in" | "out" | "both"', 'Which pinch direction to capture. Default: "both"'],
                ['threshold', 'number', 'Minimum delta before firing. Default: 1'],
                ['modifiers', 'ModifierKey[]', 'Required modifier keys'],
              ].map(([prop, type, desc]) => (
                <tr key={prop}>
                  <td style={tdStyle}><code style={codeStyle}>{prop}</code></td>
                  <td style={tdStyle}><span style={{ color: '#7ad0ff', fontSize: 10 }}>{type}</span></td>
                  <td style={tdStyle}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* KeyMap */}
          <h3 style={sectionStyle}>KeyMap — Keyboard Input</h3>
          <p style={bodyStyle}>
            Fires when a key is pressed. The <code style={codeStyle}>keyName</code> prop maps to
            <code style={codeStyle}> KeyboardEvent.key</code> (e.g. <code style={codeStyle}>"ArrowRight"</code>,
            <code style={codeStyle}> "r"</code>, <code style={codeStyle}>" "</code> for Space).
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Prop</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['keyName', 'string', 'KeyboardEvent.key value (required)'],
                ['modifiers', 'ModifierKey[]', 'Required modifier keys (alt, ctrl, meta, shift)'],
              ].map(([prop, type, desc]) => (
                <tr key={prop}>
                  <td style={tdStyle}><code style={codeStyle}>{prop}</code></td>
                  <td style={tdStyle}><span style={{ color: '#7ad0ff', fontSize: 10 }}>{type}</span></td>
                  <td style={tdStyle}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Scope */}
          <h3 style={sectionStyle}>scope: 'canvas' vs 'window'</h3>
          <p style={bodyStyle}>
            <strong style={{ color: '#c8deff' }}>scope="canvas"</strong> (default): Input events are captured only
            when the pointer is inside the canvas element. This is appropriate for most scenes where the 3D canvas
            occupies a portion of the viewport.
          </p>
          <p style={bodyStyle}>
            <strong style={{ color: '#c8deff' }}>scope="window"</strong>: Input events are captured anywhere in the
            browser window. This is useful for immersive fullscreen scenes where the canvas fills the entire viewport,
            or when you want orbit drag to continue even when the cursor exits the canvas boundary.
          </p>

          {/* Modifier Keys */}
          <h3 style={sectionStyle}>Modifier Keys</h3>
          <p style={bodyStyle}>
            All four standard modifier keys are supported and can be combined in the <code style={codeStyle}>modifiers</code> array:
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20, ...bodyStyle }}>
            <li><code style={codeStyle}>"alt"</code> — {formatModifier('alt')} {isMac ? '' : '(Option on macOS)'}</li>
            <li><code style={codeStyle}>"ctrl"</code> — {formatModifier('ctrl')} {isMac ? '(Control)' : ''}</li>
            <li><code style={codeStyle}>"meta"</code> — {formatModifier('meta')} {isMac ? '(Command)' : '(Windows key on Windows)'}</li>
            <li><code style={codeStyle}>"shift"</code> — {formatModifier('shift')}</li>
          </ul>
          <p style={bodyStyle}>
            Multiple modifiers in the array must all be held simultaneously. Example:
            <code style={codeStyle}>{' modifiers={["ctrl", "shift"]}'}</code> requires both {formatModifier('ctrl')} and {formatModifier('shift')}.
          </p>

          {/* Action Types */}
          <h3 style={sectionStyle}>Action Types</h3>
          <p style={bodyStyle}>
            The <code style={codeStyle}>type</code> prop on <code style={codeStyle}>Action</code> determines
            what the engine does when the input fires:
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20, ...bodyStyle }}>
            <li><code style={codeStyle}>"camera.orbit"</code> — Rotates the camera around its target</li>
            <li><code style={codeStyle}>"camera.zoom"</code> — Moves the camera toward or away from the target</li>
            <li><code style={codeStyle}>"camera.reset"</code> — Resets the camera to its scene-declared position</li>
            <li><code style={codeStyle}>"scene.next"</code> — Advances to the next scene. Use <code style={codeStyle}>stepScenes</code> to skip multiple.</li>
            <li><code style={codeStyle}>"scene.prev"</code> — Goes to the previous scene. Use <code style={codeStyle}>stepScenes</code> to jump back.</li>
            <li><code style={codeStyle}>"carousel.next"</code> — Advances the active index in a ViewLayout carousel. Requires <code style={codeStyle}>layoutId</code>.</li>
            <li><code style={codeStyle}>"carousel.prev"</code> — Decrements the active index in a ViewLayout carousel. Requires <code style={codeStyle}>layoutId</code>.</li>
            <li><code style={codeStyle}>"camera.pan"</code> — Pans the camera in 2D</li>
          </ul>

          {/* Footer */}
          <div
            style={{
              marginTop: 16,
              padding: '10px 12px',
              background: 'rgba(80, 144, 224, 0.08)',
              borderRadius: 6,
              border: '1px solid rgba(80, 144, 224, 0.2)',
              fontSize: 10,
              color: 'rgba(140, 180, 240, 0.6)',
              lineHeight: 1.6,
            }}
          >
            Tip: In this scene, normal scroll goes to this text panel (OS-native scroll). {formatModifier('ctrl')}+Scroll zooms the 3D
            camera. This is configured by binding <code style={codeStyle}>WheelMap modifiers={["ctrl"]}</code> to
            <code style={codeStyle}> camera.zoom</code> and leaving plain scroll unbound (allowing it to reach the DOM).
          </div>
        </div>
      </TextBox>
    </Scene>
  );
};
