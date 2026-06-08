#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);

main();

function main() {
  const json = readInputJson();

  if (!json.trim()) {
    fail('Usage: node scripts/lifeos-health-from-shortcut.mjs --base64 "<base64-json>"');
  }

  JSON.parse(json);

  run('node', ['scripts/lifeos.mjs', 'health', 'add-json', json]);
  run('node', ['scripts/lifeos.mjs', 'obsidian', 'sync']);
  run('node', ['scripts/lifeos.mjs', 'save', 'Update health snapshot']);
}

function readInputJson() {
  const base64Index = args.indexOf('--base64');

  if (base64Index !== -1) {
    const value = args[base64Index + 1] || '';
    return Buffer.from(value, 'base64').toString('utf8');
  }

  return args.join(' ').trim();
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: [
        '/Users/grachev90/.nvm/versions/node/v24.14.0/bin',
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin'
      ].join(':')
    }
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

