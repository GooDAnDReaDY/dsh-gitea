import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lintIssue, PRESETS, REQUIRED_SECTIONS } from '../lib/issue-lint.js'

test('PRESETS define bug, feature, and chore presets', () => {
  assert.ok(PRESETS.bug)
  assert.ok(PRESETS.feature)
  assert.ok(PRESETS.chore)
  assert.ok(Array.isArray(PRESETS.bug.sections) && PRESETS.bug.sections.length > 0)
})

test('REQUIRED_SECTIONS lists canonical checkable sections', () => {
  for (const s of ['Проблема/Цель', 'Факты', 'Влияние', 'Приоритет', 'DoD']) {
    assert.ok(REQUIRED_SECTIONS.includes(s), `missing ${s}`)
  }
})

test('lintIssue returns missing sections for empty body', () => {
  const r = lintIssue({ title: 'Test', body: '' }, { preset: 'bug' })
  assert.equal(r.ok, false)
  assert.ok(r.missing.length > 0)
  assert.ok(Array.isArray(r.suggestions))
})

test('lintIssue passes when body covers preset sections', () => {
  const body = `## Что произошло
Ошибка при создании issue.

## Ожидалось
Работает корректно.

## Шаги воспроизведения
1. Шаг
2. Шаг

## Окружение
v0.2.11

## Влияние
Блокирует работу.

## Definition of Done
- [ ] Тест
`
  const r = lintIssue({ title: 'Bug: x', body }, { preset: 'bug' })
  assert.equal(r.ok, true, JSON.stringify(r.missing))
  assert.equal(r.missing.length, 0)
})

test('lintIssue does not block when policy allows creation', () => {
  const r = lintIssue({ title: 'x', body: '' }, { preset: 'feature', block: false })
  // lint reports missing but ok (non-blocking)
  assert.equal(r.ok, false)
  assert.ok(r.missing.length > 0)
})

test('lintIssue accepts explicit sections even for unknown preset', () => {
  const body = `## Проблема
Что-то

## Влияние
Да

## DoD
- [ ] done
`
  const r = lintIssue({ title: 'x', body }, { preset: 'unknown' })
  assert.equal(r.ok, true)
})
