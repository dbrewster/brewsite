import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';

export const createWidgetSetup = (manifest: AssetManifest | null) =>
  createDefaultWidgetRegistry(manifest);
