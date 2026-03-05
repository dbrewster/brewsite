import type { ReactElement } from 'react';
import { Section, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function ApiReferencePage(): ReactElement {
  return (
    <Section<SectionId> id="api-reference" title="API Reference">
      <p>
        Full TypeScript API documentation for <code>@brewsite/core</code>, organized by module.
        All public interfaces, types, and functions are documented with TSDoc annotations in source.
      </p>

      <Callout type="note">
        The interactive API reference is generated from source TSDoc annotations. The sections
        below provide a manual summary of the full public surface.
      </Callout>

      <h2>DSL Components</h2>
      <p>
        Imported from <code>@brewsite/core</code>. All DSL components return <code>null</code>{' '}
        — they register state with the compiler via <code>registerNode</code> and have no
        runtime render output of their own.
      </p>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Import</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>&lt;Scene&gt;</code></td><td>@brewsite/core</td><td>Scene keyframe container.</td></tr>
          <tr><td><code>&lt;Camera&gt;</code></td><td>@brewsite/core</td><td>Camera position and lens configuration. See <a href="#camera">Camera Element</a>.</td></tr>
          <tr><td><code>&lt;Lighting&gt;</code></td><td>@brewsite/core</td><td>Scene lighting container. See <a href="#lighting">Lighting Element</a>.</td></tr>
          <tr><td><code>&lt;Background&gt;</code></td><td>@brewsite/core</td><td>Scene background color. See <a href="#background">Background Element</a>.</td></tr>
          <tr><td><code>&lt;Floor&gt;</code></td><td>@brewsite/core</td><td>Reflective ground plane. See <a href="#floor">Floor Element</a>.</td></tr>
          <tr><td><code>&lt;Environment&gt;</code></td><td>@brewsite/core</td><td>HDR environment map. See <a href="#environment">Environment Element</a>.</td></tr>
          <tr><td><code>&lt;Model&gt;</code></td><td>@brewsite/core</td><td>GLTF model element. See <a href="#model">Model Element</a>.</td></tr>
          <tr><td><code>&lt;Hud&gt;</code></td><td>@brewsite/core</td><td>HUD overlay container. See <a href="#hud">HUD System</a>.</td></tr>
          <tr><td><code>&lt;HudItem&gt;</code></td><td>@brewsite/core</td><td>Individual HUD overlay item. See <a href="#hud">HUD System</a>.</td></tr>
          <tr><td><code>&lt;InputController&gt;</code></td><td>@brewsite/core</td><td>Action input container. See <a href="#input-actions">Actions</a>.</td></tr>
          <tr><td><code>&lt;Action&gt;</code></td><td>@brewsite/core</td><td>Single input action mapping. See <a href="#input-actions">Actions</a>.</td></tr>
        </tbody>
      </table>

      <h2>Player &amp; Hooks</h2>
      <table className="prop-table">
        <thead>
          <tr><th>Export</th><th>Signature</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>ScenePlayer</code></td><td><code>React.FC&lt;ScenePlayerProps&gt;</code></td><td>Root player component. See <a href="#player">ScenePlayer</a>.</td></tr>
          <tr><td><code>EngineScrollRegion</code></td><td><code>React.FC</code></td><td>Scroll-aware container that maps document scroll position to scene progress.</td></tr>
          <tr><td><code>EngineInputRegion</code></td><td><code>React.FC</code></td><td>Pointer/keyboard event capture region.</td></tr>
          <tr><td><code>useSceneEngine</code></td><td><code>() =&gt; SceneEngine</code></td><td>Access the engine imperatively.</td></tr>
          <tr><td><code>useCurrentScene</code></td><td><code>() =&gt; {'{'}id: string; index: number{'}'}</code></td><td>Returns the active scene key and zero-based index.</td></tr>
          <tr><td><code>useSceneProgress</code></td><td><code>() =&gt; number</code></td><td>Returns playback progress within the current scene [0, 1].</td></tr>
          <tr><td><code>useVariable&lt;T&gt;</code></td><td><code>(ns: string, key: string) =&gt; T | undefined</code></td><td>Subscribe to a VariableStore value. See <a href="#variable-store">VariableStore</a>.</td></tr>
          <tr><td><code>createDefaultWidgetRegistry</code></td><td><code>(manifest) =&gt; WidgetRegistry</code></td><td>Creates a registry with all built-in widgets. See <a href="#widget-registry">WidgetRegistry</a>.</td></tr>
        </tbody>
      </table>

      <h2>Widget SDK</h2>
      <table className="prop-table">
        <thead>
          <tr><th>Interface / Symbol</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>IWidget</code></td><td>Base interface. Requires <code>widgetId</code>, <code>initialize</code>, <code>dispose</code>.</td></tr>
          <tr><td><code>ISceneElement</code></td><td>DSL compilation. Requires <code>compileNode</code>, <code>buildTransitionSpec</code>.</td></tr>
          <tr><td><code>IRenderable</code></td><td>Three.js rendering. Requires <code>apply(state, ctx)</code>.</td></tr>
          <tr><td><code>ILoadable</code></td><td>Async asset loading. Requires <code>load(ctx)</code>, <code>assetsReady</code>.</td></tr>
          <tr><td><code>IAnimationController</code></td><td>Per-frame updates. Requires <code>onTick(dt, variables)</code>.</td></tr>
          <tr><td><code>IVariableProvider</code></td><td>Publishes variables to the store. Requires <code>getVariables()</code>.</td></tr>
          <tr><td><code>CUSTOM_NODE_HANDLER</code></td><td>Symbol used to register a custom nested DSL handler.</td></tr>
        </tbody>
      </table>
    </Section>
  );
}
