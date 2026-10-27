import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createInitialState } from './planner.js'
import { CONFLICT_BACKUP_KEY, SYNC_STORAGE_KEY, createCloudSync, stateFingerprint } from './cloudSync.js'

const initial = () => createInitialState()
const edited = (state, text) => ({ ...state, notes: { ...state.notes, [state.teams[0].id]: text } })
const snapshot = (state, revision = 1, extra = {}) => ({ state, revision, ...extra })
const settle = () => delay(8)

function memory(values = {}) {
  const data = new Map(Object.entries(values))
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

function metadata(baseState, baseRevision, localState = baseState) {
  return JSON.stringify({ version: 1, hasBase: true, baseState, baseRevision,
    localFingerprint: stateFingerprint(localState), dirty: stateFingerprint(baseState) !== stateFingerprint(localState) })
}

function harness(t, options = {}) {
  const statuses = []
  const adopted = []
  const saves = []
  const listeners = []
  const storage = options.storage || memory()
  const transport = {
    subscribe(onRemote, onError) {
      const listener = { onRemote, onError, detached: false }
      listeners.push(listener)
      return () => { listener.detached = true }
    },
    save(state, expectedRevision) {
      return new Promise((resolve, reject) => saves.push({ state, expectedRevision, resolve, reject }))
    },
  }
  const sync = createCloudSync({ transport, initialState: options.initialState || initial(),
    hasLocalState: options.hasLocalState || false, storage, debounceMs: 0,
    onRemoteState: (state) => adopted.push(state), onStatus: (status) => statuses.push(status) })
  const remote = (value) => listeners.at(-1).onRemote(value)
  const error = (value) => listeners.at(-1).onError(value)
  const phase = () => statuses.at(-1)?.phase
  sync.start()
  t.after(() => sync.stop())
  return { sync, storage, saves, listeners, statuses, adopted, remote, error, phase }
}

test('a new device adopts server data without sending its initial board', async (t) => {
  const h = harness(t)
  const server = edited(initial(), 'Escala compartilhada')
  h.remote(snapshot(server, 8))
  await settle()
  assert.equal(h.saves.length, 0)
  assert.deepEqual(h.adopted, [server])
  assert.equal(h.phase(), 'saved')
})

test('an equal existing local board establishes its base without a write', async (t) => {
  const state = initial()
  const h = harness(t, { initialState: state, hasLocalState: true })
  h.remote(snapshot(state, 4))
  await settle()
  assert.equal(h.saves.length, 0)
  assert.equal(h.adopted.length, 0)
  assert.equal(JSON.parse(h.storage.getItem(SYNC_STORAGE_KEY)).baseRevision, 4)
})

test('a pre-cloud local board differing from the server raises a conflict', async (t) => {
  const local = edited(initial(), 'Meu tablet')
  const server = edited(initial(), 'Outro aparelho')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(server, 7))
  await settle()
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.saves.length, 0)
  assert.equal(h.adopted.length, 0)
  assert.deepEqual(h.statuses.at(-1).remote.state, server)
})

test('choosing the server preserves the local conflict copy before adopting', (t) => {
  const local = edited(initial(), 'Somente local')
  const server = edited(initial(), 'Somente remoto')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(server, 9))
  assert.equal(h.sync.useRemote(), true)
  assert.deepEqual(h.adopted, [server])
  const backup = JSON.parse(h.storage.getItem(CONFLICT_BACKUP_KEY))[0]
  assert.deepEqual(backup.localState, local)
  assert.deepEqual(backup.remoteState, server)
  assert.equal(backup.choice, 'remote')
  assert.equal(h.phase(), 'saved')
})

test('choosing the local board preserves both copies and writes against the current revision', async (t) => {
  const local = edited(initial(), 'Publicar este')
  const server = edited(initial(), 'Cópia anterior')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(server, 3))
  assert.equal(h.sync.keepLocal(), true)
  await settle()
  assert.equal(h.saves[0].expectedRevision, 3)
  assert.deepEqual(h.saves[0].state, local)
  assert.equal(h.phase(), 'saving')
  h.saves[0].resolve(snapshot(local, 4))
  await settle()
  assert.equal(h.phase(), 'saved')
  assert.equal(JSON.parse(h.storage.getItem(CONFLICT_BACKUP_KEY))[0].choice, 'local')
})

test('an empty server is initialized from a saved local board with revision zero', async (t) => {
  const local = edited(initial(), 'Novo planejamento completo')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(null, 0))
  await settle()
  assert.equal(h.saves.length, 1)
  assert.equal(h.saves[0].expectedRevision, 0)
  assert.deepEqual(h.saves[0].state, local)
  assert.equal(h.phase(), 'saving')
})

test('a new device uses legacy cloud data only when no v2 server or local board exists', async (t) => {
  const legacy = edited(initial(), 'Recuperado do legado')
  const h = harness(t)
  h.remote(snapshot(null, 0, { legacyState: legacy }))
  await settle()
  assert.deepEqual(h.adopted, [legacy])
  assert.deepEqual(h.saves[0].state, legacy)
})

test('a saved local v2 board takes precedence over the legacy seed', async (t) => {
  const local = edited(initial(), 'Times novos')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(null, 0, { legacyState: edited(initial(), 'Formato antigo') }))
  await settle()
  assert.equal(h.adopted.length, 0)
  assert.deepEqual(h.saves[0].state, local)
})

test('edits made while connecting cannot be overwritten by the first remote snapshot', async (t) => {
  const h = harness(t)
  h.sync.change(edited(initial(), 'Editei antes de carregar'))
  h.remote(snapshot(edited(initial(), 'Já estava na rede'), 2))
  await settle()
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.adopted.length, 0)
  assert.equal(h.saves.length, 0)
})

test('a clean persisted base receives the latest remote board on reopening', (t) => {
  const base = initial()
  const server = edited(base, 'Mais recente')
  const storage = memory({ [SYNC_STORAGE_KEY]: metadata(base, 1) })
  const h = harness(t, { initialState: base, hasLocalState: true, storage })
  h.remote(snapshot(server, 5))
  assert.deepEqual(h.adopted, [server])
  assert.equal(h.phase(), 'saved')
})

test('pending local edits survive reopening and save once their base is confirmed', async (t) => {
  const base = initial()
  const local = edited(base, 'Trabalho offline')
  const storage = memory({ [SYNC_STORAGE_KEY]: metadata(base, 2, local) })
  const h = harness(t, { initialState: local, hasLocalState: true, storage })
  h.remote(snapshot(base, 2))
  await settle()
  assert.deepEqual(h.saves[0].state, local)
  assert.equal(h.saves[0].expectedRevision, 2)
  assert.equal(h.adopted.length, 0)
})

test('pending local edits conflict with changes made on another device while offline', (t) => {
  const base = initial()
  const local = edited(base, 'Offline local')
  const storage = memory({ [SYNC_STORAGE_KEY]: metadata(base, 2, local) })
  const h = harness(t, { initialState: local, hasLocalState: true, storage })
  h.remote(snapshot(edited(base, 'Rede alterada'), 3))
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.adopted.length, 0)
})

test('edits during an in-flight save are sent after its acknowledgement', async (t) => {
  const base = initial()
  const first = edited(base, 'Primeira alteração')
  const latest = edited(base, 'Alteração durante envio')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(first)
  await settle()
  h.sync.change(latest)
  assert.equal(h.saves.length, 1)
  h.saves[0].resolve(snapshot(first, 2))
  await settle()
  assert.equal(h.saves.length, 2)
  assert.deepEqual(h.saves[1].state, latest)
  assert.equal(h.saves[1].expectedRevision, 2)
  assert.equal(h.phase(), 'saving')
  h.saves[1].resolve(snapshot(latest, 3))
  await settle()
  assert.equal(h.phase(), 'saved')
})

test('a listener acknowledgement followed by another edit never leaves a false saved status', async (t) => {
  const base = initial()
  const first = edited(base, 'Enviado')
  const latest = edited(base, 'Ainda pendente')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(first)
  await settle()
  h.remote(snapshot(first, 2))
  assert.equal(h.phase(), 'saved')
  h.sync.change(latest)
  assert.equal(h.phase(), 'saving')
  h.saves[0].resolve(snapshot(first, 2))
  await settle()
  assert.deepEqual(h.saves[1].state, latest)
})

test('an old save acknowledgement does not revert a newer server snapshot', async (t) => {
  const base = initial()
  const sent = edited(base, 'Enviado por mim')
  const newer = edited(base, 'Outro aparelho depois de mim')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(sent)
  await settle()
  h.remote(snapshot(sent, 2))
  h.remote(snapshot(newer, 3))
  h.saves[0].resolve(snapshot(sent, 2))
  await settle()
  assert.deepEqual(h.adopted, [newer])
  assert.equal(JSON.parse(h.storage.getItem(SYNC_STORAGE_KEY)).baseRevision, 3)
  assert.equal(h.phase(), 'saved')
})

test('a concurrent first creation is kept as a conflict rather than overwritten', async (t) => {
  const local = edited(initial(), 'Primeiro cliente')
  const other = edited(initial(), 'Outro cliente')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(null, 0))
  await settle()
  h.saves[0].reject({ code: 'conflict', remote: snapshot(other, 1) })
  await settle()
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.saves.length, 1)
  assert.equal(h.adopted.length, 0)
})

test('CAS retry can advance to a revision with identical base content', async (t) => {
  const base = initial()
  const local = edited(base, 'Minha mudança')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(local)
  await settle()
  h.saves[0].reject({ code: 'conflict', remote: snapshot(base, 2) })
  await settle()
  assert.equal(h.phase(), 'saving')
  assert.equal(h.saves[1].expectedRevision, 2)
  assert.deepEqual(h.saves[1].state, local)
})

test('an offline save preserves pending changes and retries after a server read', async (t) => {
  const base = initial()
  const local = edited(base, 'Sem internet')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(local)
  await settle()
  h.saves[0].reject({ code: 'unavailable' })
  await settle()
  assert.equal(h.phase(), 'offline')
  assert.equal(JSON.parse(h.storage.getItem(SYNC_STORAGE_KEY)).dirty, true)
  h.sync.retry()
  assert.equal(h.listeners[0].detached, true)
  h.remote(snapshot(base, 1))
  await settle()
  assert.deepEqual(h.saves[1].state, local)
  assert.equal(h.saves[1].expectedRevision, 1)
})

test('permission failures and invalid remote data never claim network persistence', async (t) => {
  const h = harness(t)
  h.error({ code: 'permission-denied' })
  assert.equal(h.phase(), 'error')
  h.sync.retry()
  h.remote(snapshot({ version: 2, teams: [] }, 1))
  await settle()
  assert.equal(h.phase(), 'error')
  assert.equal(h.adopted.length, 0)
  assert.equal(h.saves.length, 0)
})

test('conflicts stay paused while the user continues to edit the local board', async (t) => {
  const local = edited(initial(), 'Local')
  const h = harness(t, { initialState: local, hasLocalState: true })
  h.remote(snapshot(edited(initial(), 'Rede'), 2))
  const latest = edited(local, 'Local editado novamente')
  h.sync.change(latest)
  await settle()
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.saves.length, 0)
  h.sync.useRemote()
  assert.deepEqual(JSON.parse(h.storage.getItem(CONFLICT_BACKUP_KEY))[0].localState, latest)
})

test('editing after an initial connection failure keeps the error visible until a real retry', async (t) => {
  const h = harness(t)
  h.error({ code: 'permission-denied' })
  const local = edited(initial(), 'Continuo editando enquanto a conexão falhou')
  h.sync.change(local)
  await settle()
  assert.equal(h.phase(), 'error')
  assert.equal(h.listeners.length, 1)
  assert.equal(h.saves.length, 0)
  h.sync.retry()
  assert.equal(h.phase(), 'connecting')
  assert.equal(h.listeners.length, 2)
  h.remote(snapshot(null, 0))
  await settle()
  assert.deepEqual(h.saves[0].state, local)
  assert.equal(h.phase(), 'saving')
})

test('conflict resolution stops safely when a backup cannot be preserved', (t) => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }
  const h = harness(t, { hasLocalState: true, storage })
  h.remote(snapshot(edited(initial(), 'Remoto diferente'), 1))
  assert.equal(h.sync.useRemote(), false)
  assert.equal(h.sync.keepLocal(), false)
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.adopted.length, 0)
})

test('stop cancels pending writes and ignores already queued listener callbacks', async (t) => {
  const h = harness(t)
  h.remote(snapshot(initial(), 1))
  h.sync.change(edited(initial(), 'Não enviar após desmontar'))
  h.sync.stop()
  const before = h.statuses.length
  h.remote(snapshot(edited(initial(), 'Callback tardio'), 2))
  await settle()
  assert.equal(h.saves.length, 0)
  assert.equal(h.adopted.length, 0)
  assert.equal(h.statuses.length, before)
  assert.equal(h.listeners[0].detached, true)
})

test('stopping during a write ignores its late completion and permits a fresh start', async (t) => {
  const base = initial()
  const sent = edited(base, 'Envio antigo')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(sent)
  await settle()
  h.sync.stop()
  h.sync.start()
  const newer = edited(base, 'Servidor atual')
  h.remote(snapshot(newer, 3))
  assert.equal(h.phase(), 'conflict')
  const count = h.statuses.length
  h.saves[0].resolve(snapshot(sent, 2))
  await settle()
  assert.equal(h.statuses.length, count)
})

test('malformed metadata is ignored without discarding an existing local board', (t) => {
  const h = harness(t, { hasLocalState: true, storage: memory({ [SYNC_STORAGE_KEY]: '{invalid' }) })
  h.remote(snapshot(edited(initial(), 'Diferente'), 1))
  assert.equal(h.phase(), 'conflict')
  assert.equal(h.adopted.length, 0)
})

test('browser offline events immediately replace a saved status and reconnect on return', async (t) => {
  const base = initial()
  const h = harness(t)
  h.remote(snapshot(base, 1))
  assert.equal(h.phase(), 'saved')
  h.sync.setOnline(false)
  assert.equal(h.phase(), 'offline')
  assert.equal(h.listeners[0].detached, true)
  const local = edited(base, 'Edição sem rede')
  h.sync.change(local)
  await settle()
  assert.equal(h.saves.length, 0)
  assert.equal(h.phase(), 'offline')
  h.sync.setOnline(true)
  assert.equal(h.phase(), 'connecting')
  h.remote(snapshot(base, 1))
  await settle()
  assert.deepEqual(h.saves[0].state, local)
})

test('a confirmed write finishing after an offline event retains the base without claiming connectivity', async (t) => {
  const base = initial()
  const local = edited(base, 'Pedido já enviado')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(local)
  await settle()
  h.sync.setOnline(false)
  h.saves[0].resolve(snapshot(local, 2))
  await settle()
  assert.equal(h.phase(), 'offline')
  assert.equal(JSON.parse(h.storage.getItem(SYNC_STORAGE_KEY)).baseRevision, 2)
  h.sync.setOnline(true)
  h.remote(snapshot(local, 2))
  assert.equal(h.phase(), 'saved')
  assert.equal(h.saves.length, 1)
})

test('a request failing after an offline/online cycle restarts the confirmed read', async (t) => {
  const base = initial()
  const local = edited(base, 'Envio interrompido')
  const h = harness(t)
  h.remote(snapshot(base, 1))
  h.sync.change(local)
  await settle()
  h.sync.setOnline(false)
  h.sync.setOnline(true)
  h.remote(snapshot(base, 1))
  h.saves[0].reject({ code: 'unavailable' })
  await settle()
  assert.equal(h.phase(), 'connecting')
  assert.equal(h.listeners.length, 3)
  h.remote(snapshot(base, 1))
  await settle()
  assert.deepEqual(h.saves[1].state, local)
})

test('fingerprints ignore object-key order while retaining meaningful array order', () => {
  assert.equal(stateFingerprint({ b: 2, a: { d: 4, c: 3 } }), stateFingerprint({ a: { c: 3, d: 4 }, b: 2 }))
  assert.notEqual(stateFingerprint({ ids: ['a', 'b'] }), stateFingerprint({ ids: ['b', 'a'] }))
})
