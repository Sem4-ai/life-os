# Life OS

Локальная markdown-система для управления жизнью, проектами и регулярными обзорами.

## Принцип

Единое окно входа и выхода: ChatGPT.

Git хранит историю изменений и позволяет безопасно менять файлы. Markdown-файлы остаются источником правды.

## Текущие файлы

- `vision.md` - образ успешного года
- `areas.md` - постоянные сферы ответственности
- `projects.md` - активные проекты
- `inbox.md` - входящие мысли и задачи
- `review.md` - шаблоны ежедневного и еженедельного обзора
- `context.md` - короткий контекст для ChatGPT
- `calendar.md` - ближайшие события календаря для контекста графика и встреч
- `goals.md` - резерв под цели, если понадобится
- `profile.md` - резерв под персональный контекст
- `meeting-inbox/` - сырые расшифровки встреч перед обработкой в проекты

## Рабочий цикл

1. Все мысли, задачи и сигналы сначала попадают в `inbox.md`.
2. ChatGPT помогает разбирать `inbox.md` и переносить важное в `projects.md`.
3. `projects.md` хранит только проекты с результатом, следующим шагом и статусом.
4. Еженедельный обзор обновляет фокус по работе, семье и здоровью.
5. Git фиксирует изменения после значимых правок.

## Категории

Все задачи и проекты относятся к одной из постоянных категорий:

- `Work` - рабочие клиентские, операционные и проектные задачи. Примеры: `Разобраться с ЭПЛ`, `Газпромнефть`.
- `Career` - рост роли, грейд, подготовка к следующему уровню ответственности. Примеры: `Следующий грейд`, `Подготовка к уровню операционного директора`.
- `Relationship` - отношения с женой и качество связи в паре. Пример: `Улучшение отношений с женой`.
- `Family` - ребенок, родители и семейные контакты вне отношений в паре. Пример: `Позвонить родителям`.
- `Health` - сон, вес, энергия, тренировки и медицинские привычки. Примеры: `Вес 85 -> 78`, `Улучшение сна`.
- `Home` - дом, быт, машина, ремонт и обслуживание. Примеры: `Установить слив в ванную`, `ТО Mercedes`.

Если категория задачи или проекта неочевидна, она помечается как `требует уточнения`.

## Интеграции

Интеграции подключаются постепенно и не становятся отдельной системой.

Приоритет:

1. Задачи - импортировать входящие задачи в `inbox.md`.
2. Календарь - использовать события как контекст для ежедневного и еженедельного обзора.
3. Здоровье - использовать сон, вес и активность как данные для области `Здоровье`.

Правило: интеграция должна либо пополнять `inbox.md`, либо давать краткий контекст для обзора. Если она требует постоянного ручного обслуживания, ее не подключаем.

## Calendar integration

Календарь используется как контекст графика и рабочих встреч.

Команды:

```bash
npm run lifeos -- calendar sync
```

Забирает события из macOS Calendar через EventKit за диапазон вчера -> следующие 14 дней, привязывает их к проектам по названию/месту/календарю и обновляет `calendar.md`.

```bash
npm run lifeos -- calendar today
```

Показывает события на сегодня из `calendar.md`.

```bash
npm run lifeos -- calendar agent install
```

Устанавливает фоновый агент `com.lifeos.calendar-sync`, который обновляет календарь раз в 3 часа.

Если macOS не дает доступ к Calendar, нужно разрешить Terminal/Node/Swift доступ в `System Settings -> Privacy & Security -> Calendars`. Ручной запуск может иметь доступ отдельно от фонового `launchd`-агента.

Правило: календарные события сами по себе не становятся задачами. После встречи запись и расшифровка обрабатываются отдельно через `meeting-inbox/`.

## Telegram bridge

Telegram используется как легкий мобильный вход/выход для LifeOS.

Что умеет бот:

- принимать обычный текст и сохранять его в `inbox.md`;
- добавлять задачи в `inbox.md` и Todoist;
- показывать `today`, календарь на сегодня, dashboard проектов и inbox;
- отправлять исходящие сообщения через команду `telegram send`.

Важно: ответы бота могут содержать данные LifeOS из markdown, Todoist и календаря. Поэтому доступ ограничивается `TELEGRAM_CHAT_ID` / `TELEGRAM_ALLOWED_CHAT_IDS`.

### Настройка

1. Создать бота в Telegram через `@BotFather`.
2. Добавить в `.env`:

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ALLOWED_CHAT_IDS=
```

3. Написать боту `/id`.
4. Запустить один polling:

```bash
npm run lifeos -- telegram poll
```

5. В ответе бот покажет `chat_id`; его нужно положить в `TELEGRAM_CHAT_ID`.

Если бот должен писать в канал, добавь бота в канал администратором и укажи chat id канала. Для приватных каналов id обычно начинается с `-100`.

### Команды

```bash
npm run lifeos -- telegram status
```

Проверяет токен бота и показывает, настроен ли `TELEGRAM_CHAT_ID`.

```bash
npm run lifeos -- telegram send "Текст"
```

Отправляет сообщение в `TELEGRAM_CHAT_ID`.

```bash
npm run lifeos -- telegram poll
```

Один раз забирает входящие сообщения Telegram и отвечает на них.

```bash
npm run lifeos -- telegram agent install
```

Устанавливает фоновый агент `com.lifeos.telegram`, который опрашивает Telegram каждые 5 секунд.

После установки агент включается/выключается вместе с серверным режимом:

```bash
npm run lifeos -- server on
npm run lifeos -- server off
```

### Команды в Telegram

```text
/today
/calendar
/projects
/inbox
/task текст задачи
/done текст задачи
/note текст заметки
/id
```

Обычный текст без команды сохраняется в `inbox.md`.

## Meeting workflow

Встречи записываются на iPhone, расшифровываются в текст и попадают в `meeting-inbox/`.

Команда для создания заготовки:

```bash
npm run lifeos -- meeting new epl "Статус и блокеры"
```

После вставки расшифровки в Obsidian нужно попросить ChatGPT:

```text
Обработай meeting-inbox/<имя файла>.md
```

При обработке сырая расшифровка остается в `meeting-inbox/`, а полезная выжимка переносится в проект: контекст, саммари встречи, решения, открытые вопросы, декомпозиция и конкретные задачи в Todoist.

## Health integration

Apple Health / Apple Watch не читаются напрямую с Mac. Данные передаются с iPhone через Shortcuts в виде краткого daily snapshot.

Файл:

- `health.md` - краткая история snapshots и последний статус восстановления/активности.

Команды:

```bash
npm run lifeos -- health add-json '{"date":"2026-06-07","sleepHours":6.2,"steps":7200,"activeEnergyKcal":420,"exerciseMinutes":20,"restingHeartRate":62,"weightKg":85}'
```

Добавляет или обновляет health snapshot за дату.

```bash
npm run lifeos -- health latest
```

Показывает последний health snapshot и мягкие рекомендации по режиму.

Рекомендуемый iPhone Shortcut:

Полная сборка лежит в `shortcuts/lifeos-health-sync.md`.

1. Получить данные Health за сегодня: сон, шаги, активная энергия, минуты упражнений, часы стоя, пульс покоя, HRV, вес.
2. Собрать JSON с полями `date`, `sleepHours`, `steps`, `activeEnergyKcal`, `exerciseMinutes`, `standHours`, `restingHeartRate`, `hrvMs`, `weightKg`.
3. Выполнить на Mac через SSH:

```bash
cd /Users/grachev90/life-os
PATH=/Users/grachev90/.nvm/versions/node/v24.14.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run lifeos -- health add-json '<JSON>'
PATH=/Users/grachev90/.nvm/versions/node/v24.14.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run lifeos -- save "Update health snapshot"
```

Данные используются для рекомендаций по режиму, а не для медицинских выводов.

## Todoist agent

Первый внешний источник задач - Todoist.

Локальный агент находится в `scripts/lifeos.mjs` и работает без npm-зависимостей.

### Настройка

1. Скопировать `.env.example` в `.env`.
2. Заполнить `TODOIST_API_TOKEN`.
3. По желанию заполнить `TODOIST_PROJECT_ID` и `TODOIST_SECTION_ID`, если нужно ограничить синхронизацию одним проектом или секцией Todoist.

`.env` не хранится в git.

Рекомендуется создать в Todoist отдельный проект `Life OS` и указать его `TODOIST_PROJECT_ID`, иначе импорт заберет все активные задачи Todoist.

### Команды

```bash
npm run lifeos -- task add "Купить витамины"
```

Добавляет задачу в `inbox.md` и создает ее в Todoist без дублей.

```bash
npm run lifeos -- task done "Купить витамины"
```

Отмечает задачу выполненной в Todoist и удаляет ее из `inbox.md`.

```bash
npm run lifeos -- today
```

Показывает текущие фокусы из `areas.md`, активные задачи Todoist и `inbox.md`.

```bash
npm run lifeos -- daily
```

Показывает заготовку ежедневного обзора: фокусы, задачи, inbox, проекты и три главных действия дня.

```bash
npm run lifeos -- projects dashboard
```

Показывает сводку по проектам: статус, дедлайн, результат, следующий шаг, риски, открытые вопросы, последние встречи, решения и связанные задачи Todoist.

```bash
npm run lifeos -- save "Daily review"
```

Сохраняет текущие изменения в git и отправляет их в GitHub.

```bash
npm run lifeos -- server on
```

Включает серверный режим: запрещает сон Mac и загружает фоновые агенты синхронизации LifeOS.

```bash
npm run lifeos -- server off
```

Выключает серверный режим: выгружает фоновые агенты и возвращает обычный сон Mac.

```bash
npm run lifeos -- server status
```

Показывает, отключен ли сон и загружены ли фоновые агенты.

```bash
npm run lifeos -- inbox add "Позвонить родителям"
```

Добавляет строку в `inbox.md`.

```bash
npm run lifeos -- todoist projects
```

Показывает проекты Todoist и их id для настройки `TODOIST_PROJECT_ID`.

```bash
npm run lifeos -- todoist list
```

Показывает активные задачи выбранного проекта Todoist и их id.

```bash
npm run lifeos -- todoist pull
```

Добавляет задачи из Todoist в `inbox.md`.

```bash
npm run lifeos -- todoist push-inbox
```

Создает задачи Todoist из текущих пунктов `inbox.md`. Уже существующие задачи в выбранном проекте Todoist пропускаются по совпадению текста.

```bash
npm run lifeos -- todoist complete "Позвонить родителям"
```

Отмечает задачу Todoist выполненной. Сначала ищет точное совпадение, затем частичное. Если найдено несколько задач, просит уточнить текст.

```bash
npm run lifeos -- todoist sync
```

Выполняет двустороннюю синхронизацию: убирает из `inbox.md` задачи, которые были закрыты в Todoist, затем Todoist -> `inbox.md`, затем `inbox.md` -> Todoist, затем показывает `git status`.

Фоновый агент Life OS выполняет этот sync раз в час, когда включен серверный режим.

```bash
npm run lifeos -- git sync
```

Подтягивает изменения из GitHub и показывает локальный статус.

## Notion interface

Notion используется как простой внешний интерфейс для проектов. Источник правды остается в markdown/Todoist, а Notion получает удобные страницы для просмотра на iPhone и Mac.

Короткая инструкция: `notion.md`.

### Настройка

1. В Notion создай страницу `Life OS`.
2. Создай Notion integration и дай ей доступ к странице `Life OS`.
3. В `.env` добавь:

```bash
NOTION_API_TOKEN=
NOTION_PARENT_PAGE_ID=
```

`NOTION_PARENT_PAGE_ID` - id страницы `Life OS` из URL Notion.

### Sync

```bash
npm run lifeos -- notion sync
```

Команда создает/обновляет страницу `Life OS Projects` и отдельные страницы проектов внутри нее:

- статус;
- дедлайн;
- результат;
- следующий шаг;
- задачи Todoist;
- риски;
- открытые вопросы;
- последние решения;
- связанные события календаря.

Notion не редактируется обратно в Life OS. Это намеренно: пока Notion - интерфейс для чтения и ориентации, а не второй источник правды.

## Следующие шаги подключения

1. Создать приватный git-репозиторий на GitHub или GitLab.
2. Подключить remote к локальному `life-os`.
3. Настроить синхронизацию с iPhone через Git-клиент или Shortcuts.
4. Добавить быстрый ввод в `inbox.md` с телефона.
5. Подключать календарь, задачи и здоровье по одному источнику.
