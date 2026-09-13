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
