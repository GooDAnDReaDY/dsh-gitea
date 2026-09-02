/**
 * pr-templates-branch: дефолтный body PR по типу ветки
 * (feat/, fix/, docs/, chore/). Используется issue-flow, если body не задан.
 */

function branchType(branch = '') {
  const b = String(branch || '')
  if (/^fix\//.test(b)) return 'fix'
  if (/^docs?\//.test(b)) return 'docs'
  if (/^chore\//.test(b)) return 'chore'
  if (/^feat\//.test(b)) return 'feat'
  if (/^refactor\//.test(b)) return 'refactor'
  return 'generic'
}

const TEMPLATES = {
  feat: ({ number, title }) => `## What / Summary

${title || ''}

- Задача: #${number || ''}
- Область: новый функционал

## Changes

- ...

## Testing

- [ ] Тесты добавлены/обновлены
- [ ] Локальный прогон ` + '`npm test`' + ` зелёный

Closes #${number || ''}`,
  fix: ({ number, title }) => `## Problem

${title || ''}

- Задача: #${number || ''}
- Тип: исправление

## Root cause

...

## Fix

- ...

## Verification

- [ ] Репродукция пройдена
- [ ] Регрессионные тесты зелёные

Closes #${number || ''}`,
  docs: ({ number }) => `## Documentation

Обновление документации.

Closes #${number || ''}`,
  chore: ({ number }) => `## Chore

Инфраструктурное/служебное изменение.

Closes #${number || ''}`,
  refactor: ({ number }) => `## Refactor

Без изменения поведения.

Closes #${number || ''}`,
  generic: ({ number }) => `Closes #${number || ''}`,
}

export function templateForBranch(branch = '', { number = '', title = '' } = {}) {
  const type = branchType(branch)
  const fn = TEMPLATES[type] || TEMPLATES.generic
  return fn({ number, title })
}
