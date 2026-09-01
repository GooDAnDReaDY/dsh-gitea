# 📦 @goodandready/dsh-gitea

<div align="center">

<h3>Корпоративная интеграция Gitea и Forgejo для DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-gitea"><img src="https://img.shields.io/npm/v/@goodandready/dsh-gitea.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GooDAnDReaDY/dsh-gitea.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/Все_проекты_автора-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="Все проекты автора"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ Обзор и решаемая проблема

При выполнении масштабных задач автономной разработки в DeepSeek Harness агентам необходим полноценный доступ к трекеру задач (Issues), созданию и ревью пул-реквестов (PR), управлению ветками и изоляции рабочих сред (Worktrees). Без специализированного плагина агент вынужден выполнять «грязные» правки напрямую в рабочей ветке или обращаться к сторонним CLI без контроля прав доступа.

**`@goodandready/dsh-gitea`** обеспечивает бесшовную интеграцию DeepSeek Harness с серверами **Gitea** и **Forgejo**. Плагин предоставляет агенту 20+ типизированных инструментов, добавляет живой **Git Status Chip** в шапку веб-интерфейса чата и защищает репозиторий барьерами безопасности (требование `confirm: true` для слияния и удаления).

---

## 🏗️ Архитектура

```mermaid
graph LR
    subgraph DSH ["DeepSeek Harness"]
        UI["Шапка чата Web UI<br/>(Git Status Chip)"]
        Agent["Автономный агент<br/>(20+ инструментов Gitea)"]
        Creds["Хранилище Credentials<br/>(Ссылка на GITEA_TOKEN)"]
    end

    subgraph Plugin ["Плагин dsh-gitea"]
        ChipPoller["/git-status API<br/>Инспектор веток и Diff"]
        Client["GiteaClient<br/>(REST API v1)"]
        WorktreeMgr["Менеджер Worktree<br/>(Изолированные задачи)"]
    end

    subgraph Server ["Сервер версий"]
        Gitea["Gitea / Forgejo Server<br/>(Задачи, PR, Метки, Вехи)"]
        GitRepo["Git Репозиторий<br/>(Ветки и Worktrees)"]
    end

    UI -->|Опрос статуса| ChipPoller
    ChipPoller -->|Чтение статуса| GitRepo
    Agent -->|Вызов инструментов| Client
    Agent -->|Управление ветками| WorktreeMgr
    WorktreeMgr -->|git worktree| GitRepo
    Client -->|Авторизованный REST| Gitea
    Creds -.->|Разрешение в памяти| Client
```

---

## ✨ Исчерпывающий разбор возможностей

### 1. Набор из 20+ инструментов агента

Все инструменты автоматически определяют владельца (`owner`) и имя репозитория (`repo`) из адреса `git remote get-url origin` активной рабочей области, если агент не указал их явно.

| Инструмент | Категория | Назначение | Контроль безопасности |
|:---|:---|:---|:---|
| `gitea_issue_create` | Задачи | Создание новой задачи с заголовком, описанием, метками и исполнителями | - |
| `gitea_issue_list` | Задачи | Список задач с фильтрацией по статусу (`open`/`closed`), вехам и меткам | - |
| `gitea_issue_get` | Задачи | Получение полной информации о задаче по её номеру | - |
| `gitea_issue_comment`| Задачи | Добавление комментариев, отчётов о прогрессе и ревью | - |
| `gitea_issue_update` | Задачи | Редактирование заголовка, тела или статуса задачи | - |
| `gitea_issue_close`  | Задачи | Закрытие выполненной задачи | - |
| `gitea_issue_search` | Задачи | Полнотекстовый поиск по задачам репозитория/инстанса | - |
| `gitea_issue_set_labels` | Метки | Замена или обновление меток задачи | - |
| `gitea_issue_set_assignee` | Команда | Назначение ответственных разработчиков или агентов | - |
| `gitea_label_list`   | Метки | Список всех меток репозитория с цветами | - |
| `gitea_label_create` | Метки | Создание новой метки | - |
| `gitea_label_delete` | Метки | Удаление метки | - |
| `gitea_milestone_list` | Вехи | Список вех проекта и процент их готовности | - |
| `gitea_milestone_create` | Вехи | Создание новой вехи с датой релиза | - |
| `gitea_pr_create`    | Пул-реквесты | Открытие PR из рабочей ветки в целевую | - |
| `gitea_pr_list`      | Пул-реквесты | Список открытых и закрытых PR | - |
| `gitea_pr_get`       | Пул-реквесты | Получение сводки изменений, ревью и статусов проверок | - |
| `gitea_pr_comment`   | Пул-реквесты | Построчные комментарии к коду и обсуждение PR | - |
| `gitea_pr_merge`     | Пул-реквесты | Слияние PR (merge / rebase / squash) | ⚠️ Требуется `confirm: true` |
| `gitea_worktree_list`| Worktree | Список активных изолированных воркдеревьев | - |
| `gitea_worktree_add` | Worktree | Создание изолированного рабочего дерева для отдельной задачи | - |
| `gitea_worktree_use` | Worktree | Переключение контекста сессии в директорию воркдерева | - |
| `gitea_worktree_remove` | Worktree | Удаление и очистка завершённого воркдерева | ⚠️ Требуется `confirm: true` |
| `gitea_repo_search`  | Поиск | Поиск репозиториев по всему инстансу Gitea | - |
| `gitea_whoami`       | Профиль | Информация об авторизованном пользователе и правах | - |

---

### 2. Git Status Chip в шапке веб-интерфейса чата

Клиентский модуль встраивает динамический чип статуса Git прямо в верхнюю панель чата DSH:
* **Активный репозиторий и ветка**: отображает имя текущей ветки (например, `feature/issue-42-auth`).
* **Чистота рабочей копии**: цветной индикатор (чистое дерево vs наличие незакоммиченных правок).
* **Инспектор несохранённых изменений**: модальное окно в 1 клик с просмотром изменённых файлов и диффа строк.
* **Счётчик Ahead/Behind**: отслеживание расхождений с удалённой веткой `origin`.

---

### 3. Изоляция Worktree и безопасность агента

Для безопасного выполнения агентом параллельных задач:
* **Неразрушающие Worktree**: создание рабочих копий по пути `.worktrees/issue-<id>/` без переключения основной ветки.
* **Защита от случайных слияний**: деструктивные операции `gitea_pr_merge` и `gitea_worktree_remove` строго требуют явного параметра `confirm: true`. Неподтверждённые вызовы мгновенно блокируются.
* **Изоляция правки через Git Wrapper**: запись изменений может направляться через специальную обёртку (`gitWrapper`, например `git-deepseek-harness`), сохраняя строгую цифровую подпись агента.

---

### 4. Набор шаблонов задач Gitea Issue Templates

В комплект поставки входит готовый набор шаблонов задач `.gitea/ISSUE_TEMPLATE/`:

| Файл шаблона | Назначение | Рекомендуемые стартовые метки |
|:---|:---|:---|
| `bug.yaml` | Отчёт об ошибке (Bug report) | `type/bug`, `status/ready` |
| `feature.yaml` | Запрос новой функциональности | `type/feature`, `status/ready` |
| `security.yaml` | Отчёт об уязвимости безопасности | `type/security`, `priority/high`, `scope/security` |
| `research.yaml` | Архитектурное исследование / Spike | `type/research`, `status/ready` |
| `tech-debt.yaml` | Технический долг и рефакторинг | `type/tech-debt`, `status/ready` |
| `incident.yaml` | Отчёт об инциденте на проде | `type/incident`, `priority/critical` |
| `config-change.yaml` | Изменение конфигурации и инфраструктуры | `type/refactor`, `scope/settings`, `status/ready` |

---

## 📦 Установка

Установка через консольный клиент DeepSeek Harness:

```bash
dsh plugin --profile web add @goodandready/dsh-gitea
```

Перезапустите Web UI DSH и обновите вкладку в браузере с очисткой кэша (`Ctrl+F5` или `Cmd+Shift+R`).

---

## ⚙️ Конфигурация

Откройте **Настройки -> Плагины -> Gitea**:

```yaml
# config.yaml
dsh-gitea:
  baseUrl: "https://gitea.yourcompany.com"
  tokenEnv: "GITEA_TOKEN"
  gitWrapper: ""
  timeoutMs: 15000
```

### Таблица параметров конфигурации

| Параметр | Тип | По умолчанию | Описание |
|:---|:---|:---|:---|
| `baseUrl` | `string` | `""` | Базовый URL вашего инстанса Gitea или Forgejo (например, `https://gitea.example.com`) |
| `tokenEnv` | `string` | `"GITEA_TOKEN"` | Имя DSH Credential, содержащего персональный токен доступа |
| `gitWrapper` | `string` | `""` | Опциональный исполняемый файл обёртки для операций записи (например, `git-dsh`) |
| `timeoutMs` | `number` | `15000` | Таймаут выполнения HTTP-запросов (в миллисекундах) |

> [!IMPORTANT]
> Никогда не вставляйте сырой API-токен в поле `tokenEnv`. Токен сохраняется в зашифрованном виде в DSH Credentials, а в настройках указывается только имя ссылки.

---

## 🧪 Тестирование и верификация

Запуск полного набора юнит- и интеграционных тестов:

```bash
npm test
```

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
