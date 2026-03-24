// CLI: npx brewsite <command>
// Supports: brewsite add <package>, brewsite copy-assets [--dest <dir>]

import { runAdd } from './add.js';
import { runCopyAssets } from './copyAssets.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'add') {
  const packages = args.slice(1);
  if (packages.length === 0) {
    console.error('Usage: brewsite add <package> [package...]');
    console.error('');
    console.error('Available packages:');
    console.error('  core           @brewsite/core (always required)');
    console.error('  diagram        @brewsite/diagram');
    console.error('  model          @brewsite/model');
    console.error('  charts         @brewsite/charts');
    console.error('  screens        @brewsite/screens');
    console.error('  claude-author  @brewsite/claude-author');
    process.exit(1);
  }
  await runAdd(packages);
} else if (command === 'copy-assets') {
  runCopyAssets(args.slice(1));
} else {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error('Usage:');
  console.error('  brewsite add <package> [package...]');
  console.error('  brewsite copy-assets [--dest <dir>]');
  process.exit(1);
}
