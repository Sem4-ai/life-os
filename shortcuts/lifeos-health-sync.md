# Life OS Health Sync Shortcut

Готовая схема iPhone Shortcut для выгрузки Apple Health / Apple Watch в Life OS.

## Что делает

- Берет показатели здоровья за сегодня.
- Собирает JSON.
- Кодирует JSON в base64, чтобы не ломаться на кавычках.
- Отправляет на Mac через SSH.
- Mac обновляет `health.md`, синхронизирует Obsidian и сохраняет изменения в git.

## Название Shortcut

`Life OS Health Sync`

## Показатели

Передаем:

- `date`
- `sleepHours`
- `steps`
- `activeEnergyKcal`
- `exerciseMinutes`
- `standHours`
- `restingHeartRate`
- `hrvMs`
- `weightKg`
- `source`

## Действия в Shortcuts

### 1. Date

Action: `Date`

Значение: `Current Date`

### 2. Format Date

Action: `Format Date`

- Date: `Current Date`
- Format: `Custom`
- Format String: `yyyy-MM-dd`

Сохрани результат в переменную `date`.

### 3. Сон

Action: `Find Health Samples`

- Type: `Sleep`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Group by: `Day`

Дальше:

- взять duration/sum за сегодня;
- перевести в часы;
- сохранить в `sleepHours`.

Если iOS не дает удобно посчитать часы сна в твоей версии Shortcuts, оставь `sleepHours` пустым на первом запуске. Life OS примет `null`.

### 4. Шаги

Action: `Find Health Samples`

- Type: `Steps`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Group by: `Day`

Сумма -> переменная `steps`.

### 5. Активная энергия

Action: `Find Health Samples`

- Type: `Active Energy`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Group by: `Day`

Сумма в kcal -> переменная `activeEnergyKcal`.

### 6. Минуты упражнений

Action: `Find Health Samples`

- Type: `Exercise Minutes`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Group by: `Day`

Сумма -> переменная `exerciseMinutes`.

### 7. Часы стоя

Action: `Find Health Samples`

- Type: `Stand Hours`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Group by: `Day`

Сумма -> переменная `standHours`.

### 8. Пульс покоя

Action: `Find Health Samples`

- Type: `Resting Heart Rate`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Sort by: `Start Date`
- Order: `Latest First`
- Limit: `1`

Value -> переменная `restingHeartRate`.

### 9. HRV

Action: `Find Health Samples`

- Type: `Heart Rate Variability`
- Start Date: `Today at 00:00`
- End Date: `Current Date`
- Sort by: `Start Date`
- Order: `Latest First`
- Limit: `1`

Value in ms -> переменная `hrvMs`.

### 10. Вес

Action: `Find Health Samples`

- Type: `Body Mass`
- Sort by: `Start Date`
- Order: `Latest First`
- Limit: `1`

Value in kg -> переменная `weightKg`.

### 11. Собрать JSON

Action: `Dictionary`

Поля:

- `date`: `date`
- `sleepHours`: `sleepHours`
- `steps`: `steps`
- `activeEnergyKcal`: `activeEnergyKcal`
- `exerciseMinutes`: `exerciseMinutes`
- `standHours`: `standHours`
- `restingHeartRate`: `restingHeartRate`
- `hrvMs`: `hrvMs`
- `weightKg`: `weightKg`
- `source`: `Apple Health / Apple Watch / iPhone Shortcut`

Action: `Get Dictionary from Input`

Action: `Get Text from Input`

Сохрани результат в переменную `healthJson`.

### 12. Base64

Action: `Base64 Encode`

- Input: `healthJson`
- Mode: `Encode`

Сохрани результат в переменную `healthJsonBase64`.

### 13. Run Script Over SSH

Action: `Run Script Over SSH`

Настройки:

- Host: IP или hostname твоего Mac в локальной сети.
- User: `grachev90`
- Authentication: SSH key или пароль.

Script:

```bash
cd /Users/grachev90/life-os
PATH=/Users/grachev90/.nvm/versions/node/v24.14.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin node scripts/lifeos-health-from-shortcut.mjs --base64 'PASTE_BASE64_VARIABLE_HERE'
```

Вместо `PASTE_BASE64_VARIABLE_HERE` вставь переменную Shortcuts `healthJsonBase64`.

## Расписание раз в 3 часа

В iOS Shortcuts это делается через Personal Automation:

- `00:00` -> Run Shortcut `Life OS Health Sync`
- `03:00` -> Run Shortcut `Life OS Health Sync`
- `06:00` -> Run Shortcut `Life OS Health Sync`
- `09:00` -> Run Shortcut `Life OS Health Sync`
- `12:00` -> Run Shortcut `Life OS Health Sync`
- `15:00` -> Run Shortcut `Life OS Health Sync`
- `18:00` -> Run Shortcut `Life OS Health Sync`
- `21:00` -> Run Shortcut `Life OS Health Sync`

Для каждой автоматизации:

- Turn off `Ask Before Running`.
- Turn off `Notify When Run`, если не хочешь лишних уведомлений.

## Проверка

На iPhone запусти Shortcut вручную.

Потом на Mac:

```bash
cd /Users/grachev90/life-os
npm run lifeos -- health latest
git status --short
```

Если все хорошо, `health.md` будет обновлен, а изменения уйдут в git командой `save` внутри SSH-скрипта.

Для теста без git commit можно на Mac вручную вызвать обработчик с флагом `--no-save`.
