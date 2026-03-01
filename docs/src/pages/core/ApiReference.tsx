import { JSX } from 'react';
import { Link } from 'react-router';
import { Callout } from '../../components/ui/Callout';

export default function ApiReference(): JSX.Element {
  return (
    <section>
      <h1>API Reference</h1>

      <p>
        Full TypeScript API documentation for <code>@brewsite/core</code>, organized by module.
        All public interfaces, types, and functions are documented with TSDoc annotations in
        source.
      </p>

      <Callout type="note">
        The interactive API reference is generated from source TSDoc annotations. The sections
        below provide a manual summary of the full public surface. Use them as a quick lookup
        while the auto-generated TypeDoc reference is being integrated.
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
          <tr>
            <td><code>&lt;Scene&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Scene keyframe container. The <code>key</code> prop is required and becomes the
              scene identifier.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Camera&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Camera position and lens configuration. Supports{' '}
              <code>world</code>, <code>orbit</code>, <code>fitBotHeight</code>, and{' '}
              <code>fitFloorDepth</code> modes. See{' '}
              <Link to="/core/camera">Camera Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Lighting&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Scene lighting container. Contains <code>&lt;Ambient&gt;</code>,{' '}
              <code>&lt;Directional&gt;</code>, <code>&lt;Point&gt;</code>, and{' '}
              <code>&lt;Spot&gt;</code> child components. See{' '}
              <Link to="/core/lighting">Lighting Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Background&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Scene background color. Accepts a CSS color string. See{' '}
              <Link to="/core/background">Background Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Floor&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Reflective ground plane. Contains <code>&lt;FloorPhysical&gt;</code> for PBR
              surface properties. See{' '}
              <Link to="/core/floor">Floor Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Environment&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              HDR environment map for image-based lighting. See{' '}
              <Link to="/core/environment">Environment Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Model&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              GLTF model element with animation playback. Requires a <code>type</code> prop
              matching a registered model key. See{' '}
              <Link to="/core/model">Model Element</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Hud&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              HUD overlay container. Holds <code>&lt;HudItem&gt;</code> children. See{' '}
              <Link to="/core/hud">HUD System</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;HudItem&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Individual HUD overlay item with Anime.js transition spec. See{' '}
              <Link to="/core/hud">HUD System</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;InputController&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Action input container. Holds <code>&lt;Action&gt;</code> children for input
              mapping. See <Link to="/core/input-actions">Actions</Link>.
            </td>
          </tr>
          <tr>
            <td><code>&lt;Action&gt;</code></td>
            <td>@brewsite/core</td>
            <td>
              Single input action mapping (keyboard shortcut, pointer event, etc.). See{' '}
              <Link to="/core/input-actions">Actions</Link>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Player &amp; Hooks</h2>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Export</th>
            <th>Signature</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>ScenePlayer</code></td>
            <td><code>React.FC&lt;ScenePlayerProps&gt;</code></td>
            <td>
              Root player component. Mounts the Three.js canvas and drives the render loop.
              See <Link to="/core/player">ScenePlayer</Link>.
            </td>
          </tr>
          <tr>
            <td><code>EngineScrollRegion</code></td>
            <td><code>React.FC&lt;EngineScrollRegionProps&gt;</code></td>
            <td>
              Scroll-aware container that maps document scroll position to scene progress.
            </td>
          </tr>
          <tr>
            <td><code>EngineInputRegion</code></td>
            <td><code>React.FC&lt;EngineInputRegionProps&gt;</code></td>
            <td>
              Pointer/keyboard event capture region for action-mapped input.
            </td>
          </tr>
          <tr>
            <td><code>useSceneEngine</code></td>
            <td><code>() =&gt; SceneEngine</code></td>
            <td>
              Access the engine imperatively — jump to a scene, set progress, read state.
            </td>
          </tr>
          <tr>
            <td><code>useEngineScroll</code></td>
            <td><code>() =&gt; EngineScrollHandle</code></td>
            <td>Programmatic scroll control for the <code>EngineScrollRegion</code>.</td>
          </tr>
          <tr>
            <td><code>useCurrentScene</code></td>
            <td><code>() =&gt; {'{'}id: string; index: number{'}'}</code></td>
            <td>Returns the active scene key and zero-based index.</td>
          </tr>
          <tr>
            <td><code>useSceneProgress</code></td>
            <td><code>() =&gt; number</code></td>
            <td>
              Returns playback progress within the current scene in the range [0, 1].
            </td>
          </tr>
          <tr>
            <td><code>useVariable&lt;T&gt;</code></td>
            <td><code>(ns: string, key: string) =&gt; T | undefined</code></td>
            <td>
              Subscribe to a VariableStore value. Re-renders on change.
              See <Link to="/core/variable-store">VariableStore</Link>.
            </td>
          </tr>
          <tr>
            <td><code>LabelPositioner</code></td>
            <td><code>React.FC&lt;LabelPositionerProps&gt;</code></td>
            <td>
              Projects a 3D world position to screen coordinates and renders children there.
              See <Link to="/core/labels">Label System</Link>.
            </td>
          </tr>
          <tr>
            <td><code>createDefaultWidgetRegistry</code></td>
            <td><code>(manifest: AssetManifest | null) =&gt; WidgetRegistry</code></td>
            <td>
              Creates a registry with all built-in widgets pre-registered.
              See <Link to="/core/widget-registry">WidgetRegistry</Link>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Widget SDK</h2>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Interface / Symbol</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>IWidget</code></td>
            <td>Base interface. Requires <code>widgetId</code>, <code>initialize</code>, <code>dispose</code>.</td>
          </tr>
          <tr>
            <td><code>ISceneElement</code></td>
            <td>DSL compilation. Requires <code>compileNode</code>, <code>buildTransitionSpec</code>.</td>
          </tr>
          <tr>
            <td><code>IRenderable</code></td>
            <td>Three.js rendering. Requires <code>apply(state, ctx)</code>.</td>
          </tr>
          <tr>
            <td><code>ILoadable</code></td>
            <td>Async asset loading. Requires <code>load(ctx)</code>, <code>assetsReady</code>.</td>
          </tr>
          <tr>
            <td><code>IAnimationController</code></td>
            <td>Per-frame updates. Requires <code>onTick(dt, variables)</code>.</td>
          </tr>
          <tr>
            <td><code>IVariableProvider</code></td>
            <td>Publishes variables to the store. Requires <code>getVariables()</code>.</td>
          </tr>
          <tr>
            <td><code>IDslComposite</code></td>
            <td>Custom nested DSL handling. Requires <code>[CUSTOM_NODE_HANDLER]</code>.</td>
          </tr>
          <tr>
            <td><code>IContainedModel</code></td>
            <td>Attaches to a parent model's bone/socket. Requires <code>anchorModelId</code>, <code>anchorKey</code>.</td>
          </tr>
          <tr>
            <td><code>CUSTOM_NODE_HANDLER</code></td>
            <td>Symbol used to register a custom nested DSL handler on a composite widget.</td>
          </tr>
          <tr>
            <td><code>isSceneElement(w)</code></td>
            <td>Type guard — true if widget implements <code>ISceneElement</code>.</td>
          </tr>
          <tr>
            <td><code>isRenderable(w)</code></td>
            <td>Type guard — true if widget implements <code>IRenderable</code>.</td>
          </tr>
          <tr>
            <td><code>isLoadable(w)</code></td>
            <td>Type guard — true if widget implements <code>ILoadable</code>.</td>
          </tr>
        </tbody>
      </table>

      <h2>Compiler &amp; Timeline Utilities</h2>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Export</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>createSceneTimeline</code></td>
            <td>
              Create a <code>SceneTimeline</code> for a given scene count and quality options.
              See <Link to="/core/timeline">Timeline &amp; Math</Link>.
            </td>
          </tr>
          <tr>
            <td><code>blendNumber</code></td>
            <td>Linear interpolation between two numbers.</td>
          </tr>
          <tr>
            <td><code>blendColor</code></td>
            <td>CSS color interpolation via LAB color space for perceptually smooth transitions.</td>
          </tr>
          <tr>
            <td><code>blendOpacity</code></td>
            <td>Opacity interpolation, clamped to [0, 1].</td>
          </tr>
          <tr>
            <td><code>blendVec3</code></td>
            <td>Three.js Vector3 linear interpolation.</td>
          </tr>
          <tr>
            <td><code>ElementTransitionSpec&lt;T&gt;</code></td>
            <td>
              Type for the per-field blend spec you return from{' '}
              <code>ISceneElement.buildTransitionSpec()</code>.
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
