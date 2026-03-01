import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import { NeonSignWidget } from './widgets/neon-sign';

export const createWidgetSetup = (manifest: AssetManifest) =>
  createDefaultWidgetRegistry(manifest).register(new NeonSignWidget());
