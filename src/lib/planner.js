import { people as initialPeople } from '../data/people.js'
import { initialAssignments } from '../data/initialAssignments.js'

export const STORAGE_KEY = 'ipcvt-planner-v2'
const LEGACY_STORAGE_KEY = 'nucleo-ipcvt-planner-v1'
const COLORS = new Set(['sage', 'peach', 'lavender'])
const STRUCTURE_REVISION = 2
let sequence = 0

export function slugify(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createId(prefix = 'item') {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  return `${slugify(prefix) || 'item'}-${suffix}`
}

function createGroups() {
  return [
    {
      id: 'louvor', name: 'Louvor', color: 'sage',
      sections: [
        { id: 'vocal', name: 'Vocal', roles: [
          { id: 'voz-guia', name: 'Voz Guia' },
          { id: 'soprano', name: 'Soprano' },
          { id: 'contralto', name: 'Contralto' },
          { id: 'tenor', name: 'Tenor' },
        ] },
        { id: 'instrumental', name: 'Instrumental', roles: [
          { id: 'violao', name: 'Violão' },
          { id: 'guitarra', name: 'Guitarra' },
          { id: 'baixo', name: 'Baixo' },
          { id: 'piano', name: 'Piano' },
          { id: 'bateria', name: 'Bateria' },
          { id: 'violino', name: 'Violino' },
        ] },
        { id: 'tecnica', name: 'Técnica', roles: [
          { id: 'som', name: 'Operador de som' },
        ] },
      ],
    },
    {
      id: 'liturgicos', name: 'Litúrgicos', color: 'peach',
      sections: [{ id: 'liturgia', name: 'Liturgia', roles: [
        { id: 'gestao', name: 'Gestão' },
        { id: 'projecao', name: 'Projeção' },
      ] }],
    },
    {
      id: 'midia', name: 'Mídia', color: 'lavender',
      sections: [{ id: 'comunicacao', name: 'Comunicação', roles: [
        { id: 'obs', name: 'Transmissão' },
        { id: 'camera', name: 'Câmera' },
        { id: 'fotografia', name: 'Fotografia' },
      ] }],
    },
  ]
}

export function allRoles(groups) {
  return groups.flatMap((group) => group.sections.flatMap((section) => section.roles.map((role) => ({
    ...role,
    groupId: group.id,
    groupName: group.name,
    groupColor: group.color,
    sectionId: section.id,
    sectionName: section.name,
  }))))
}

export function personSkills(personId) {
  return allRoles(createGroups())
    .filter((role) => initialAssignments[role.id]?.includes(personId))
    .map((role) => role.name)
}

function validLegacyAssignments(assignments, people, groups) {
  const peopleIds = new Set(people.map((person) => person.id))
  return Object.fromEntries(allRoles(groups).map((role) => [
    role.id,
    [...new Set(Array.isArray(assignments[role.id])
      ? assignments[role.id].filter((id) => peopleIds.has(id)) : [])],
  ]))
}

export function createInitialState() {
  const people = initialPeople.map((person) => ({ ...person }))
  const groups = createGroups()
  return {
    version: 2,
    structureRevision: STRUCTURE_REVISION,
    people,
    groups,
    teams: [
      {
        id: 'time-a', name: 'Time A', description: 'Organização anterior · ajuste como preferir',
        assignments: validLegacyAssignments(initialAssignments, people, groups),
      },
      { id: 'time-b', name: 'Time B', description: '', assignments: {} },
      { id: 'time-c', name: 'Time C', description: '', assignments: {} },
    ],
    notes: {},
  }
}

const isRecord = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const isText = (value) => typeof value === 'string' && value.trim().length > 0
const isId = (value) => isText(value) && value === value.trim() && !Object.hasOwn(Object.prototype, value)

function addId(ids, id) {
  if (!isId(id) || ids.has(id)) return false
  ids.add(id)
  return true
}

function localDate(year, month, day) {
  const result = new Date(0)
  result.setHours(12, 0, 0, 0)
  result.setFullYear(year, month, day)
  return result
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = localDate(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

/** Validates imports before they can replace a saved board. Empty role assignments may be omitted. */
export function validateState(data) {
  if (!isRecord(data) || data.version !== 2 || !Array.isArray(data.people)
    || !Array.isArray(data.groups) || !Array.isArray(data.teams) || data.teams.length === 0
    || (data.schedule !== undefined && !isRecord(data.schedule)) || !isRecord(data.notes)) return false

  const peopleIds = new Set()
  const groupIds = new Set()
  const sectionIds = new Set()
  const roleIds = new Set()
  const teamIds = new Set()

  for (const person of data.people) {
    if (!isRecord(person) || !addId(peopleIds, person.id) || !isText(person.name) || !isText(person.status)
      || (person.photo !== undefined && !isText(person.photo))) return false
  }
  for (const group of data.groups) {
    if (!isRecord(group) || !addId(groupIds, group.id) || !isText(group.name)
      || !COLORS.has(group.color) || !Array.isArray(group.sections)) return false
    for (const section of group.sections) {
      if (!isRecord(section) || !addId(sectionIds, section.id) || !isText(section.name) || !Array.isArray(section.roles)) return false
      for (const role of section.roles) {
        if (!isRecord(role) || !addId(roleIds, role.id) || !isText(role.name)) return false
      }
    }
  }
  for (const team of data.teams) {
    if (!isRecord(team) || !addId(teamIds, team.id) || !isText(team.name)
      || typeof team.description !== 'string' || !isRecord(team.assignments)) return false
    for (const [roleId, assignedPeople] of Object.entries(team.assignments)) {
      if (!roleIds.has(roleId) || !Array.isArray(assignedPeople)
        || new Set(assignedPeople).size !== assignedPeople.length
        || assignedPeople.some((id) => !peopleIds.has(id))) return false
    }
  }
  // Older v2 saves may carry their former calendar. Preserve it for backup compatibility.
  for (const [day, teamId] of Object.entries(data.schedule ?? {})) {
    const date = parseDate(day)
    if (!date || date.getDay() !== 0 || !teamIds.has(teamId)) return false
  }
  return Object.entries(data.notes).every(([teamId, note]) => teamIds.has(teamId) && typeof note === 'string')
}

function addGuideVoice(roles, usedRoleIds) {
  const existing = roles.find((role) => role.id === 'voz-guia')
    || roles.find((role) => slugify(role.name) === 'voz-guia')
  let guide = existing
  if (!guide) {
    let id = 'voz-guia'
    for (let suffix = 2; usedRoleIds.has(id); suffix += 1) id = `voz-guia-${suffix}`
    usedRoleIds.add(id)
    guide = { id, name: 'Voz Guia' }
  }
  const next = roles.filter((role) => role !== existing)
  const sopranoIndex = next.findIndex((role) => role.id === 'soprano' || slugify(role.name) === 'soprano')
  next.splice(sopranoIndex < 0 ? 0 : sopranoIndex, 0, guide)
  return next.every((role, index) => role === roles[index]) && next.length === roles.length ? roles : next
}

/** Applies structure updates once, preserving assignments and later customizations. */
export function normalizePlannerState(data) {
  if (!validateState(data)) return null
  const revision = Number.isInteger(data.structureRevision) ? data.structureRevision : 0
  const needsGuideVoice = revision < 1
  const needsViolinLast = revision < 2
  const needsStructureUpdate = revision < STRUCTURE_REVISION
  const usedRoleIds = new Set(allRoles(data.groups).map((role) => role.id))
  const removedRoles = new Set()
  const groups = data.groups.map((group) => {
    const retiredId = group.id === 'louvor' ? 'repertorio' : group.id === 'liturgicos' ? 'eventos' : null
    if (retiredId === null) return group
    let changed = false
    const sections = group.sections.map((section) => {
      let roles = section.roles
      if (roles.some((role) => role.id === retiredId)) {
        removedRoles.add(retiredId)
        roles = roles.filter((role) => role.id !== retiredId)
      }
      if (needsGuideVoice && group.id === 'louvor' && section.id === 'vocal') roles = addGuideVoice(roles, usedRoleIds)
      if (needsViolinLast && group.id === 'louvor' && section.id === 'instrumental') {
        const violin = roles.find((role) => role.id === 'violino') || roles.find((role) => slugify(role.name) === 'violino')
        if (violin && roles.at(-1) !== violin) roles = [...roles.filter((role) => role !== violin), violin]
      }
      if (roles === section.roles) return section
      changed = true
      return { ...section, roles }
    })
    return changed ? { ...group, sections } : group
  })
  if (removedRoles.size === 0 && !needsStructureUpdate) return data
  return {
    ...data,
    ...(needsStructureUpdate ? { structureRevision: STRUCTURE_REVISION } : {}),
    groups,
    teams: removedRoles.size === 0 ? data.teams : data.teams.map((team) => {
      if (![...removedRoles].some((roleId) => Object.hasOwn(team.assignments, roleId))) return team
      return {
        ...team,
        assignments: Object.fromEntries(Object.entries(team.assignments).filter(([roleId]) => !removedRoles.has(roleId))),
      }
    }),
  }
}

function migrateLegacyState(data) {
  if (!isRecord(data) || !Array.isArray(data.people) || !isRecord(data.assignments)) return null
  const peopleIds = new Set()
  const people = []
  for (const person of data.people) {
    if (!isRecord(person) || !addId(peopleIds, person.id) || !isText(person.name)
      || (person.status !== undefined && !isText(person.status))) return null
    people.push({ id: person.id, name: person.name, status: person.status ?? 'ativo' })
  }
  const state = createInitialState()
  state.people = people
  state.teams[0].assignments = validLegacyAssignments(data.assignments, people, state.groups)
  return validateState(state) ? state : null
}

/** Reads are deliberately side-effect free; the original v1 key remains available as a backup. */
export function readPlannerState(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage
    const saved = source?.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = normalizePlannerState(JSON.parse(saved))
        if (state) return state
      } catch { /* Try the older board when a newer save is unreadable. */ }
    }
    const legacy = source?.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      try {
        const state = migrateLegacyState(JSON.parse(legacy))
        if (state) return state
      } catch { /* A malformed save must not prevent opening a fresh board. */ }
    }
  } catch { /* Storage may be disabled or unavailable. */ }
  return createInitialState()
}

export function applyAssignment(state, { teamId, personId, roleId, fromRoleId = null, copy = false, fromTeamId = null }) {
  const team = state.teams.find((item) => item.id === teamId)
  const roles = new Set(allRoles(state.groups).map((role) => role.id))
  if (!team || !roles.has(roleId) || !state.people.some((person) => person.id === personId)) return state
  const sourceTeam = fromRoleId === null ? null : state.teams.find((item) => item.id === (fromTeamId ?? teamId))
  if (fromRoleId !== null && (!sourceTeam || !roles.has(fromRoleId)
    || !(sourceTeam.assignments[fromRoleId] ?? []).includes(personId))) return state

  const destination = team.assignments[roleId] ?? []
  const move = sourceTeam !== null && (sourceTeam.id !== teamId || fromRoleId !== roleId) && !copy
  if (destination.includes(personId) && !move) return state

  return {
    ...state,
    teams: state.teams.map((item) => {
      let assignments = item.assignments
      if (item.id === teamId && !destination.includes(personId)) {
        assignments = { ...assignments, [roleId]: [...destination, personId] }
      }
      if (move && item.id === sourceTeam.id) {
        assignments = { ...assignments, [fromRoleId]: assignments[fromRoleId].filter((id) => id !== personId) }
      }
      return assignments === item.assignments ? item : { ...item, assignments }
    }),
  }
}

export function clearTeam(state, teamId) {
  const team = state.teams.find((item) => item.id === teamId)
  if (!team || !Object.values(team.assignments).some((peopleIds) => peopleIds.length > 0)) return state
  return {
    ...state,
    teams: state.teams.map((item) => item.id === teamId ? { ...item, assignments: {} } : item),
  }
}

export function removeAssignment(state, teamId, roleId, personId) {
  const team = state.teams.find((item) => item.id === teamId)
  if (!team?.assignments[roleId]?.includes(personId)) return state
  return {
    ...state,
    teams: state.teams.map((item) => item.id === teamId ? {
      ...item,
      assignments: { ...item.assignments, [roleId]: item.assignments[roleId].filter((id) => id !== personId) },
    } : item),
  }
}

export function removeTeam(state, teamId) {
  if (state.teams.length <= 1 || !state.teams.some((team) => team.id === teamId)) return state
  const notes = { ...state.notes }
  delete notes[teamId]
  return {
    ...state,
    teams: state.teams.filter((team) => team.id !== teamId),
    ...(state.schedule === undefined ? {} : {
      schedule: Object.fromEntries(Object.entries(state.schedule).filter(([, scheduledTeamId]) => scheduledTeamId !== teamId)),
    }),
    notes,
  }
}
