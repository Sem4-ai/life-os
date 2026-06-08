#!/usr/bin/env node

import { appendFile, copyFile, mkdir, readdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const areasPath = new URL('../areas.md', import.meta.url);
const calendarPath = new URL('../calendar.md', import.meta.url);
const healthPath = new URL('../health.md', import.meta.url);
const inboxPath = new URL('../inbox.md', import.meta.url);
const projectsPath = new URL('../projects.md', import.meta.url);
const meetingInboxPath = new URL('../meeting-inbox', import.meta.url);
const todoistStatePath = new URL('../todoist-state.json', import.meta.url);
const envPath = new URL('../.env', import.meta.url);
const obsidianVaultPath = '/Users/grachev90/Library/Mobile Documents/iCloud~md~obsidian/Documents/life-os';
const userId = '501';
const launchAgentDir = '/Users/grachev90/Library/LaunchAgents';
const serverAgents = [
  {
    label: 'com.lifeos.obsidian-sync',
    plist: `${launchAgentDir}/com.lifeos.obsidian-sync.plist`
  },
  {
    label: 'com.lifeos.todoist-sync',
    plist: `${launchAgentDir}/com.lifeos.todoist-sync.plist`
  },
  {
    label: 'com.lifeos.calendar-sync',
    plist: `${launchAgentDir}/com.lifeos.calendar-sync.plist`
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

  if (domain === 'projects' && action === 'dashboard') {
    await showProjectsDashboard();
    return;
  }

  if (domain === 'calendar' && action === 'sync') {
    await syncCalendar();
    return;
  }

  if (domain === 'calendar' && action === 'today') {
    await showCalendarToday();
    return;
  }

  if (domain === 'calendar' && action === 'agent' && rest[0] === 'install') {
    await installCalendarAgent();
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

  if (domain === 'health' && action === 'add-json') {
    await addHealthJson(rest.join(' ').trim());
    return;
  }

  if (domain === 'health' && action === 'latest') {
    await showLatestHealth();
    return;
  }

  if (domain === 'obsidian' && action === 'sync') {
    await syncObsidian();
    return;
  }

  if (domain === 'obsidian' && action === 'sync-loop') {
    await syncObsidianLoop();
    return;
  }

  if (domain === 'meeting' && action === 'new') {
    await createMeetingNote(rest);
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

  if (domain === 'todoist' && action === 'organize') {
    await organizeTodoistTasks();
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
  npm run lifeos -- projects dashboard
  npm run lifeos -- calendar sync
  npm run lifeos -- calendar today
  npm run lifeos -- calendar agent install
  npm run lifeos -- save "message"
  npm run lifeos -- server on
  npm run lifeos -- server off
  npm run lifeos -- server status
  npm run lifeos -- health add-json '{"date":"2026-06-07","sleepHours":6.2,"steps":7200}'
  npm run lifeos -- health latest
  npm run lifeos -- obsidian sync
  npm run lifeos -- meeting new project-slug "Meeting title"
  npm run lifeos -- todoist projects
  npm run lifeos -- todoist list
  npm run lifeos -- todoist pull
  npm run lifeos -- todoist push-inbox
  npm run lifeos -- todoist organize
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
  await printHealthBlock();
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
  await printHealthBlock();
  console.log('');
  printCalendarTodayBlock(await safeRead(calendarPath));
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
  const existingInboxItems = new Set(
    parseInboxItems(existingInbox).map((item) => normalizeTaskContent(item))
  );
  const lines = tasks
    .filter((task) => !existingInboxItems.has(normalizeTaskContent(task.content)))
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

async function getTodoistSections(token, env) {
  if (!env.TODOIST_PROJECT_ID) {
    return [];
  }

  const sections = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({
      project_id: env.TODOIST_PROJECT_ID,
      limit: '200'
    });

    if (cursor) {
      query.set('cursor', cursor);
    }

    const page = await todoistRequest(token, `/sections?${query.toString()}`);
    sections.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);

  return sections;
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
  const sectionByCategory = await getTodoistSectionByCategory(token, env);
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
    const category = getCategoryPrefix(item);
    await todoistRequest(token, '/tasks', {
      method: 'POST',
      body: {
        content: todoistTaskContent(item),
        project_id: env.TODOIST_PROJECT_ID || undefined,
        section_id: sectionByCategory.get(category) || env.TODOIST_SECTION_ID || undefined
      }
    });
    created += 1;
  }

  const skipped = items.length - created;
  console.log(`Created ${created} Todoist task(s) from inbox. Skipped ${skipped} existing item(s).`);
}

async function organizeTodoistTasks() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const tasks = await getTodoistTasks(token, env);
  const sectionByCategory = await getTodoistSectionByCategory(token, env);
  let moved = 0;
  let renamed = 0;
  let skipped = 0;

  for (const task of tasks) {
    const category = getCategoryPrefix(task.content);
    const sectionId = sectionByCategory.get(category);
    const cleanContent = todoistTaskContent(task.content);

    if (sectionId && task.section_id !== sectionId) {
      await todoistRequest(token, `/tasks/${encodeURIComponent(task.id)}/move`, {
        method: 'POST',
        body: {
          section_id: sectionId
        }
      });
      moved += 1;
    }

    if (cleanContent !== task.content) {
      await todoistRequest(token, `/tasks/${encodeURIComponent(task.id)}`, {
        method: 'POST',
        body: {
          content: cleanContent
        }
      });
      renamed += 1;
    }

    if ((!sectionId || task.section_id === sectionId) && cleanContent === task.content) {
      skipped += 1;
    }
  }

  console.log(`Organized ${moved} Todoist task(s) into sections. Renamed ${renamed} task(s). Skipped ${skipped} task(s).`);
}

async function getTodoistSectionByCategory(token, env) {
  const sections = await getTodoistSections(token, env);
  const sectionByName = new Map(sections.map((section) => [section.name.toLowerCase(), section.id]));
  const sectionByCategory = new Map();

  for (const category of categories) {
    const sectionId = sectionByName.get(category.toLowerCase());

    if (sectionId) {
      sectionByCategory.set(category, sectionId);
    }
  }

  return sectionByCategory;
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
  await removeClosedTodoistTasksFromInbox();
  await pullTodoist();
  await pushInboxToTodoist();
  await organizeTodoistTasks();
  await saveTodoistSyncState();
  await run('git', ['status', '--short']);
}

async function removeClosedTodoistTasksFromInbox() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const activeTasks = await getTodoistTasks(token, env);
  const activeTaskContents = new Set(
    activeTasks.map((task) => normalizeTaskContent(task.content))
  );
  const previousTaskContents = new Set(await loadTodoistSyncState());

  if (previousTaskContents.size === 0) {
    console.log('No previous Todoist sync state found. Closed-task cleanup will start after this sync.');
    return;
  }

  const existing = await safeRead(inboxPath);
  const lines = existing.split('\n');
  let removed = 0;

  const nextLines = lines.filter((line) => {
    const trimmed = line.trim();

    if (!trimmed.startsWith('- ')) {
      return true;
    }

    const item = trimmed.slice(2).trim();
    const normalizedItem = normalizeTaskContent(item);

    if (activeTaskContents.has(normalizedItem)) {
      return true;
    }

    if (!previousTaskContents.has(normalizedItem)) {
      return true;
    }

    removed += 1;
    return false;
  });

  if (removed === 0) {
    console.log('No closed Todoist tasks to remove from inbox.');
    return;
  }

  await writeFile(inboxPath, nextLines.join('\n').replace(/\n*$/, '\n'), 'utf8');
  console.log(`Removed ${removed} closed Todoist task(s) from inbox.`);
}

async function saveTodoistSyncState() {
  const env = await loadEnv();
  const token = requireEnv(env, 'TODOIST_API_TOKEN');
  const activeTasks = await getTodoistTasks(token, env);
  const taskContents = uniqueItems(activeTasks.map((task) => task.content))
    .map((content) => normalizeTaskContent(content))
    .sort();
  const previousTaskContents = await loadTodoistSyncState();

  if (JSON.stringify(previousTaskContents) === JSON.stringify(taskContents)) {
    console.log(`Todoist sync state unchanged for ${taskContents.length} active task(s).`);
    return;
  }

  await writeFile(
    todoistStatePath,
    `${JSON.stringify({ activeTaskContents: taskContents }, null, 2)}\n`,
    'utf8'
  );
  console.log(`Saved Todoist sync state for ${taskContents.length} active task(s).`);
}

async function loadTodoistSyncState() {
  const content = await safeRead(todoistStatePath);

  if (!content.trim()) {
    return [];
  }

  try {
    const state = JSON.parse(content);
    return Array.isArray(state.activeTaskContents) ? state.activeTaskContents : [];
  } catch {
    return [];
  }
}

async function gitSync() {
  await run('git', ['pull', '--ff-only']);
  await run('git', ['status', '--short']);
  console.log('Review changes, then commit with git when ready.');
}

async function syncCalendar() {
  const projects = await getProjectNotes();
  const events = await getCalendarEvents();
  const annotatedEvents = events
    .map((event) => annotateCalendarEvent(event, projects))
    .sort((left, right) => left.start.localeCompare(right.start));
  const existing = await safeRead(calendarPath);
  const next = formatCalendarFile(annotatedEvents);

  if (normalizeCalendarForCompare(existing) !== normalizeCalendarForCompare(next)) {
    await writeFile(calendarPath, next, 'utf8');
    await syncObsidian();
  } else {
    console.log('Calendar unchanged.');
  }

  console.log(`Calendar sync complete. Events: ${annotatedEvents.length}.`);
}

async function showCalendarToday() {
  const content = await safeRead(calendarPath);
  const today = new Date().toISOString().slice(0, 10);
  const lines = content.split('\n');
  let inToday = false;
  let printed = 0;

  console.log('# Календарь сегодня');
  console.log('');

  for (const line of lines) {
    if (line === `## ${today}`) {
      inToday = true;
      continue;
    }

    if (inToday && line.startsWith('## ')) {
      break;
    }

    if (inToday && line.startsWith('- ')) {
      console.log(line);
      printed += 1;
    }
  }

  if (printed === 0) {
    console.log('- На сегодня событий в calendar.md нет. Запусти `npm run lifeos -- calendar sync`.');
  }
}

async function getCalendarEvents() {
  const script = `
import Foundation
import EventKit

let store = EKEventStore()
let status = EKEventStore.authorizationStatus(for: .event)

if status == .notDetermined {
  let semaphore = DispatchSemaphore(value: 0)
  var granted = false

  if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { accessGranted, _ in
      granted = accessGranted
      semaphore.signal()
    }
  } else {
    store.requestAccess(to: .event) { accessGranted, _ in
      granted = accessGranted
      semaphore.signal()
    }
  }

  _ = semaphore.wait(timeout: .now() + 30)

  if !granted {
    fputs("Calendar access was not granted.\\n", stderr)
    exit(2)
  }
} else if ![3, 4].contains(status.rawValue) {
  fputs("Calendar access is not authorized. Status: \\(status.rawValue)\\n", stderr)
  exit(2)
}

let now = Date()
let from = now.addingTimeInterval(-24 * 60 * 60)
let to = now.addingTimeInterval(14 * 24 * 60 * 60)
let predicate = store.predicateForEvents(withStart: from, end: to, calendars: nil)
let formatter = ISO8601DateFormatter()

let events = store.events(matching: predicate)
  .filter { event in
    event.startDate != nil && event.startDate >= from && event.startDate <= to
  }
  .map { event -> [String: Any] in
    [
      "title": event.title ?? "",
      "start": formatter.string(from: event.startDate),
      "end": formatter.string(from: event.endDate),
      "calendar": event.calendar.title,
      "location": event.location ?? "",
      "allDay": event.isAllDay
    ]
  }

let data = try JSONSerialization.data(withJSONObject: events, options: [])
print(String(data: data, encoding: .utf8) ?? "[]")
`;

  try {
    const output = await runCaptureWithTimeout('swift', ['-e', script], 45_000);
    const parsed = JSON.parse(output.trim() || '[]');
    return parsed.filter((event) => event.title && event.start);
  } catch (error) {
    throw new Error(`Calendar sync failed. Открой System Settings -> Privacy & Security -> Calendars и разреши Terminal/Node доступ к календарю. Detail: ${error.message}`);
  }
}

function annotateCalendarEvent(event, projects) {
  const haystack = `${event.title} ${event.location} ${event.calendar}`.toLowerCase();
  const project = projects.find((item) =>
    item.aliases.some((alias) => haystack.includes(alias))
  );

  return {
    ...event,
    project: project ? project.title : 'General',
    projectSlug: project ? project.slug : null
  };
}

function formatCalendarFile(events) {
  const generatedAt = new Date().toISOString();
  const uniqueEvents = dedupeCalendarEvents(events);
  const lines = [
    '# Calendar',
    '',
    'События календаря для контекста Life OS.',
    '',
    `Обновлено: ${generatedAt}`,
    '',
    'Правило: события привязываются к проектам по названию/месту/календарю. Если совпадения нет, событие остается `General`.',
    ''
  ];

  const eventsByDate = groupBy(uniqueEvents, (event) => event.start.slice(0, 10));

  for (const date of Object.keys(eventsByDate).sort()) {
    lines.push(`## ${date}`);
    lines.push('');

    for (const event of eventsByDate[date]) {
      const timeRange = `${formatEventTime(event.start)}-${formatEventTime(event.end)}`;
      const displayedTime = event.allDay ? 'all-day' : timeRange;
      const project = event.projectSlug
        ? `[[project-notes/work/${event.projectSlug}/project|${event.project}]]`
        : event.project;
      const location = event.location ? `; место: ${event.location}` : '';
      lines.push(`- ${displayedTime} | ${project} | ${event.title} (${event.calendar}${location})`);
    }

    lines.push('');
  }

  if (uniqueEvents.length === 0) {
    lines.push('## Нет событий');
    lines.push('');
    lines.push('- Calendar sync не нашел событий в диапазоне вчера -> следующие 14 дней.');
    lines.push('');
  }

  return lines.join('\n');
}

function dedupeCalendarEvents(events) {
  const seen = new Set();
  const unique = [];

  for (const event of events) {
    const key = [
      event.start,
      event.end,
      event.title,
      event.calendar,
      event.location
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(event);
  }

  return unique;
}

function normalizeCalendarForCompare(content) {
  return content
    .split('\n')
    .filter((line) => !line.startsWith('Обновлено: '))
    .join('\n')
    .trim();
}

function formatEventTime(value) {
  if (!value) {
    return '??:??';
  }

  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function groupBy(items, keyFunction) {
  return items.reduce((groups, item) => {
    const key = keyFunction(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

async function showProjectsDashboard() {
  const projects = await getProjectNotes();
  const todoistTasks = await getTodoistTasksForDashboard();
  const today = new Date().toISOString().slice(0, 10);

  console.log('# Сводка проектов');
  console.log('');
  console.log(`Дата: ${today}`);
  console.log('');
  console.log('## Требуют внимания');

  const attentionItems = projects
    .map((project) => projectAttention(project, today))
    .filter(Boolean);

  printList(attentionItems, 'Критичных сигналов нет.');
  console.log('');
  console.log('## Проекты');
  console.log('');

  for (const project of projects) {
    const matchingTasks = findProjectTasks(todoistTasks, project);
    console.log(`### ${project.title}`);
    console.log(`- Статус: ${project.status}`);
    console.log(`- Дедлайн: ${project.deadline}`);
    console.log(`- Результат: ${project.result}`);
    console.log(`- Следующий шаг: ${project.nextStep}`);
    console.log(`- Риски: ${formatInlineList(project.risks)}`);
    console.log(`- Открытые вопросы: ${formatInlineList(project.openQuestions)}`);
    console.log(`- Последние решения: ${formatInlineList(project.decisions)}`);
    console.log(`- Последние встречи: ${formatInlineList(project.meetings)}`);
    console.log(`- Задачи Todoist: ${formatInlineList(matchingTasks)}`);
    console.log(`- Файл: ${project.relativePath}`);
    console.log('');
  }
}

async function getProjectNotes() {
  const workProjectsPath = new URL('../project-notes/work', import.meta.url);
  const entries = await readdir(workProjectsPath, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || shouldSkipObsidianSyncEntry(entry.name)) {
      continue;
    }

    const projectPath = new URL(`../project-notes/work/${entry.name}/project.md`, import.meta.url);

    if (!existsSync(projectPath)) {
      continue;
    }

    const [projectContent, meetingsContent, decisionsContent] = await Promise.all([
      safeRead(projectPath),
      safeRead(new URL(`../project-notes/work/${entry.name}/meetings.md`, import.meta.url)),
      safeRead(new URL(`../project-notes/work/${entry.name}/decisions.md`, import.meta.url))
    ]);

    projects.push(parseProjectNote(entry.name, projectContent, meetingsContent, decisionsContent));
  }

  return projects.sort(compareProjectsForDashboard);
}

function parseProjectNote(slug, projectContent, meetingsContent, decisionsContent) {
  const title = firstHeading(projectContent) || slug;

  return {
    slug,
    title,
    aliases: projectAliases(slug, title),
    status: fieldValue(projectContent, 'Статус') || 'требует уточнения',
    deadline: fieldValue(projectContent, 'Дедлайн') || 'требует уточнения',
    result: fieldValue(projectContent, 'Результат') || 'требует уточнения',
    nextStep: fieldValue(projectContent, 'Следующий шаг') || 'требует уточнения',
    risks: sectionBullets(projectContent, 'Риски').slice(0, 3),
    openQuestions: sectionBullets(projectContent, 'Открытые вопросы').slice(0, 3),
    meetings: extractLatestSectionItems(meetingsContent).slice(0, 3),
    decisions: sectionBullets(decisionsContent, 'Принятые решения').slice(-3).reverse(),
    relativePath: `project-notes/work/${slug}/project.md`
  };
}

function firstHeading(content) {
  const line = content.split('\n').find((item) => item.startsWith('# '));
  return line ? line.slice(2).trim() : null;
}

function fieldValue(content, field) {
  const prefix = `${field}:`;
  const line = content.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : null;
}

function sectionBullets(content, heading) {
  const lines = content.split('\n');
  const bullets = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === `## ${heading}`) {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith('## ')) {
      break;
    }

    if (inSection && line.startsWith('- ')) {
      bullets.push(line.slice(2).trim());
    }
  }

  return bullets.filter((item) => item && item !== 'требует уточнения');
}

function extractLatestSectionItems(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter((item) => item && item !== 'требует уточнения')
    .slice(-5)
    .reverse();
}

function projectAliases(slug, title) {
  const aliases = new Set([
    slug.toLowerCase(),
    title.toLowerCase(),
    title.toLowerCase().replace(/\s+/g, ''),
    slug.toLowerCase().replace(/-/g, ' ')
  ]);

  if (slug === 'epl') {
    aliases.add('эпл');
    aliases.add('epl');
  }
  if (slug === 'avarkomy') aliases.add('аварком');
  if (slug === 'gazpromneft') aliases.add('газпром');
  if (slug === 'gazpromneft') aliases.add('гпн');
  if (slug === 'belka-surge') {
    aliases.add('белка');
    aliases.add('surge');
  }
  if (slug === 'support-move-2026-06-16') {
    aliases.add('саппорт');
    aliases.add('переезд');
  }

  return [...aliases];
}

async function getTodoistTasksForDashboard() {
  try {
    const env = await loadEnv();

    if (!env.TODOIST_API_TOKEN) {
      return [];
    }

    const tasks = await getTodoistTasks(env.TODOIST_API_TOKEN, env);
    return tasks.map((task) => task.content);
  } catch {
    return [];
  }
}

function findProjectTasks(tasks, project) {
  return tasks
    .filter((task) => {
      const normalized = task.toLowerCase();
      return project.aliases.some((alias) => normalized.includes(alias));
    })
    .slice(0, 5);
}

function projectAttention(project, today) {
  const missingNextStep = project.nextStep === 'требует уточнения';
  const missingDeadline = project.deadline === 'требует уточнения';
  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(project.deadline) ? project.deadline : null;

  if (deadlineDate) {
    const daysLeft = Math.ceil((Date.parse(deadlineDate) - Date.parse(today)) / 86_400_000);

    if (daysLeft < 0) {
      return `${project.title}: дедлайн прошел ${project.deadline}`;
    }

    if (daysLeft <= 14) {
      return `${project.title}: дедлайн через ${daysLeft} дн. (${project.deadline})`;
    }
  }

  if (missingNextStep) {
    return `${project.title}: не указан следующий шаг`;
  }

  if (missingDeadline) {
    return `${project.title}: не указан дедлайн`;
  }

  return null;
}

function compareProjectsForDashboard(left, right) {
  const leftDeadline = normalizedDeadline(left.deadline);
  const rightDeadline = normalizedDeadline(right.deadline);

  if (leftDeadline !== rightDeadline) {
    return leftDeadline.localeCompare(rightDeadline);
  }

  return left.title.localeCompare(right.title);
}

function normalizedDeadline(deadline) {
  return /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : '9999-12-31';
}

function formatInlineList(items) {
  if (!items || items.length === 0) {
    return 'нет данных';
  }

  return items.join('; ');
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

async function syncObsidian() {
  if (!existsSync(obsidianVaultPath)) {
    throw new Error(`Obsidian vault not found: ${obsidianVaultPath}`);
  }

  const repoRoot = root.pathname;
  const fromObsidian = await syncMarkdownTree(obsidianVaultPath, repoRoot);
  const toObsidian = await syncMarkdownTree(repoRoot, obsidianVaultPath);

  console.log(`Obsidian sync complete. From Obsidian: ${fromObsidian}. To Obsidian: ${toObsidian}.`);
}

async function syncObsidianLoop() {
  while (true) {
    try {
      await syncObsidian();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Obsidian sync failed: ${error.message}`);
    }

    await sleep(60_000);
  }
}

async function createMeetingNote(args) {
  const [projectSlug, ...titleParts] = args;
  const title = titleParts.join(' ').trim();

  if (!projectSlug || !title) {
    throw new Error('Usage: npm run lifeos -- meeting new project-slug "Meeting title"');
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}-${slugify(`${projectSlug}-${title}`)}.md`;
  const filePath = new URL(`../meeting-inbox/${filename}`, import.meta.url);

  if (existsSync(filePath)) {
    throw new Error(`Meeting note already exists: meeting-inbox/${filename}`);
  }

  await mkdir(meetingInboxPath, { recursive: true });
  await writeFile(filePath, formatMeetingInboxNote({ date, projectSlug, title }), 'utf8');
  await syncObsidian();
  console.log(`Created meeting note: meeting-inbox/${filename}`);
}

function formatMeetingInboxNote({ date, projectSlug, title }) {
  return `# ${date} / ${title}

Проект: [[project-notes/work/${projectSlug}/project|${projectSlug}]]
Статус обработки: raw

## Контекст

- требует уточнения

## Участники

- требует уточнения

## Сырая расшифровка

Вставить текст расшифровки сюда.

## Что извлечь при обработке

- Контекст для проекта
- Краткое саммари встречи
- Решения
- Открытые вопросы
- Задачи / следующие действия

`;
}

function slugify(value) {
  const transliterated = value
    .toLowerCase()
    .replace(/а/g, 'a')
    .replace(/б/g, 'b')
    .replace(/в/g, 'v')
    .replace(/г/g, 'g')
    .replace(/д/g, 'd')
    .replace(/е/g, 'e')
    .replace(/ё/g, 'e')
    .replace(/ж/g, 'zh')
    .replace(/з/g, 'z')
    .replace(/и/g, 'i')
    .replace(/й/g, 'y')
    .replace(/к/g, 'k')
    .replace(/л/g, 'l')
    .replace(/м/g, 'm')
    .replace(/н/g, 'n')
    .replace(/о/g, 'o')
    .replace(/п/g, 'p')
    .replace(/р/g, 'r')
    .replace(/с/g, 's')
    .replace(/т/g, 't')
    .replace(/у/g, 'u')
    .replace(/ф/g, 'f')
    .replace(/х/g, 'h')
    .replace(/ц/g, 'c')
    .replace(/ч/g, 'ch')
    .replace(/ш/g, 'sh')
    .replace(/щ/g, 'sch')
    .replace(/ъ/g, '')
    .replace(/ы/g, 'y')
    .replace(/ь/g, '')
    .replace(/э/g, 'e')
    .replace(/ю/g, 'yu')
    .replace(/я/g, 'ya');

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting';
}

async function syncMarkdownTree(sourceRoot, targetRoot) {
  const files = await collectMarkdownFiles(sourceRoot);
  let copied = 0;

  for (const relativePath of files) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    if (await copyIfSourceIsNewer(sourcePath, targetPath)) {
      copied += 1;
    }
  }

  return copied;
}

async function collectMarkdownFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (shouldSkipObsidianSyncEntry(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(entryPath, base));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(base, entryPath));
    }
  }

  return files;
}

function shouldSkipObsidianSyncEntry(name) {
  return name.startsWith('.') || ['node_modules', 'scripts'].includes(name);
}

async function copyIfSourceIsNewer(sourcePath, targetPath) {
  const sourceStat = await stat(sourcePath);
  let targetStat = null;

  try {
    targetStat = await stat(targetPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (targetStat && sourceStat.mtimeMs <= targetStat.mtimeMs + 1000) {
    return false;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  await utimes(targetPath, sourceStat.atime, sourceStat.mtime);
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function addHealthJson(jsonText) {
  if (!jsonText) {
    jsonText = await readStdin();
  }

  if (!jsonText.trim()) {
    throw new Error('Usage: npm run lifeos -- health add-json \'{"date":"2026-06-07","sleepHours":6.2,"steps":7200}\'');
  }

  const snapshot = JSON.parse(jsonText);
  const normalized = normalizeHealthSnapshot(snapshot);
  const existing = await safeRead(healthPath);
  const next = upsertHealthSnapshot(existing, normalized);
  await writeFile(healthPath, next, 'utf8');
  console.log(`Added health snapshot for ${normalized.date}.`);
}

async function showLatestHealth() {
  const snapshots = parseHealthSnapshots(await safeRead(healthPath));

  if (snapshots.length === 0) {
    console.log('No health snapshots found.');
    return;
  }

  const latest = snapshots[snapshots.length - 1];
  console.log(formatHealthSnapshot(latest));
}

async function printHealthBlock() {
  const snapshots = parseHealthSnapshots(await safeRead(healthPath));

  console.log('## Health');

  if (snapshots.length === 0) {
    console.log('- Нет health snapshot. Запусти iPhone Shortcut для синхронизации Apple Health.');
    return;
  }

  const latest = snapshots[snapshots.length - 1];
  for (const line of formatHealthSnapshot(latest).split('\n')) {
    console.log(`- ${line}`);
  }
}

function normalizeHealthSnapshot(snapshot) {
  const date = String(snapshot.date || new Date().toISOString().slice(0, 10));

  return {
    date,
    sleepHours: numberOrNull(snapshot.sleepHours),
    steps: integerOrNull(snapshot.steps),
    activeEnergyKcal: integerOrNull(snapshot.activeEnergyKcal),
    exerciseMinutes: integerOrNull(snapshot.exerciseMinutes),
    standHours: integerOrNull(snapshot.standHours),
    restingHeartRate: integerOrNull(snapshot.restingHeartRate),
    hrvMs: integerOrNull(snapshot.hrvMs),
    weightKg: numberOrNull(snapshot.weightKg),
    source: snapshot.source ? String(snapshot.source) : 'Apple Health / Apple Watch'
  };
}

function upsertHealthSnapshot(existing, snapshot) {
  const snapshots = parseHealthSnapshots(existing).filter((item) => item.date !== snapshot.date);
  snapshots.push(snapshot);
  snapshots.sort((left, right) => left.date.localeCompare(right.date));

  const lines = [
    '# Health',
    '',
    'Краткие daily snapshots из Apple Health / Apple Watch.',
    '',
    'Правило: использовать эти данные только для мягких рекомендаций по режиму, восстановлению и нагрузке. Не делать медицинских выводов.',
    '',
    '## Snapshots',
    ''
  ];

  for (const item of snapshots) {
    lines.push(`- ${JSON.stringify(item)}`);
  }

  lines.push('');
  lines.push('## Latest');
  lines.push('');
  lines.push(formatHealthSnapshot(snapshots[snapshots.length - 1]));
  lines.push('');

  return `${lines.join('\n')}`;
}

function parseHealthSnapshots(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- {'))
    .map((line) => {
      try {
        return JSON.parse(line.slice(2));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function formatHealthSnapshot(snapshot) {
  const lines = [`Дата: ${snapshot.date}`];

  if (snapshot.sleepHours != null) lines.push(`Сон: ${snapshot.sleepHours} ч`);
  if (snapshot.steps != null) lines.push(`Шаги: ${snapshot.steps}`);
  if (snapshot.activeEnergyKcal != null) lines.push(`Активная энергия: ${snapshot.activeEnergyKcal} ккал`);
  if (snapshot.exerciseMinutes != null) lines.push(`Упражнения: ${snapshot.exerciseMinutes} мин`);
  if (snapshot.standHours != null) lines.push(`Часы стоя: ${snapshot.standHours}`);
  if (snapshot.restingHeartRate != null) lines.push(`Пульс покоя: ${snapshot.restingHeartRate}`);
  if (snapshot.hrvMs != null) lines.push(`HRV: ${snapshot.hrvMs} мс`);
  if (snapshot.weightKg != null) lines.push(`Вес: ${snapshot.weightKg} кг`);

  const recommendations = healthRecommendations(snapshot);
  if (recommendations.length > 0) {
    lines.push(`Режим: ${recommendations.join(' ')}`);
  }

  return lines.join('\n');
}

function healthRecommendations(snapshot) {
  const recommendations = [];

  if (snapshot.sleepHours != null && snapshot.sleepHours < 6) {
    recommendations.push('Сон ниже минимума; сегодня не планировать тяжелую нагрузку и поставить ранний отбой.');
  } else if (snapshot.sleepHours != null && snapshot.sleepHours < 7) {
    recommendations.push('Сон пограничный; держать день без лишнего перегруза.');
  }

  if (snapshot.steps != null && snapshot.steps < 5000) {
    recommendations.push('Добавить короткую прогулку 20-30 минут.');
  }

  if (snapshot.exerciseMinutes != null && snapshot.exerciseMinutes === 0 && snapshot.sleepHours != null && snapshot.sleepHours >= 6.5) {
    recommendations.push('Можно добавить легкую тренировку или прогулку без форсирования.');
  }

  return recommendations;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function integerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
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

async function installCalendarAgent() {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/grachev90</string>
    <key>PATH</key>
    <string>/Users/grachev90/.nvm/versions/node/v24.14.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>Label</key>
  <string>com.lifeos.calendar-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(process.execPath)}</string>
    <string>scripts/lifeos.mjs</string>
    <string>calendar</string>
    <string>sync</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/Users/grachev90/Library/Logs/lifeos-calendar-sync.err.log</string>
  <key>StandardOutPath</key>
  <string>/Users/grachev90/Library/Logs/lifeos-calendar-sync.out.log</string>
  <key>StartInterval</key>
  <integer>10800</integer>
  <key>WorkingDirectory</key>
  <string>/Users/grachev90/life-os</string>
</dict>
</plist>
`;

  const agent = serverAgents.find((item) => item.label === 'com.lifeos.calendar-sync');
  await writeFile(agent.plist, plist, 'utf8');

  const status = await getAgentStatus(agent);
  if (status !== 'not loaded') {
    await bootoutAgent(agent);
  }

  await bootstrapAgent(agent);
  await run('launchctl', ['kickstart', '-k', `gui/${userId}/${agent.label}`]);
  console.log('Calendar sync agent installed. Interval: 3 hours.');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function printCalendarTodayBlock(content) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = content.split('\n');
  const events = [];
  let inToday = false;

  for (const line of lines) {
    if (line === `## ${today}`) {
      inToday = true;
      continue;
    }

    if (inToday && line.startsWith('## ')) {
      break;
    }

    if (inToday && line.startsWith('- ')) {
      events.push(line.slice(2).trim());
    }
  }

  console.log('## Calendar');
  printList(events, 'На сегодня событий в calendar.md нет.');
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

function todoistTaskContent(content) {
  return stripCategoryPrefix(content).replace(/\s+/g, ' ').trim();
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

function getCategoryPrefix(content) {
  for (const category of categories) {
    if (content.startsWith(`[${category}] `)) {
      return category;
    }
  }

  return null;
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

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
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

function runCaptureWithTimeout(command, commandArgs, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
      } else {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `${command} ${commandArgs.join(' ')} failed with ${code}`));
      }
    });
  });
}
