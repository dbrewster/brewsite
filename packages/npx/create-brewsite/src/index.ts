#!/usr/bin/env node
// CLI: npx create-brewsite@latest
// Interactive scaffolder for new BrewSite projects.

import { intro, outro, multiselect, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { scaffoldProject } from './scaffold.js';
import type { ProjectConfig } from './types.js';

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

  const config: ProjectConfig = {
    projectRoot: process.cwd(),
    packages: ['@brewsite/core', 'camera-controls', ...(optionalPackages as string[])],
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
