import test from 'node:test'
import assert from 'node:assert/strict'
import { initialAssignments } from '../data/initialAssignments.js'
import {
  STORAGE_KEY, createInitialState, applyAssignment, clearTeam, removeAssignment, removeTeam,
  validateState, normalizePlannerState, readPlannerState, allRoles, personSkills, slugify, createId,
} from './planner.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
const assigned = (state, roleId, teamId = 'time-a') => state.teams.find((team) => team.id === teamId).assignments[roleId] ?? []
const memoryStorage = (entries = {}) => {
  const values = new Map(Object.entries(entries))
  return { values, getItem: (key) => values.get(key) ?? null }
}
const withRetiredRoles = () => {
  const state = createInitialState()
  state.groups.find((group) => group.id === 'louvor').sections.find((section) => section.id === 'tecnica')
    .roles.push({ id: 'repertorio', name: 'Repertório' })
  state.groups.find((group) => group.id === 'liturgicos').sections[0]
    .roles.push({ id: 'eventos', name: 'Eventos' })
  state.teams[0].assignments.repertorio = ['joao-victor', 'liliane']
  state.teams[0].assignments.eventos = ['hudson']
  state.teams[1].assignments.repertorio = ['hudson']
  state.teams[1].assignments.eventos = []
  return state
}

test('the initial board preserves every valid legacy assignment and starts two empty teams', () => {
  const state = createInitialState()
  const knownPeople = new Set(state.people.map((person) => person.id))
  assert.equal(validateState(state), true)
  assert.deepEqual(state.groups.map((group) => group.name), ['Louvor', 'Litúrgicos', 'Mídia'])
  for (const [roleId, peopleIds] of Object.entries(initialAssignments)) {
    assert.deepEqual(assigned(state, roleId), peopleIds.filter((id) => knownPeople.has(id)))
  }
  assert.equal(assigned(state, 'projecao').includes('vitor'), false)
  assert.deepEqual(state.teams.slice(1).map((team) => team.assignments), [{}, {}])
  state.people[0].name = 'Changed'
  state.groups[0].sections[0].roles[0].name = 'Changed'
  assert.equal(createInitialState().people[0].name, 'Alexandre')
  assert.equal(createInitialState().groups[0].sections[0].roles[0].name, 'Voz Guia')
})

test('older saved boards gain an empty guide voice before soprano without changing their assignments', () => {
  const state = createInitialState()
  delete state.structureRevision
  state.groups[0].sections[0].roles = state.groups[0].sections[0].roles.filter((role) => role.id !== 'voz-guia')
  delete state.teams[0].assignments['voz-guia']
  state.notes['time-b'] = 'Preservar esta nota.'
  const before = clone(state)
  const next = readPlannerState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }))
  assert.deepEqual(next.groups[0].sections[0].roles.map((role) => role.name), ['Voz Guia', 'Soprano', 'Contralto', 'Tenor'])
  assert.deepEqual(next.teams, before.teams)
  assert.deepEqual(next.people, before.people)
  assert.deepEqual(next.notes, before.notes)
  assert.deepEqual(assigned(next, 'voz-guia'), [])
  assert.deepEqual(state, before)
  assert.equal(normalizePlannerState(next), next)
  next.groups[0].sections[0].roles.shift()
  assert.equal(normalizePlannerState(next), next)
  assert.equal(allRoles(next.groups).some((role) => role.id === 'voz-guia'), false)
})

test('guide voice migration reuses an existing custom role and preserves its people', () => {
  const state = createInitialState()
  delete state.structureRevision
  const vocal = state.groups[0].sections[0]
  vocal.roles = vocal.roles.filter((role) => role.id !== 'voz-guia')
  delete state.teams[0].assignments['voz-guia']
  vocal.roles.push({ id: 'minha-voz-guia', name: 'Voz Guia' })
  state.teams[1].assignments['minha-voz-guia'] = ['hudson']
  const next = normalizePlannerState(state)
  assert.equal(validateState(next), true)
  assert.deepEqual(next.groups[0].sections[0].roles.map((role) => role.id), ['minha-voz-guia', 'soprano', 'contralto', 'tenor'])
  assert.deepEqual(assigned(next, 'minha-voz-guia', 'time-b'), ['hudson'])
  assert.equal(next.teams, state.teams)
})

test('saved instrumental order moves violin last once while preserving assignments and prior customizations', () => {
  const state = createInitialState()
  assert.equal(state.groups[0].sections[1].roles.at(-1).id, 'violino')
  state.structureRevision = 1
  const instrumental = state.groups[0].sections[1]
  const violin = instrumental.roles.pop()
  instrumental.roles.splice(3, 0, violin)
  state.groups[0].sections[0].roles.shift()
  delete state.teams[0].assignments['voz-guia']
  const before = clone(state)
  const next = readPlannerState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }))
  assert.deepEqual(next.groups[0].sections[1].roles.map((role) => role.id), ['violao', 'guitarra', 'baixo', 'piano', 'bateria', 'violino'])
  assert.deepEqual(next.teams, before.teams)
  assert.deepEqual(next.people, before.people)
  assert.deepEqual(next.notes, before.notes)
  assert.deepEqual(next.groups[0].sections[0], before.groups[0].sections[0])
  assert.deepEqual(assigned(next, 'violino'), ['isadora'])
  assert.deepEqual(state, before)
  assert.equal(normalizePlannerState(next), next)
})

test('new boards omit retired roles and retain their members and remaining skills', () => {
  const state = createInitialState()
  const roleIds = allRoles(state.groups).map((role) => role.id)
  for (const roleId of ['repertorio', 'eventos']) {
    assert.equal(roleIds.includes(roleId), false)
    assert.equal(Object.hasOwn(initialAssignments, roleId), false)
    assert.ok(state.teams.every((team) => !Object.hasOwn(team.assignments, roleId)))
  }
  assert.ok(state.people.some((person) => person.id === 'joao-victor'))
  assert.ok(state.people.some((person) => person.id === 'liliane'))
  assert.deepEqual(personSkills('joao-victor'), ['Baixo'])
  assert.deepEqual(personSkills('liliane'), ['Contralto'])
})

test('normalizing an older v2 board retires only default roles and keeps people, custom roles, notes and settings', () => {
  const state = withRetiredRoles()
  state.groups[0].sections[2].roles.push({ id: 'repertorio-extra', name: 'Repertório' })
  state.groups[1].sections[0].roles.push({ id: 'eventos-extra', name: 'Eventos' })
  state.teams[0].assignments['repertorio-extra'] = ['joao-victor']
  state.teams[1].assignments['eventos-extra'] = ['liliane']
  state.teams[0].description = 'Descrição personalizada'
  state.teams[0].customSetting = { color: 'sage' }
  state.notes = { 'time-a': 'Continuar o ensaio.', 'time-b': 'Trocar o vocal.' }
  state.schedule = { '2026-10-04': 'time-a' }
  state.settings = { theme: 'dark', group: 'liturgicos' }
  const before = clone(state)
  const next = normalizePlannerState(state)
  assert.equal(validateState(next), true)
  assert.equal(allRoles(next.groups).some((role) => ['repertorio', 'eventos'].includes(role.id)), false)
  for (const team of next.teams) {
    assert.equal(Object.hasOwn(team.assignments, 'repertorio'), false)
    assert.equal(Object.hasOwn(team.assignments, 'eventos'), false)
  }
  assert.deepEqual(assigned(next, 'repertorio-extra'), ['joao-victor'])
  assert.deepEqual(assigned(next, 'eventos-extra', 'time-b'), ['liliane'])
  assert.deepEqual(assigned(next, 'piano'), assigned(state, 'piano'))
  assert.equal(next.people, state.people)
  assert.equal(next.notes, state.notes)
  assert.equal(next.schedule, state.schedule)
  assert.equal(next.settings, state.settings)
  assert.equal(next.teams[0].description, state.teams[0].description)
  assert.equal(next.teams[0].customSetting, state.teams[0].customSetting)
  assert.equal(next.teams[2], state.teams[2])
  assert.deepEqual(state, before)
  assert.equal(normalizePlannerState(next), next)
  const current = createInitialState()
  assert.equal(normalizePlannerState(current), current)
})

test('saved v2 boards are normalized on read without writing or replacing their other data', () => {
  const oldState = withRetiredRoles()
  oldState.people.push({ id: 'pessoa-nova', name: 'Pessoa nova', status: 'ativo', photo: 'fotos/Pessoa nova.jpg' })
  oldState.notes = { 'time-b': 'Minha nota' }
  oldState.teams[1].name = 'Time personalizado'
  oldState.teams[1].assignments.soprano = ['pessoa-nova']
  const saved = JSON.stringify(oldState)
  const storage = memoryStorage({ [STORAGE_KEY]: saved })
  const next = readPlannerState(storage)
  assert.deepEqual(next, normalizePlannerState(oldState))
  assert.deepEqual(next.people, oldState.people)
  assert.deepEqual(next.notes, oldState.notes)
  assert.deepEqual(assigned(next, 'soprano', 'time-b'), ['pessoa-nova'])
  assert.equal(storage.getItem(STORAGE_KEY), saved)
  assert.equal(storage.values.size, 1)
})

test('normalization rejects invalid backups before removing retired roles', () => {
  for (const value of [null, [], {}, { version: 1 }]) assert.equal(normalizePlannerState(value), null)
  for (const mutate of [
    (state) => { state.people[0].name = '' },
    (state) => { state.teams[0].assignments.repertorio = ['missing'] },
    (state) => { state.teams[0].assignments.piano = ['missing'] },
    (state) => { state.notes['missing-team'] = 'Nota inválida' },
  ]) {
    const state = withRetiredRoles()
    mutate(state)
    const before = clone(state)
    assert.equal(normalizePlannerState(state), null)
    assert.deepEqual(state, before)
  }
})

test('legacy v1 migration drops retired roles while preserving people who were assigned only to them', () => {
  const legacy = {
    people: [
      { id: 'nova', name: 'Pessoa nova' },
      { id: 'hudson', name: 'Hudson', status: 'ativo' },
    ],
    assignments: { repertorio: ['nova'], eventos: ['nova'], piano: ['hudson'] },
  }
  const next = readPlannerState(memoryStorage({ 'nucleo-ipcvt-planner-v1': JSON.stringify(legacy) }))
  assert.equal(validateState(next), true)
  assert.deepEqual(next.people.map((person) => person.id), ['nova', 'hudson'])
  assert.deepEqual(assigned(next, 'piano'), ['hudson'])
  assert.equal(allRoles(next.groups).some((role) => ['repertorio', 'eventos'].includes(role.id)), false)
  assert.equal(Object.hasOwn(next.teams[0].assignments, 'repertorio'), false)
  assert.equal(Object.hasOwn(next.teams[0].assignments, 'eventos'), false)
})

test('dragging from the people menu copies a person to a new role without removing other roles', () => {
  const state = createInitialState()
  const before = clone(state)
  const next = applyAssignment(state, { teamId: 'time-a', personId: 'hudson', roleId: 'som' })
  assert.ok(assigned(next, 'som').includes('hudson'))
  assert.ok(assigned(next, 'tenor').includes('hudson'))
  assert.ok(assigned(next, 'piano').includes('hudson'))
  assert.deepEqual(state, before)
  assert.equal(next.teams[1], state.teams[1])
  assert.equal(validateState(next), true)
})

test('moving between roles removes only the source role, preserving another simultaneous role', () => {
  const state = createInitialState()
  const next = applyAssignment(state, {
    teamId: 'time-a', personId: 'hudson', roleId: 'som', fromRoleId: 'tenor',
  })
  assert.equal(assigned(next, 'tenor').includes('hudson'), false)
  assert.ok(assigned(next, 'piano').includes('hudson'))
  assert.ok(assigned(next, 'som').includes('hudson'))
  assert.ok(assigned(state, 'tenor').includes('hudson'))
})

test('copying a role assignment preserves its source and does not duplicate a destination', () => {
  const state = createInitialState()
  const next = applyAssignment(state, {
    teamId: 'time-a', personId: 'hudson', roleId: 'som', fromRoleId: 'tenor', copy: true,
  })
  assert.ok(assigned(next, 'tenor').includes('hudson'))
  assert.ok(assigned(next, 'som').includes('hudson'))
  assert.equal(applyAssignment(next, { teamId: 'time-a', personId: 'hudson', roleId: 'som' }), next)
})

test('moving onto an existing assignment merges it and removes the source exactly once', () => {
  const state = createInitialState()
  const next = applyAssignment(state, {
    teamId: 'time-a', personId: 'hudson', roleId: 'piano', fromRoleId: 'tenor',
  })
  assert.deepEqual(assigned(next, 'piano'), ['hudson'])
  assert.equal(assigned(next, 'tenor').includes('hudson'), false)
  assert.equal(validateState(next), true)
})

test('invalid drag references and same-role drops leave the board unchanged', () => {
  const state = createInitialState()
  const valid = { teamId: 'time-a', personId: 'hudson', roleId: 'som' }
  for (const changes of [
    { teamId: 'missing' }, { personId: 'missing' }, { roleId: 'missing' },
    { fromRoleId: 'missing' }, { fromRoleId: 'violino' },
    { roleId: 'tenor', fromRoleId: 'tenor' },
  ]) assert.equal(applyAssignment(state, { ...valid, ...changes }), state)
})

test('moving between teams removes only the specified source assignment without mutating the board', () => {
  const state = createInitialState()
  const before = clone(state)
  const next = applyAssignment(state, {
    teamId: 'time-b', personId: 'hudson', roleId: 'som', fromRoleId: 'tenor', fromTeamId: 'time-a',
  })
  assert.equal(assigned(next, 'tenor', 'time-a').includes('hudson'), false)
  assert.ok(assigned(next, 'piano', 'time-a').includes('hudson'))
  assert.deepEqual(assigned(next, 'som', 'time-b'), ['hudson'])
  assert.equal(next.teams[2], state.teams[2])
  assert.deepEqual(state, before)
  assert.equal(validateState(next), true)
})

test('a person can move to the same role in another team', () => {
  const state = createInitialState()
  const next = applyAssignment(state, {
    teamId: 'time-b', personId: 'hudson', roleId: 'tenor', fromRoleId: 'tenor', fromTeamId: 'time-a',
  })
  assert.equal(assigned(next, 'tenor', 'time-a').includes('hudson'), false)
  assert.deepEqual(assigned(next, 'tenor', 'time-b'), ['hudson'])
  assert.ok(assigned(next, 'piano', 'time-a').includes('hudson'))
  assert.equal(validateState(next), true)
})

test('copying between teams preserves the source and deduplicates repeated drops', () => {
  const state = createInitialState()
  const operation = {
    teamId: 'time-b', personId: 'hudson', roleId: 'tenor', fromRoleId: 'tenor', fromTeamId: 'time-a', copy: true,
  }
  const next = applyAssignment(state, operation)
  assert.equal(next.teams[0], state.teams[0])
  assert.deepEqual(assigned(next, 'tenor', 'time-b'), ['hudson'])
  assert.equal(applyAssignment(next, operation), next)
  assert.equal(validateState(next), true)
})

test('menu drops copy into any team without inferring a source assignment', () => {
  const state = createInitialState()
  const next = applyAssignment(state, {
    teamId: 'time-b', personId: 'hudson', roleId: 'piano', fromTeamId: 'time-a',
  })
  assert.equal(next.teams[0], state.teams[0])
  assert.deepEqual(assigned(next, 'piano', 'time-b'), ['hudson'])
  assert.ok(assigned(next, 'tenor', 'time-a').includes('hudson'))
  assert.equal(applyAssignment(next, {
    teamId: 'time-b', personId: 'hudson', roleId: 'piano', fromTeamId: 'missing',
  }), next)
  const copied = applyAssignment(next, {
    teamId: 'time-c', personId: 'hudson', roleId: 'piano', fromTeamId: 'missing',
  })
  assert.deepEqual(assigned(copied, 'piano', 'time-c'), ['hudson'])
  assert.equal(copied.teams[0], state.teams[0])
  assert.equal(copied.teams[1], next.teams[1])
})

test('moving onto an existing assignment in another team merges while removing the source', () => {
  const state = applyAssignment(createInitialState(), { teamId: 'time-b', personId: 'hudson', roleId: 'tenor' })
  const next = applyAssignment(state, {
    teamId: 'time-b', personId: 'hudson', roleId: 'tenor', fromRoleId: 'tenor', fromTeamId: 'time-a',
  })
  assert.equal(assigned(next, 'tenor', 'time-a').includes('hudson'), false)
  assert.deepEqual(assigned(next, 'tenor', 'time-b'), ['hudson'])
  assert.equal(next.teams[1], state.teams[1])
  assert.equal(next.teams[2], state.teams[2])
  assert.equal(validateState(next), true)
})

test('invalid cross-team references never create a partial move or copy', () => {
  const state = createInitialState()
  const before = clone(state)
  const operation = {
    teamId: 'time-b', personId: 'hudson', roleId: 'som', fromRoleId: 'tenor', fromTeamId: 'time-a',
  }
  for (const changes of [
    { teamId: 'missing' }, { fromTeamId: 'missing' }, { fromTeamId: 'time-c' },
    { personId: 'missing' }, { roleId: 'missing' }, { fromRoleId: 'missing' }, { fromRoleId: 'violino' },
  ]) {
    assert.equal(applyAssignment(state, { ...operation, ...changes }), state)
    assert.equal(applyAssignment(state, { ...operation, ...changes, copy: true }), state)
  }
  assert.deepEqual(state, before)
})

test('clearing a team removes every group assignment while keeping other teams and metadata intact', () => {
  const state = applyAssignment(createInitialState(), { teamId: 'time-b', personId: 'hudson', roleId: 'piano' })
  state.notes = { 'time-a': 'Manter a formação.', 'time-b': 'Ensaiar.' }
  state.schedule = { '2026-10-04': 'time-a' }
  const before = clone(state)
  const next = clearTeam(state, 'time-a')
  assert.deepEqual(next.teams[0].assignments, {})
  assert.equal(next.teams[0].id, state.teams[0].id)
  assert.equal(next.teams[0].name, state.teams[0].name)
  assert.equal(next.teams[0].description, state.teams[0].description)
  assert.equal(next.teams[1], state.teams[1])
  assert.equal(next.teams[2], state.teams[2])
  assert.equal(next.people, state.people)
  assert.equal(next.groups, state.groups)
  assert.equal(next.notes, state.notes)
  assert.equal(next.schedule, state.schedule)
  assert.deepEqual(assigned(next, 'piano', 'time-b'), ['hudson'])
  assert.deepEqual(state, before)
  assert.equal(validateState(next), true)
})

test('clearing an empty or missing team leaves the board unchanged', () => {
  const state = createInitialState()
  assert.equal(clearTeam(state, 'missing'), state)
  assert.equal(clearTeam(state, 'time-b'), state)
  state.teams[1].assignments = { piano: [], tenor: [] }
  assert.equal(clearTeam(state, 'time-b'), state)
  const cleared = clearTeam(state, 'time-a')
  assert.equal(clearTeam(cleared, 'time-a'), cleared)
})

test('unassigning a person affects only the selected role and team', () => {
  const state = createInitialState()
  const copied = applyAssignment(state, { teamId: 'time-b', personId: 'hudson', roleId: 'tenor' })
  const next = removeAssignment(copied, 'time-a', 'tenor', 'hudson')
  assert.equal(assigned(next, 'tenor').includes('hudson'), false)
  assert.ok(assigned(next, 'piano').includes('hudson'))
  assert.ok(assigned(next, 'tenor', 'time-b').includes('hudson'))
  assert.equal(removeAssignment(next, 'time-a', 'tenor', 'hudson'), next)
})

test('deleting a team cleans its legacy calendar references and notes while keeping other assignments intact', () => {
  const state = createInitialState()
  state.schedule = { '2026-10-04': 'time-a', '2026-10-11': 'time-b', '2026-10-18': 'time-a' }
  state.notes = { 'time-a': 'Nota A', 'time-b': 'Nota B' }
  const next = removeTeam(state, 'time-a')
  assert.deepEqual(next.teams.map((team) => team.id), ['time-b', 'time-c'])
  assert.deepEqual(next.schedule, { '2026-10-11': 'time-b' })
  assert.deepEqual(next.notes, { 'time-b': 'Nota B' })
  assert.equal(validateState(next), true)
  assert.equal(removeTeam(state, 'missing'), state)
  assert.equal(state.teams.length, 3)
})

test('validation rejects malformed imports, duplicate entities, and dangling references', () => {
  const malformed = [
    (s) => { s.version = 1 },
    (s) => { s.people = {} },
    (s) => { s.people[0] = null },
    (s) => { s.people[0].name = ' ' },
    (s) => { s.people[0].status = false },
    (s) => { s.people[0].photo = {} },
    (s) => { s.people[0].photo = null },
    (s) => { s.people[0].photo = '' },
    (s) => { s.people[0].photo = ' ' },
    (s) => { s.people[0].id = '__proto__' },
    (s) => { s.people.push({ ...s.people[0] }) },
    (s) => { s.groups.push(clone(s.groups[0])) },
    (s) => { s.groups[0].color = 'red' },
    (s) => { s.groups[0].sections = null },
    (s) => { s.groups[0].sections[0].roles[0].id = 'constructor' },
    (s) => { s.groups[1].sections.push(clone(s.groups[0].sections[0])) },
    (s) => { s.groups[1].sections[0].roles.push({ id: 'som', name: 'Duplicated' }) },
    (s) => { s.teams.push(clone(s.teams[0])) },
    (s) => { s.teams = [] },
    (s) => { s.teams[0].assignments = [] },
    (s) => { s.teams[0].assignments.som = ['missing'] },
    (s) => { s.teams[0].assignments.som = ['hudson', 'hudson'] },
    (s) => { s.teams[0].assignments.missing = ['hudson'] },
    (s) => { s.teams[0].assignments.som = 'hudson' },
    (s) => { s.schedule = [] },
    (s) => { s.schedule = { '2026-10-04': 'missing' } },
    (s) => { s.schedule = { '2026-10-05': 'time-a' } },
    (s) => { s.schedule = { '2026-02-29': 'time-a' } },
    (s) => { s.schedule = { '2026-2-01': 'time-a' } },
    (s) => { s.notes = [] },
    (s) => { s.notes.missing = 'Lost note' },
    (s) => { s.notes['time-a'] = {} },
  ]
  assert.equal(validateState(null), false)
  assert.equal(validateState([]), false)
  for (const mutate of malformed) {
    const state = createInitialState()
    mutate(state)
    assert.equal(validateState(state), false, mutate.toString())
  }
})

test('valid saved boards take priority over legacy data and are read without writes', () => {
  const state = createInitialState()
  state.teams[0].name = 'Time principal'
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify(state),
    'nucleo-ipcvt-planner-v1': JSON.stringify({ people: [], assignments: {} }),
  })
  assert.deepEqual(readPlannerState(storage), state)
  assert.equal(storage.values.size, 2)
})

test('imports preserve optional photo paths while rejecting values that cannot render', () => {
  const state = createInitialState()
  state.people[0].photo = 'fotos/Alexandre.webp'
  state.people[1].photo = 'https://example.com/Allysson.jpg'
  assert.equal(validateState(state), true)
  const saved = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) })
  assert.deepEqual(readPlannerState(saved), state)
})

test('a saved board without teams is rejected before it can reach the UI', () => {
  const empty = createInitialState()
  empty.teams = []
  assert.equal(validateState(empty), false)
  assert.deepEqual(readPlannerState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(empty) })), createInitialState())
  const oneTeam = removeTeam(removeTeam(createInitialState(), 'time-c'), 'time-b')
  assert.equal(oneTeam.teams.length, 1)
  assert.equal(removeTeam(oneTeam, 'time-a'), oneTeam)
  assert.equal(validateState(oneTeam), true)
})

test('legacy migration keeps custom people, cleans missing IDs, and leaves the old save intact', () => {
  const legacy = JSON.stringify({
    people: [{ id: 'hudson', name: 'Hudson', status: 'ativo' }, { id: 'nova', name: 'Nova pessoa' }],
    assignments: { piano: ['hudson', 'hudson', 'missing'], camera: ['nova'], unknown: ['hudson'] },
  })
  const storage = memoryStorage({ 'nucleo-ipcvt-planner-v1': legacy, [STORAGE_KEY]: '{broken' })
  const state = readPlannerState(storage)
  assert.equal(validateState(state), true)
  assert.deepEqual(state.people, [
    { id: 'hudson', name: 'Hudson', status: 'ativo' }, { id: 'nova', name: 'Nova pessoa', status: 'ativo' },
  ])
  assert.deepEqual(assigned(state, 'piano'), ['hudson'])
  assert.deepEqual(assigned(state, 'camera'), ['nova'])
  assert.equal(Object.hasOwn(state.teams[0].assignments, 'unknown'), false)
  assert.equal(storage.getItem('nucleo-ipcvt-planner-v1'), legacy)
  assert.equal(storage.getItem(STORAGE_KEY), '{broken')
})

test('unreadable or malformed saved data falls back safely', () => {
  const initial = createInitialState()
  assert.deepEqual(readPlannerState(undefined), initial)
  assert.deepEqual(readPlannerState({ getItem() { throw new Error('Storage disabled') } }), initial)
  for (const legacy of ['null', '[]', '{}', '{bad', '{"people":[null],"assignments":{}}']) {
    assert.deepEqual(readPlannerState(memoryStorage({ 'nucleo-ipcvt-planner-v1': legacy })), initial)
  }
})

test('a denied localStorage getter is caught before attempting to read a save', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('SecurityError: storage access denied') },
    })
    assert.deepEqual(readPlannerState(), createInitialState())
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('boards without a calendar work while previous v2 data remains losslessly readable', () => {
  const state = createInitialState()
  assert.equal(Object.hasOwn(state, 'schedule'), false)
  assert.equal(validateState(state), true)
  assert.deepEqual(readPlannerState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) })), state)
  const next = removeTeam(state, 'time-a')
  assert.equal(Object.hasOwn(next, 'schedule'), false)
  assert.equal(validateState(next), true)

  const oldState = clone(state)
  oldState.schedule = { '2026-10-04': 'time-a', '2032-02-29': 'time-b' }
  oldState.notes = { 'time-a': 'Manter o vocal nesta formação.' }
  assert.equal(validateState(oldState), true)
  const restored = readPlannerState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(oldState) }))
  assert.deepEqual(restored, oldState)
  const edited = applyAssignment(restored, { teamId: 'time-b', personId: 'hudson', roleId: 'piano' })
  assert.deepEqual(edited.schedule, oldState.schedule)
  assert.deepEqual(edited.notes, oldState.notes)
  assert.equal(validateState(edited), true)
})

test('role metadata and legacy skills are ready for member search and board navigation', () => {
  const state = createInitialState()
  const piano = allRoles(state.groups).find((role) => role.id === 'piano')
  assert.equal(piano.groupName, 'Louvor')
  assert.equal(piano.sectionName, 'Instrumental')
  assert.deepEqual(personSkills('hudson'), ['Tenor', 'Piano'])
  assert.deepEqual(personSkills('missing'), [])
  assert.equal(slugify('  João Víctor / Piano  '), 'joao-victor-piano')
  const ids = new Set(Array.from({ length: 100 }, () => createId('Novo cargo')))
  assert.equal(ids.size, 100)
  assert.ok([...ids].every((id) => id.startsWith('novo-cargo-')))
})
