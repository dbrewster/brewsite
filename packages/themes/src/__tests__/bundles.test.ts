import { describe, it, expect } from 'vitest';
import * as bundles from '../bundles';

describe('bundles', () => {
  const familyNames = ['darkGlass', 'midnight', 'neonCyber', 'lightCanvas', 'lightMinimal'] as const;

  for (const name of familyNames) {
    describe(name, () => {
      const bundle = bundles[name as keyof typeof bundles];

      it('has correct family name', () => {
        expect(bundle.family).toBe(name);
      });

      it('scene.dark and scene.light are valid SceneThemes', () => {
        expect(bundle.scene.dark.colorMode).toBe('dark');
        expect(bundle.scene.light.colorMode).toBe('light');
      });

      it('diagram.dark and diagram.light exist', () => {
        expect(bundle.diagram.dark).toBeDefined();
        expect(bundle.diagram.light).toBeDefined();
      });

      it('chart.dark and chart.light exist', () => {
        expect(bundle.chart.dark).toBeDefined();
        expect(bundle.chart.light).toBeDefined();
      });

      it('diagram slices have sceneTheme pre-wired (dark)', () => {
        expect(bundle.diagram.dark.sceneTheme).toBe(bundle.scene.dark);
      });

      it('diagram slices have sceneTheme pre-wired (light)', () => {
        expect(bundle.diagram.light.sceneTheme).toBe(bundle.scene.light);
      });

      it('chart slices have sceneTheme pre-wired (dark)', () => {
        expect(bundle.chart.dark.sceneTheme).toBe(bundle.scene.dark);
      });

      it('chart slices have sceneTheme pre-wired (light)', () => {
        expect(bundle.chart.light.sceneTheme).toBe(bundle.scene.light);
      });
    });
  }
});
