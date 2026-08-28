import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPrTemplate, needsRiskChecklist, REQUIRED_SECTIONS } from '../lib/pr-templates.js'

test('REQUIRED_SECTIONS covers template sections', () => {
  assert.ok(REQUIRED_SECTIONS.includes('Что изменено'))
  assert.ok(REQUIRED_SECTIONS.includes('Связанная задача'))
  assert.ok(REQUIRED_SECTIONS.includes('Проверки'))
})

test('checkPrTemplate passes when body covers sections', () => {
  const body = `## Что изменено
x

## Связанная задача
#16

## Пользовательский эффект
y

## Проверки
- [ ] Unit

## Безопасность
- [ ] Нет секретов

## Документация
- [ ] README
`
  const r = checkPrTemplate(body)
  assert.equal(r.ok, true, r.missing.join(','))
  assert.equal(r.missing.length, 0)
})

test('checkPrTemplate reports missing sections', () => {
  const r = checkPrTemplate('## Что изменено\nx')
  assert.ok(r.missing.length > 0)
  assert.ok(r.missing.includes('Проверки'))
})

test('needsRiskChecklist true for risk labels', () => {
  assert.equal(needsRiskChecklist(['risk/breaking']), true)
  assert.equal(needsRiskChecklist(['type/feature']), false)
})
