# @brewsite/screens

3D screen, media screen, and image panel elements for BrewSite scenes.

## Installation

```bash
pnpm add @brewsite/screens @brewsite/core react react-dom three
```

## Setup

Add `screensPlugin()` to your `SceneEngine` plugins:

```tsx
import { SceneEngine } from '@brewsite/core/player';
import { screensPlugin } from '@brewsite/screens';

<SceneEngine plugins={[screensPlugin()]} getFrame={() => <MyScene />}>
  {/* ... */}
</SceneEngine>
```

## Elements

### Screen

```tsx
import { Screen } from '@brewsite/screens';

<Screen id="demo-screen" width={1.6} height={0.9} bezel="rounded" />
```

### MediaScreen

```tsx
import { MediaScreen } from '@brewsite/screens';

<MediaScreen id="video" width={1.6} height={0.9} source="webcam" />
```

### ImagePanel

```tsx
import { ImagePanel } from '@brewsite/screens';

<ImagePanel id="hero-image" src="/images/hero.png" width={2} height={1.2} bezel="glass" />
```

## API

See the [full documentation](https://brewsite.dev/docs/screens) for complete API reference.
