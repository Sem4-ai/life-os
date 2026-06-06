#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const root = new URL('../', import.meta.url);
const areasPath = new URL('../areas.md', import.meta.url);
const inboxPath = new URL('../inbox.md', import.meta.url);
const projectsPath = new URL('../projects.md', import.meta.url);
const envPath = new URL('../.env', import.meta.url);
const userId = '501';
const launchAgentDir = '/Users/grachev90/Library/LaunchAgents';
const serverAgents = [
  {
    label: 'com.lifeos.todoist-sync',
    plist: `${launchAgentDir}/com.lifeos.todoist-sync.plist`
  },
  {
    label: 'com.lifeos.git-save',
    plist: `${launchAgentDir}/com.lifeos.git-save.plist`
  }
];
const categories = ['Work', 'Career', 'Relationship', 'Family', 'Health', 'Home'];
const unclearCategory = 'требует уточнения';

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

  if (domain === 'daily') {
    await showDailyReview();
    return;
  }

  if (domain === 'save') {
    await saveChanges(rest.join(' ').trim() || action || 'Update Life OS');
    return;
  }

  if (domain === 'server' && action === 'on') {
    await setServerMode(true);
    return;
  }

  if (domain === 'server' && action === 'off') {
    await setServerMode(false);
    return;
  }

  if (domain === 'server' && action === 'status') {
    await showServerStatus();
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
  npm run lifeos -- daily
  npm run lifeos -- save "message"
  npm run lifeos -- server on
  npm run lifeos -- server off
  npm run lifeos -- server status
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

async function showDailyReview() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const [areas, inbox, projects, tasks] = await Promise.all([
    safeRead(areasPath),
    safeRead(inboxPath),
    safeRead(projectsPath),
    getTodoistTasks(token, env)
  ]);
  const inboxItems = parseInboxItems(inbox);
  const activeProjects = parseProjectHeadings(projects).slice(0, 10);

  console.log('# Ежедневный обзор');
  console.log('');
  console.log('## Фокусы');
  printFocusLines(areas);
  console.log('');
  console.log('## Активные задачи Todoist');
  printList(tasks.map((task) => task.content), 'Нет активных задач Todoist.');
  console.log('');
  console.log('## Inbox');
  printList(inboxItems, 'Inbox пуст.');
  console.log('');
  console.log('## Проекты для внимания');
  printList(activeProjects, 'Проекты не найдены.');
  console.log('');
  console.log('## Сегодня важно');
  console.log('- [ ] ');
  console.log('- [ ] ');
  console.log('- [ ] ');
  console.log('');
  console.log('## Минимум для баланса');
  console.log('- Работа / карьера:');
  console.log('- Семья:');
  console.log('- Здоровье:');
  console.log('');
  console.log('## Что может сломать день');
  console.log('- ');
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

async function saveChanges(message) {
  const status = await runCapture('git', ['status', '--short']);

  if (!status.trim()) {
    console.log('No changes to save.');
    return;
  }

  await run('git', ['add', '.']);
  await run('git', ['commit', '-m', message]);
  await run('git', ['push']);
}

async function setServerMode(enabled) {
  if (enabled) {
    await setSleepDisabled(true);

    for (const agent of serverAgents) {
      await bootstrapAgent(agent);
      await run('launchctl', ['kickstart', '-k', `gui/${userId}/${agent.label}`]);
    }

    console.log('Life OS server mode is ON.');
    console.log('Mac sleep is disabled and background sync agents are loaded.');
    return;
  }

  for (const agent of serverAgents) {
    await bootoutAgent(agent);
  }

  await setSleepDisabled(false);
  console.log('Life OS server mode is OFF.');
  console.log('Background sync agents are unloaded and normal sleep is enabled.');
}

async function showServerStatus() {
  const pmset = await runCapture('pmset', ['-g']);
  const sleepDisabled = /SleepDisabled\s+1/.test(pmset);

  console.log(`Sleep disabled: ${sleepDisabled ? 'yes' : 'no'}`);

  for (const agent of serverAgents) {
    const status = await getAgentStatus(agent);
    console.log(`${agent.label}: ${status}`);
  }
}

async function setSleepDisabled(enabled) {
  const script = enabled
    ? 'pmset -a sleep 0 displaysleep 30 disksleep 0 powernap 1 womp 1 tcpkeepalive 1 disablesleep 1'
    : 'pmset -a disablesleep 0 sleep 1 displaysleep 10 disksleep 10';

  await run('osascript', [
    '-e',
    `do shell script ${JSON.stringify(script)} with administrator privileges`
  ]);
}

async function bootstrapAgent(agent) {
  const status = await getAgentStatus(agent);

  if (status !== 'not loaded') {
    return;
  }

  await run('launchctl', ['bootstrap', `gui/${userId}`, agent.plist]);
}

async function bootoutAgent(agent) {
  const status = await getAgentStatus(agent);

  if (status === 'not loaded') {
    return;
  }

  await run('launchctl', ['bootout', `gui/${userId}/${agent.label}`]);
}

async function getAgentStatus(agent) {
  try {
    const output = await runCapture('launchctl', ['print', `gui/${userId}/${agent.label}`]);
    const lastExitMatch = output.match(/last exit code = ([^\n]+)/);
    const stateMatch = output.match(/state = ([^\n]+)/);
    const state = stateMatch ? stateMatch[1].trim() : 'loaded';
    const lastExit = lastExitMatch ? lastExitMatch[1].trim() : 'unknown';
    return `${state}, last exit code ${lastExit}`;
  } catch {
    return 'not loaded';
  }
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

function parseProjectHeadings(content) {
  const headings = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('## ')) {
      headings.push(line.slice(3).trim());
    }
  }

  return headings;
}

function printList(items, emptyMessage) {
  if (items.length === 0) {
    console.log(`- ${emptyMessage}`);
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
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
  return stripCategoryPrefix(content).replace(/\s+/g, ' ').trim().toLowerCase();
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
  const withoutMarker = trimmed.startsWith('- ') ? trimmed.slice(2).trim() : trimmed;
  const categorized = hasCategoryPrefix(withoutMarker)
    ? withoutMarker
    : `[${classifyTask(withoutMarker)}] ${withoutMarker}`;

  return `- ${categorized}`;
}

function hasCategoryPrefix(content) {
  return [...categories, unclearCategory].some((category) => content.startsWith(`[${category}] `));
}

function stripCategoryPrefix(content) {
  for (const category of [...categories, unclearCategory]) {
    const prefix = `[${category}] `;

    if (content.startsWith(prefix)) {
      return content.slice(prefix.length);
    }
  }

  return content;
}

function classifyTask(content) {
  const normalized = content.toLowerCase();

  if (/(эпл|электронн|газпром|коллект|surge|белк|давальческ|работ)/.test(normalized)) {
    return 'Work';
  }

  if (/(грейд|карьер|директор|должност)/.test(normalized)) {
    return 'Career';
  }

  if (/(жен|отношен|вдвоем|пар)/.test(normalized)) {
    return 'Relationship';
  }

  if (/(родител|сын|ребен|ребён|семь)/.test(normalized)) {
    return 'Family';
  }

  if (/(сон|вес|здоров|трен|энерг|врач)/.test(normalized)) {
    return 'Health';
  }

  if (/(дом|ванн|слив|mercedes|мерседес|кондиционер|то | то$|машин)/.test(normalized)) {
    return 'Home';
  }

  return unclearCategory;
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

function runCapture(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
      } else {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `${command} ${commandArgs.join(' ')} failed with ${code}`));
      }
    });
  });
}
