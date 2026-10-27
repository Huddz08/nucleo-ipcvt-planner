import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPlannerPdf } from './exportPdf.js'
import { allRoles, createInitialState } from './planner.js'

const pageText = (pdf) => pdf.internal.pages.slice(1).map((commands) => commands.join('\n'))

test('exports every function and assigned name from the complete team into a real PDF', () => {
  const state = createInitialState()
  const pdf = buildPlannerPdf(state, { teamId: state.teams[0].id })
  const text = pageText(pdf).join('\n')
  assert.match(pdf.output(), /^%PDF-1\./)
  assert.ok(pdf.getNumberOfPages() <= 2, 'The original formation should fit in two A4 landscape pages.')
  for (const role of allRoles(state.groups)) assert.ok(text.includes(`(${role.name})`), role.name)
  for (const person of state.people) assert.ok(text.includes(`(${person.name})`), person.name)
  assert.match(text, /Sem integrante/)
  assert.equal((text.match(/\(Hudson\)/g) || []).length, 2, 'A person in two functions must appear in both.')
  assert.doesNotMatch(text, /domingos|domingo|2026-/i)
})

test('exports only the selected team and nucleus, with a summary for that nucleus', () => {
  const state = createInitialState()
  const pdf = buildPlannerPdf(state, { teamId: 'time-b', groupId: 'midia' })
  const text = pageText(pdf).join('\n')
  assert.equal(pdf.getNumberOfPages(), 1)
  assert.match(text, /\(Time B\)/)
  assert.ok(text.includes('(Mídia)'))
  assert.match(text, /0 integrantes/)
  assert.match(text, /0\/3/)
  assert.doesNotMatch(text, /\(Louvor\)|\(Time A\)|\(Hudson\)/)
  assert.throws(() => buildPlannerPdf(state, { teamId: 'missing' }), /Time não encontrado/)
  assert.throws(() => buildPlannerPdf(state, { groupId: 'missing' }), /Núcleo não encontrado/)
})

test('paginates a large roster and long notes without omitting assignments or the end of notes', () => {
  const state = createInitialState()
  state.people = Array.from({ length: 120 }, (_, index) => ({ id: `person-${index}`, name: `Integrante ${String(index).padStart(3, '0')}`, status: 'ativo' }))
  state.groups = [{ id: 'g', name: 'Equipe de apoio', color: 'sage', sections: [{ id: 's', name: 'Acolhimento', roles: [{ id: 'r', name: 'Recepção' }] }] }]
  state.teams = [{ id: 'large', name: 'Time grande', description: '', assignments: { r: state.people.map((person) => person.id) } }]
  state.notes = { large: Array.from({ length: 180 }, (_, index) => `Anotacao ${String(index).padStart(3, '0')}: uma troca de funcao para testar.`).join('\n') }
  const pdf = buildPlannerPdf(state, { teamId: 'large' })
  const pages = pageText(pdf)
  const text = pages.join('\n')
  assert.ok(pdf.getNumberOfPages() > 3)
  for (const person of state.people) assert.ok(text.includes(`(${person.name})`), person.name)
  assert.match(text, /Anotacao 179:/)
  assert.ok(pages.every((page) => page.includes('(Time grande)') && page.includes('de ')), 'Each page needs the repeated team heading and footer.')
  assert.equal((text.match(/\(Integrante 119\)/g) || []).length, 1)
})

test('exports all teams when no team is selected and preserves the caller state', () => {
  const state = createInitialState()
  const before = structuredClone(state)
  const pdf = buildPlannerPdf(state)
  const text = pageText(pdf).join('\n')
  for (const team of state.teams) assert.ok(text.includes(`(${team.name})`), team.name)
  assert.deepEqual(state, before)
})
