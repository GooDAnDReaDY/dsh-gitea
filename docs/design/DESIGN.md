# DESIGN.md — dsh-gitea

## Product / Purpose
- **Назначение**: Полноценная интеграция DeepSeek Harness с Git-кузницами Gitea и Forgejo — управление репозиториями, задачами, пул-реквестами, ревью, проверками безопасности и визуальным статусом репозитория в чате.
- **Аудитория**: Разработчики и автономные агенты, работающие в среде DeepSeek Harness.
- **Статус**: В активной разработке. Текущая базовая версия — 0.5.2.

---

## User Surfaces
- **Web/UI**:
  - Чат-чип Git-статуса (`dgt-git-chip`) в hero-строке ввода чата (название ветки, индикаторы `dirty`, опережение/отставание `ahead/behind`, номер активного PR).
  - Выдвижной нативный **Sidebar Drawer** (`GitSidebarDrawer` / Git Inspector) с правого края экрана:
    - Вкладка **Status**: ветка, remote-синхронизация (`ahead/behind`), список измененных/неотслеживаемых файлов, быстрый manual refresh.
    - Вкладка **Graph & CI**: топологический моноширинный граф коммитов, OID-ссылки в веб-интерфейс Gitea, живые бейджи CI Gitea Actions (`success`, `failure`, `running`).
    - Вкладка **Events & PRs**: лента входящих вебхук-событий репозитория и активный PR.
- **DSH UI / settings / slots**:
  - Карточка настроек плагина `settings.plugin.item`: полная поддержка всех 17 параметров схемы `Config`. Основные параметры (`baseUrl`, `tokenEnv` credential-ref, `defaultOwner`, `defaultRepo`) выведены на первый экран; расширенные параметры (`gitWrapper`, `dodReminder`, `forceHttpsUrls`, `timeoutMs`, `webhookSecretEnv`, `notifyWebhook`, `bgScheduler*`, `instances`) сгруппированы в раскрывающейся секции. Поддержка `settingsScope` с проверкой состояний (`loading`, `unavailable`, `ready`), изолированная регистрация словарей с защитой от повторного вызова и безопасное чтение сервисов через `ctx.get`.
- **API / Agent Tools**:
  - 57 специализированных инструментов `gitea_*` для агентов (PR, issues, reviews, releases, policies, analytics, git-snapshot, git-graph).
- **CLI**:
  - Управление через CLI-интерфейс `dsh plugin --profile web <add|remove|list>`.
- **Документация**:
  - Трёхъязычная документация: `README.md` (EN), `docs/README.ru.md` (RU), `docs/README.zh.md` (ZH), changelog и планы разработки.

---

## Visual Direction
- **Атмосфера**: Утилитарная, точная, информативная инженерная панель. Отсутствие декоративного визуального мусора, уважение к токенам темы DSH.
- **Утверждённые референсы**:
  - `dsh-git-graph`: легковесный моноширинный граф коммитов (`computeLanes`), портальное монтирование в hero-строку, межвкладочный лидер для событий.
- **Не копировать**:
  - Не копировать управление сессиями, изолированными воркдеревьями и карточками задач — это прерогатива `dsh-kanban`.
  - Никаких тяжелых сторонних Canvas/SVG библиотек визуализации графов.

---

## Foundations
- **Цвета и роли**:
  - Использование официальных CSS-переменных DSH темы: `--dsw-alias-bg-base`, `--dsw-alias-bg-layer-1..3`, `--dsw-alias-border-l1..2`, `--dsw-alias-label-primary`, `--dsw-alias-label-secondary`.
  - Статусы: успех (`--dsw-alias-state-success-primary`), предупреждение/изменения (`--dsw-alias-state-warning-primary`), ошибка (`--dsw-alias-label-error`).
- **Типографика**:
  - Системный стек шрифтов DSH для текста и заголовков.
  - Моноширинный шрифт (`ui-monospace`, `monospace`) для хешей коммитов, веток и дорожек графа.
- **Сетка и отступы**:
  - Компактный паддинг чипа (4px 8px, border-radius 999px).
  - Модальное окно графа коммитов с адаптивной шириной (до 85vw / 720px) и виртуальной/постраничной прокруткой.
- **Accessibility**:
  - Чёткие `aria-label`, роли `dialog`, `button`, фокус-ловушки и закрытие по клавише `Esc` и клику на подложку (Backdrop).

---

## Components And States
- **Git Status Chip**:
  - Состояния:
    - `loading`: приглушённый скелетон или скрыт до определения репозитория.
    - `clean`: ветка без незакоммиченных правок, синхронизирована с апстримом.
    - `dirty`: жёлтый бордер/текст с индикацией количества изменённых файлов.
    - `sync`: бейджи `↑ahead` / `↓behind` относительно `origin/<branch>`.
    - `empty`: если текущая сессия не находится внутри Git-каталога, чип не загромождает экран.
- **Commit Graph Modal**:
  - Заголовок с названием ветки и репозитория, счётчиком коммитов и кнопкой закрытия.
  - Список коммитов с колонкой дорожек (глифы `●`, `◆`, `│`, ` `).
  - Ссылки на коммиты в Gitea Web UI.
  - Бейджи статуса CI (Success/Failure/Pending).
  - Кнопка «Загрузить ещё» (пагинация).

---

## User Flows
1. **Просмотр состояния репозитория в чате**:
   - Пользователь или агент работает в рабочей директории.
   - Чип в hero-строке мгновенно отражает текущую ветку, статус изменений и расхождение с удалённым репозиторием Gitea.
2. **Инспекция истории коммитов и сборок**:
   - Клик на чип открывает модальное окно графа коммитов.
   - Пользователь видит структуру веток, слияний, последние коммиты и прошёл ли CI в Gitea Actions.
   - Клик на OID коммита открывает его страницу в Gitea.

---

## Do / Don't
- **Do**:
  - Использовать только токены темы DSH (адаптация к темной и светлой теме).
  - Нормализовать все пути для одинаковой работы на Linux и Windows.
  - Использовать единый межвкладочный канал событий через Web Locks / BroadcastChannel.
- **Don't**:
  - Не смешивать функционал задач и досок — канбан живет в `dsh-kanban`.
  - Не внедрять тяжелые рантайм-зависимости.
  - Не делать жестко зашитых URL или стилей без поддержки темы.

## UI Standards Alignment (v0.6.2)
- Aligned card design with `dsh-clinebot` pattern.
- Wrapped user settings form inside `ErrorBoundary` to ensure graceful degradation.
- Interactive SVG `Chevron` indicator with smooth CSS rotation.
- Status badges: token configuration status (`.dgt-badgeOk`, `.dgt-badgeBad`), host availability status.
- Strict localization enforcement: zero hardcoded Russian strings in components.

## Performance & Reliability Engineering (v0.6.3)
- Canonical style tag attribute `data-dsh-plugin="dsh-gitea"` guards stylesheets against cleaner sweeps.
- Visibility-aware polling pauses network calls and `git` child processes when tab is hidden.
- Parallelized `git` status snapshotting cuts response latency by ~50%.
- In-memory TTL caching on `GiteaClient` eliminates redundant roundtrips for stable endpoints.

## Sidebar Drawer Architecture (v0.7.0 / Phase 1)
- 2026-09-13 — Переход от всплывающего модального окна графа к выдвижному Sidebar Drawer; причина: модальное окно прерывало диалог с агентом и блокировало экран; выдвижная боковая панель справа позволяет одновременно работать в чате и инспектировать статус репозитория, diff и CI.
- Интегрированы 3 вкладки (Status, Graph & CI, Events & PRs) в единую выдвижную панель `GitSidebarDrawer` с плавной CSS-анимацией выезда.
- Поддержка закрытия по `Esc`, доступности (`aria-modal`, `role="dialog"`), токенов темы DSH и кнопки принудительного обновления статуса.

### 4.8 Phase 2: Agent Tools Extension (v0.7.1)
- `gitea_pr_diff`: Exposes raw Git unified diff (`application/vnd.gitea.diff`) or structured summary statistics (`filesCount`, `additions`, `deletions`, `files`).
- `gitea_reactions`: Full support for Gitea Issue and Comment reaction management (`+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`).
- `gitea_issue_timeline`: Complete audit trail of issue events and discussions.

### 4.9 Phase 3: HTTP 304 ETag Caching (v0.7.2)
- Stores `etag` in client cache entries.
- Emits `If-None-Match` on revalidation.
- Transparently handles HTTP 304 with instant TTL renewal.

### 4.10 Phase 4: Inbound Webhook Gateway (v0.7.3)
- `POST /dsh-gitea/webhook`: Ingests real-time events from Gitea webhooks.
- Validates `X-Gitea-Signature` or `X-Hub-Signature-256` using HMAC-SHA256.
- Supports `push`, `pull_request`, `issue_comment`, `release`, and `actions/workflow_run` events in `EventStore`.

### 4.11 Localization Standard Compliance (v0.7.4)
- Canonical base language: English (`en`).
- Mandatory embedded user locale: Chinese (`zh`).
- Russian (`ru`) localization delegated exclusively to the external `dsh-russian-lang` translation plugin.

### 4.12 Strict Server Compliance & Package Boundaries (v0.7.5)
- **Canonical English Server Half**: Zero Cyrillic characters across all modules in `lib/`. All tool output contracts, validation error messages, planning notes, and internal JSDoc comments are strictly canonical English. Multilingual aliases preserved in input regex matchers for issue and PR body parsing.
- **Clean Package Boundaries**: Standalone issue form templates moved to `assets/issue-templates/`. `package.json.files` strictly excludes `.gitea/` and internal `docs/superpowers` from published npm packages. All files remain strictly under 256 KiB.
- **Automated Quality Gate**: Continuous test suite enforces zero Cyrillic characters in `lib/` and clean npm packaging allowlist.

### 4.13 Hardened HTTP Guard for Write Endpoints (#217)
- **Strict Write Route Protection**: All mutating HTTP endpoints (such as `POST /dsh-gitea/config`) are guarded by `lib/http-guard.js`.
- **Origin & Host Verification**: Verifies `Origin` and `Referer` headers to ensure the requesting host matches the `Host` header. Rejects `origin: "null"` and cross-site/same-site `Sec-Fetch-Site`.
- **Loopback Enforcement**: Requests lacking `Sec-Fetch-Site` or `Origin` (curl, scripts, local tooling) are allowed only from loopback IP addresses (`127.0.0.1`, `::1`). Remote/cross-network callers without verified origin credentials receive HTTP 403 Forbidden (`Forbidden: same-origin or local loopback only`).

### 4.6 Telemetry & Events Composition Service (`giteaEvents`)

- **Provider**: `dsh-gitea` exports `ctx.provide(giteaEvents, giteaEventsService)` and `ctx.giteaEvents`.
- **Consumer**: `@goodandready/dsh-pulse` injects `[giteaEvents]` and registers `subscribe(listener)`.
- **Data safety**: Redacts all credentials, auth headers, webhook secrets, raw bodies, and comments. Only emits stable metadata:
  ```json
  {
    "id": "event-uuid-or-type-ts",
    "event": "pull_request",
    "action": "opened",
    "at": "2026-09-17T14:00:00.000Z",
    "giteaContext": {
      "owner": "goodandready",
      "repo": "app",
      "issue": null,
      "pull": 42,
      "project": null,
      "ref": "feat/login"
    }
  }
  ```
- **Subscriber isolation**: Any error thrown by a listener is safely caught.

### 4.7 One-Click Plugin Auto-Updater

- **Endpoint**: `/api/dsh-gitea/update`
- **Methods**:
  - `GET`: Returns JSON `{ packageName, currentVersion, latestVersion, updateAvailable, canAutoUpdate, profileName }`.
  - `POST`: Installs exact version via DSH CLI in background. Requires `x-dsh-plugin-update: 1`, loopback IP (`127.0.0.1` / `::1`), and matching origin/host.
- **Quarantine**: Retains official pnpm release age policy (does not disable with minimumReleaseAge=0).
- **Semver**: Handles prerelease transitions (`-rc.1`, `-beta.2`) accurately.
- **UI**: Integrated directly into GiteaPluginCard with checking/updating states and restart banner.


## 12. Архитектура клиентского бандла и декомпозиция модулей (Client Bundle Architecture & Monolith Rationale)

### 12.1 Декомпозиция серверной точки входа (`lib/routes.js`)
- В рамках устранения замечаний автоматического аудита (issue #221) серверная точка входа `lib/index.js` декомпозирована с 611 до 380 строк кода (строго < 600 строк).
- Регистрация и обслуживание всех внешних HTTP-эндпоинтов плагина вынесены в модуль `lib/routes.js` (273 строки):
  - `GET/POST /dsh-gitea/config` (защищено `isTrustedWriteRequest` из `lib/http-guard.js`);
  - `POST /dsh-gitea/webhook` (валидация HMAC-SHA256 подписи `X-Gitea-Signature`);
  - `GET /dsh-gitea/events` (чтение ленты входящих событий `EventStore`);
  - `GET /dsh-gitea/git-status` (получение снимка локального git-статуса и обогащение PR/CI);
  - `GET /dsh-gitea/git-graph` (построение топологического графа коммитов репозитория).
- В `lib/routes.js` также инкапсулированы транспортные функции `writeJson` и потокового чтения `readBody` с проверкой лимита размера payload.
- Модуль `lib/routes.js` полностью изолирован от внешних peerDependencies ядра DSH (`tokenConfigured` и `resolveToken` инжектируются через `options`), что гарантирует возможность независимого модульного тестирования в чистом Node.js окружении без запущенного харнесса.

### 12.2 Обоснование сохранения монолитного клиентского бандла `lib/client.js`
- **Рантайм-контракт DSH ModuleLoader**: Клиентская часть плагина загружается браузерным рантаймом DSH напрямую через вызов:
  ```js
  window.__ModuleLoader__.load({ id: '@goodandready/dsh-gitea', factory: ... })
  ```
- **Отсутствие браузерного резолвера**: Браузерный модуль DSH не предоставляет механизма разрешения относительных путей для раздельных модулей (`require('./submodule.js')` или нативные динамические импорты локальных файлов бандла внутри изолированного sandbox-контекста DSH не поддерживаются).
- **Принцип Ponytail / YAGNI**: Внедрение тяжелого внешнего сборщика (Webpack, Vite, Rollup, esbuild) исключительно ради искусственного дробления файла на файлы < 600 строк:
  1. Добавило бы десятки транзитивных зависимостей в проект;
  2. Усложнило бы жизненный цикл сборки, увеличив время `npm test` и риск рассинхронизации HMR в режиме живой разработки на сервере MiniPC;
  3. Противоречит инженерному стандарту `dsh-plugin-authoring` ("код, который обязан оставаться единым из-за контракта DSH, разрешено оставлять цельным при наличии архитектурного обоснования в DESIGN.md").
- **Прецедент**: Полностью аналогичное архитектурное решение принято и зафиксировано в смежном системном плагине `dsh-context-lens` (issue #69, коммит `f460fdd`).
- **Область ответственности `lib/client.js`**: Файл (~1390 строк) содержит единую непротиворечивую кодовую базу интерфейса пользователя: статус-чип hero-строки (`dgt-git-chip`), боковую шторку инспектора (`GitSidebarDrawer`), вкладки Status, Graph & CI, Events & PRs, и компонент настроек `settings.plugin.item`. Файл не имеет внешних npm-зависимостей, кроме React/DSH API, и не требует декомпозиции до появления нативного ESM-загрузчика плагинов в ядре DSH.

### 12.3 Обоснование объёма специализированных модулей
1. **`lib/handlers.js` (~805 строк)**:
   - Служит единой точкой диспетчеризации и выполнения для 57 специализированных инструментов агента `gitea_*`.
   - Дробление каждого легковесного обработчика в отдельный файл (57 отдельных файлов) привело бы к колоссальному раздуванию boilerplate-кода, циклическому импорту зависимостей и затруднению сквозного поиска и аудита без какой-либо архитектурной пользы.
2. **`lib/tool-defs.js` (~756 строк)**:
   - Представляет собой чистую декларативную спецификацию параметров, метаданных и схем Schemastery/JSON-Schema для 57 инструментов.
   - Согласно стандарту `dsh-plugin-authoring` ("Сгенерированные файлы, декларации, схемы, fixtures и код, который обязан оставаться единым из-за контракта DSH, также можно оставить цельным"), декларативные реестры схем не требуют принудительного дробления.
3. **`lib/gitea-client.js` (~611 строк)**:
   - Является типизированным HTTP-клиентом для REST API Gitea и Forgejo, реализующим методы работы с Issues, Pull Requests, Reviews, Commits, Statuses, Reactions, Releases и Webhooks.
   - Размер файла находится на границе порога (611 строк, расхождение менее 2% от 600 строк), монолитность клиента обеспечивает целостность работы с ETag-кэшем, повторными попытками (retry) и сериализацией запросов.

## 13. Safe Issue Comment Lifecycle (Issue Comment Deletion & Ownership Recognition)

### 13.1 Context & Problem
Autonomous agents frequently publish verdicts, reviews, and progress reports into Gitea issue threads. Due to network retries, tool misunderstandings, or racing subagents, comments were occasionally posted multiple times (e.g. duplicate verdict reports in `dsh-goal#59`). Previously:
1. `gitea_issue_comments` returned raw comment objects without authorship classification, forcing agents to make redundant verification calls.
2. No comment deletion tool was available to agents, leaving duplicate comments in the public issue tracker until human intervention.

### 13.2 Architecture & Safety Invariants
To maintain tracker hygiene without introducing destructive risks:
- **Authorship Annotation (`mine: true/false`)**:
  - `gitea_issue_comments` and `gitea_issue_get` automatically query the authenticated user via `getUser()` (cached) and attach `mine: true` or `mine: false` to each comment entry.
  - Formatted text output renders `**<user>** (you)` for easy visual distinction by LLM agents.
- **Mandatory Confirmation & Dry-Run Preview**:
  - `gitea_issue_comment_delete` requires `confirm: true`.
  - When `confirm` is omitted or false, the tool performs a dry-run returning the target comment ID, repository, author login, creation timestamp, and first 80 characters of the comment body without calling the DELETE API.
- **Strict Authorization Guard**:
  - Only comments authored by the current token's authenticated user (`getUser()`) can be deleted.
  - Attempting to delete a comment authored by another user fails immediately with a descriptive rejection message (`Refusing to delete comment #... by '...': only comments authored by the authenticated user ('...') can be deleted.`), preventing accidental or malicious deletion of third-party comments.
