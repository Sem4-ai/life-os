#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const root = new URL('../', import.meta.url);
const inboxPath = new URL('../inbox.md', import.meta.url);
const envPath = new URL('../.env', import.meta.url);

const args = process.argv.slice(2);

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const [domain, action, ...rest] = args;

  if (!domain || domain === 'help' || domain === '--help' || domain === '-h') {
    printHelp();
    return;
  }

  if (domain === 'inbox' && action === 'add') {
    await addInbox(rest.join(' ').trim());
    return;
  }

  if (domain === 'todoist' && action === 'pull') {
    await pullTodoist();
    return;
  }

  if (domain === 'todoist' && action === 'push-inbox') {
    await pushInboxToTodoist();
    return;
  }

  if (domain === 'git' && action === 'sync') {
    await gitSync();
    return;
  }

  throw new Error(`Unknown command: ${args.join(' ')}`);
}

function printHelp() {
  console.log(`
Life OS CLI

Commands:
  npm run lifeos -- inbox add "text"
  npm run lifeos -- todoist pull
  npm run lifeos -- todoist push-inbox
  npm run lifeos -- git sync

Environment:
  Copy .env.example to .env and fill TODOIST_API_TOKEN.
  TODOIST_PROJECT_ID and TODOIST_SECTION_ID are optional.
`);
}

async function addInbox(text) {
  if (!text) {
    throw new Error('Usage: npm run lifeos -- inbox add "text"');
  }

  await appendFile(inboxPath, `${normalizeInboxLine(text)}\n`, 'utf8');
  console.log(`Added to inbox: ${text}`);
}

async function pullTodoist() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const query = new URLSearchParams();

  if (env.TODOIST_PROJECT_ID) {
    query.set('project_id', env.TODOIST_PROJECT_ID);
  }

  if (env.TODOIST_SECTION_ID) {
    query.set('section_id', env.TODOIST_SECTION_ID);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const tasks = await todoistRequest(token, `/tasks${suffix}`);
  const existingInbox = await safeRead(inboxPath);
  const lines = tasks
    .filter((task) => !existingInbox.includes(task.content))
    .map((task) => normalizeInboxLine(task.content));

  if (lines.length === 0) {
    console.log('No new Todoist tasks to add to inbox.');
    return;
  }

  await appendFile(inboxPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Added ${lines.length} Todoist task(s) to inbox.`);
}

async function pushInboxToTodoist() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const inbox = await safeRead(inboxPath);
  const items = parseInboxItems(inbox);

  if (items.length === 0) {
    console.log('Inbox has no task-like items to push.');
    return;
  }

  let created = 0;

  for (const item of items) {
    await todoistRequest(token, '/tasks', {
      method: 'POST',
      body: {
        content: item,
        project_id: env.TODOIST_PROJECT_ID || undefined,
        section_id: env.TODOIST_SECTION_ID || undefined
      }
    });
    created += 1;
  }

  console.log(`Created ${created} Todoist task(s) from inbox.`);
}

async function gitSync() {
  await run('git', ['pull', '--ff-only']);
  await run('git', ['status', '--short']);
  console.log('Review changes, then commit with git when ready.');
}

async function loadEnv() {
  const env = { ...process.env };

  if (!existsSync(envPath)) {
    return env;
  }

  const content = await readFile(envPath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    env[key] = value.replace(/^["']|["']$/g, '');
  }

  return env;
}

function requireEnv(env, key) {
  if (!env[key]) {
    throw new Error(`${key} is missing. Copy .env.example to .env and fill it.`);
  }

  return env[key];
}

async function todoistRequest(token, path, options = {}) {
  const response = await fetch(`https://api.todoist.com/rest/v2${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(removeUndefined(options.body)) : undefined
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Todoist API error ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function parseInboxItems(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function normalizeInboxLine(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.startsWith('- ') ? trimmed : `- ${trimmed}`;
}

async function safeRead(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} failed with ${code}`));
      }
    });
  });
}
