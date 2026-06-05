#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const root = new URL('../', import.meta.url);
const areasPath = new URL('../areas.md', import.meta.url);
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

  if (domain === 'task' && action === 'add') {
    await addTask(rest.join(' ').trim());
    return;
  }

  if (domain === 'task' && action === 'done') {
    await completeTodoistTask(rest.join(' ').trim());
    return;
  }

  if (domain === 'today') {
    await showToday();
    return;
  }

  if (domain === 'todoist' && action === 'pull') {
    await pullTodoist();
    return;
  }

  if (domain === 'todoist' && action === 'list') {
    await listTodoistTasks();
    return;
  }

  if (domain === 'todoist' && action === 'projects') {
    await listTodoistProjects();
    return;
  }

  if (domain === 'todoist' && action === 'complete') {
    await completeTodoistTask(rest.join(' ').trim());
    return;
  }

  if (domain === 'todoist' && action === 'push-inbox') {
    await pushInboxToTodoist();
    return;
  }

  if (domain === 'todoist' && action === 'sync') {
    await syncTodoist();
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
  npm run lifeos -- task add "text"
  npm run lifeos -- task done "text"
  npm run lifeos -- today
  npm run lifeos -- todoist projects
  npm run lifeos -- todoist list
  npm run lifeos -- todoist pull
  npm run lifeos -- todoist push-inbox
  npm run lifeos -- todoist complete "text"
  npm run lifeos -- todoist sync
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

  await appendInboxLines([normalizeInboxLine(text)]);
  console.log(`Added to inbox: ${text}`);
}

async function addTask(text) {
  if (!text) {
    throw new Error('Usage: npm run lifeos -- task add "text"');
  }

  await addInbox(text);
  await pushInboxToTodoist();
}

async function showToday() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const [areas, inbox, tasks] = await Promise.all([
    safeRead(areasPath),
    safeRead(inboxPath),
    getTodoistTasks(token, env)
  ]);

  console.log('# Today');
  console.log('');
  console.log('## Focus');
  printFocusLines(areas);
  console.log('');
  console.log('## Todoist');

  if (tasks.length === 0) {
    console.log('- No active Todoist tasks found.');
  } else {
    for (const task of tasks) {
      console.log(`- ${task.content}`);
    }
  }

  console.log('');
  console.log('## Inbox');

  const inboxItems = parseInboxItems(inbox);

  if (inboxItems.length === 0) {
    console.log('- Inbox is empty.');
  } else {
    for (const item of inboxItems) {
      console.log(`- ${item}`);
    }
  }
}

async function pullTodoist() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const tasks = await getTodoistTasks(token, env);
  const existingInbox = await safeRead(inboxPath);
  const lines = tasks
    .filter((task) => !existingInbox.includes(task.content))
    .map((task) => normalizeInboxLine(task.content));

  if (lines.length === 0) {
    console.log('No new Todoist tasks to add to inbox.');
    return;
  }

  await appendInboxLines(lines);
  console.log(`Added ${lines.length} Todoist task(s) to inbox.`);
}

async function getTodoistTasks(token, env) {
  const tasks = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({ limit: '200' });

    if (env.TODOIST_PROJECT_ID) {
      query.set('project_id', env.TODOIST_PROJECT_ID);
    }

    if (env.TODOIST_SECTION_ID) {
      query.set('section_id', env.TODOIST_SECTION_ID);
    }

    if (cursor) {
      query.set('cursor', cursor);
    }

    const page = await todoistRequest(token, `/tasks?${query.toString()}`);
    tasks.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);

  return tasks;
}

async function listTodoistTasks() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const tasks = await getTodoistTasks(token, env);

  if (tasks.length === 0) {
    console.log('No active Todoist tasks found.');
    return;
  }

  for (const task of tasks) {
    console.log(`${task.content}\t${task.id}`);
  }
}

async function listTodoistProjects() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const projects = await getTodoistProjects(token);

  if (projects.length === 0) {
    console.log('No Todoist projects found.');
    return;
  }

  for (const project of projects) {
    console.log(`${project.name}\t${project.id}`);
  }
}

async function getTodoistProjects(token) {
  const projects = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({ limit: '200' });

    if (cursor) {
      query.set('cursor', cursor);
    }

    const page = await todoistRequest(token, `/projects?${query.toString()}`);
    projects.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);

  return projects;
}

async function pushInboxToTodoist() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const inbox = await safeRead(inboxPath);
  const items = uniqueItems(parseInboxItems(inbox));

  if (items.length === 0) {
    console.log('Inbox has no task-like items to push.');
    return;
  }

  const existingTasks = await getTodoistTasks(token, env);
  const existingTaskContents = new Set(
    existingTasks.map((task) => normalizeTaskContent(task.content))
  );
  const itemsToCreate = items.filter(
    (item) => !existingTaskContents.has(normalizeTaskContent(item))
  );

  if (itemsToCreate.length === 0) {
    console.log(`No new Todoist tasks to create. Skipped ${items.length} existing inbox item(s).`);
    return;
  }

  let created = 0;

  for (const item of itemsToCreate) {
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

  const skipped = items.length - created;
  console.log(`Created ${created} Todoist task(s) from inbox. Skipped ${skipped} existing item(s).`);
}

async function completeTodoistTask(query) {
  if (!query) {
    throw new Error('Usage: npm run lifeos -- todoist complete "text"');
  }

  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const tasks = await getTodoistTasks(token, env);
  const matches = findMatchingTasks(tasks, query);

  if (matches.length === 0) {
    throw new Error(`No active Todoist task matched: ${query}`);
  }

  if (matches.length > 1) {
    console.log('More than one task matched. Be more specific:');

    for (const task of matches) {
      console.log(`${task.content}\t${task.id}`);
    }

    process.exitCode = 1;
    return;
  }

  const [task] = matches;
  await todoistRequest(token, `/tasks/${encodeURIComponent(task.id)}/close`, {
    method: 'POST'
  });
  await removeInboxItem(task.content);
  console.log(`Completed Todoist task: ${task.content}`);
}

async function syncTodoist() {
  await pullTodoist();
  await pushInboxToTodoist();
  await run('git', ['status', '--short']);
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
  const response = await fetch(`https://api.todoist.com/api/v1${path}`, {
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

function printFocusLines(content) {
  const lines = content.split('\n');
  let currentArea = null;
  let expectingFocus = false;
  let printed = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('# ')) {
      currentArea = line.slice(2).trim();
      expectingFocus = false;
      continue;
    }

    if (line === 'Текущий фокус:') {
      expectingFocus = true;
      continue;
    }

    if (expectingFocus && line.startsWith('- ')) {
      console.log(`- ${currentArea}: ${line.slice(2).trim()}`);
      printed += 1;
      expectingFocus = false;
    }
  }

  if (printed === 0) {
    console.log('- No focus found in areas.md.');
  }
}

function uniqueItems(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = normalizeTaskContent(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function normalizeTaskContent(content) {
  return content.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findMatchingTasks(tasks, query) {
  const normalizedQuery = normalizeTaskContent(query);
  const exactMatches = tasks.filter(
    (task) => normalizeTaskContent(task.content) === normalizedQuery
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return tasks.filter((task) => normalizeTaskContent(task.content).includes(normalizedQuery));
}

function normalizeInboxLine(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.startsWith('- ') ? trimmed : `- ${trimmed}`;
}

async function appendInboxLines(lines) {
  const existing = await safeRead(inboxPath);
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  await appendFile(inboxPath, `${prefix}${lines.join('\n')}\n`, 'utf8');
}

async function removeInboxItem(text) {
  const existing = await safeRead(inboxPath);
  const target = normalizeTaskContent(text);
  const lines = existing.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();

    if (!trimmed.startsWith('- ')) {
      return true;
    }

    return normalizeTaskContent(trimmed.slice(2)) !== target;
  });

  const nextContent = filteredLines.join('\n').replace(/\n*$/, '\n');

  if (nextContent !== existing) {
    await writeFile(inboxPath, nextContent, 'utf8');
  }
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
