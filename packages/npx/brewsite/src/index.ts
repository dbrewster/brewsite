// CLI: npx brewsite <command>
// Currently supports: brewsite add <package>

import { runAdd } from './add.js';

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
} else {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error('Usage: brewsite add <package> [package...]');
  process.exit(1);
}
