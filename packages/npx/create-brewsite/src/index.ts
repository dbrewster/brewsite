// CLI: npx create-brewsite@latest
// Interactive scaffolder for new BrewSite projects.

import { intro, outro, multiselect, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { scaffoldProject } from './scaffold.js';
import type { ProjectConfig } from './types.js';

// ─── Peer dependency map ─────────────────────────────────────────────────────
// Maps each @brewsite/* package to the additional peer deps it requires
// beyond the base set (three, react, react-dom, camera-controls).
// The scaffolder installs the base set unconditionally and adds extras
// only when the corresponding package is selected.

const EXTRA_PEER_DEPS: Record<string, string[]> = {
  '@brewsite/diagram': ['troika-three-text'],
  '@brewsite/charts':  ['troika-three-text'],
};

async function main(): Promise<void> {
  intro('create-brewsite');

  // Step 1: Select optional packages
  const optionalPackages = await multiselect({
    message: 'Which BrewSite packages do you want to install?',
    options: [
      { value: '@brewsite/diagram', label: '@brewsite/diagram', hint: '3D diagrams, nodes, edges, groups' },
      { value: '@brewsite/model', label: '@brewsite/model', hint: 'GLTF model loading, labels, animations' },
      { value: '@brewsite/charts', label: '@brewsite/charts', hint: '3D bar, line, pie, scatter charts' },
      { value: '@brewsite/screens', label: '@brewsite/screens', hint: 'Media screen elements' },
      { value: '@brewsite/textures', label: '@brewsite/textures', hint: 'PBR material texture presets' },
      { value: '@brewsite/slides', label: '@brewsite/slides', hint: 'Slide deck presentations' },
      { value: '@brewsite/themes', label: '@brewsite/themes', hint: 'Theme bundles for scenes, diagrams, charts' },
    ],
    required: false,
    initialValues: ['@brewsite/diagram', '@brewsite/model'],
  });

  if (isCancel(optionalPackages)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  // Step 2: Confirm claude-author installation
  const installClaudeAuthor = await confirm({
    message: 'Install @brewsite/claude-author for AI-powered documentation in Claude Code?',
    initialValue: true,
  });

  if (isCancel(installClaudeAuthor)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  // Collect extra peer deps needed by selected packages (deduplicated).
  const selected = optionalPackages as string[];
  const extraPeerDeps = [...new Set(selected.flatMap((pkg) => EXTRA_PEER_DEPS[pkg] ?? []))];

  const config: ProjectConfig = {
    projectRoot: process.cwd(),
    packages: [
      // Base peer deps — always required by @brewsite/core
      'three', 'react', 'react-dom', 'camera-controls',
      // Core (always installed)
      '@brewsite/core',
      // Extra peer deps from selected packages
      ...extraPeerDeps,
      // Selected optional @brewsite/* packages
      ...selected,
    ],
    installClaudeAuthor: installClaudeAuthor as boolean,
  };

  const s = spinner();
  s.start('Installing packages...');
  await scaffoldProject(config);
  s.stop('Packages installed.');

  outro('BrewSite project ready! Run `pnpm dev` to start.');
}

main().catch((err) => {
  console.error('create-brewsite failed:', err);
  process.exit(1);
});
