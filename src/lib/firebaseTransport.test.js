import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState } from './planner.js'
import { createFirebaseTransport } from './firebaseTransport.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
const tick = () => new Promise((resolve) => setImmediate(resolve))
const snapshot = (value, metadata = {}) => ({
  exists: () => value !== null,
  data: () => value,
  metadata: { fromCache: false, hasPendingWrites: false, ...metadata },
})

function fakeFirebase(initial = null) {
  let value = initial
  let listener
  let listenerError
  let unsubscribed = 0
  let commitError
  const writes = []
  const apps = []
  const api = {
    getApps: () => apps,
    initializeApp: (config, name) => {
      const app = { config, name }
      apps.push(app)
      return app
    },
    getFirestore: () => 'database',
    doc: (_database, ...path) => path.join('/'),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    onSnapshot: (reference, options, onRemote, onError) => {
      assert.equal(reference, 'app_ipcvt/planner_dados')
      assert.equal(options.includeMetadataChanges, true)
      listener = onRemote
      listenerError = onError
      return () => { unsubscribed += 1 }
    },
    runTransaction: async (_database, callback) => {
      let pending
      const result = await callback({
        get: async () => snapshot(value),
        set: (reference, data, options) => { pending = { reference, data, options } },
      })
      if (commitError) throw commitError
      if (pending) {
        writes.push(pending)
        value = { ...(value ?? {}), ...clone(pending.data) }
      }
      return result
    },
  }
  return {
    api, writes, apps,
    get value() { return value },
    get unsubscribed() { return unsubscribed },
    setCommitError(error) { commitError = error },
    emit(data = value, metadata) { listener(snapshot(data, metadata)) },
    fail(error) { listenerError(error) },
  }
}

test('only confirmed server snapshots reach the controller, and unsubscribe stops updates', async () => {
  const state = createInitialState()
  const backend = fakeFirebase({ plannerV2: { state, revision: 4 } })
  const received = []
  const errors = []
  const stop = createFirebaseTransport({ sdk: backend.api }).subscribe((remote) => received.push(remote), (error) => errors.push(error))
  await tick()
  backend.emit(undefined, { fromCache: true })
  backend.emit(undefined, { hasPendingWrites: true })
  assert.equal(received.length, 0)
  backend.emit()
  assert.deepEqual(received, [{ state, revision: 4 }])
  stop()
  backend.emit()
  backend.fail(new Error('Late listener error'))
  assert.equal(received.length, 1)
  assert.equal(errors.length, 0)
  assert.equal(backend.unsubscribed, 1)
})

test('an empty server has revision zero while a legacy board is offered without replacing the local board', async () => {
  const initial = createInitialState()
  const legacy = { people: initial.people, assignments: { soprano: ['laura'] }, updatedAt: 'legacy timestamp' }
  const backend = fakeFirebase(legacy)
  const received = []
  const stop = createFirebaseTransport({ sdk: backend.api }).subscribe((remote) => received.push(remote), assert.fail)
  await tick()
  backend.emit(null)
  backend.emit()
  assert.deepEqual(received[0], { state: null, revision: 0 })
  assert.equal(received[1].state, null)
  assert.equal(received[1].revision, 0)
  assert.deepEqual(received[1].legacyState.teams[0].assignments.soprano, ['laura'])
  assert.deepEqual(received[1].legacyState.people, initial.people)
  stop()
})

test('invalid remote envelopes and legacy documents report errors without publishing fresh defaults', async () => {
  const backend = fakeFirebase()
  const received = []
  const errors = []
  const stop = createFirebaseTransport({ sdk: backend.api }).subscribe((remote) => received.push(remote), (error) => errors.push(error))
  await tick()
  for (const data of [
    { plannerV2: null },
    { plannerV2: { state: createInitialState(), revision: '2' } },
    { plannerV2: { state: {}, revision: 1 } },
    { people: 'invalid', assignments: {} },
    { updatedAt: 'no recognized planner' },
  ]) backend.emit(data)
  assert.equal(received.length, 0)
  assert.equal(errors.length, 5)
  assert.ok(errors.every((error) => error.code === 'invalid-data'))
  stop()
})

test('saving replaces the whole envelope, preserves the old backup and acknowledges a committed revision', async () => {
  const state = createInitialState()
  const backend = fakeFirebase({ people: state.people, assignments: { tenor: ['hudson'] }, updatedAt: 'keep legacy date' })
  const transport = createFirebaseTransport({ sdk: backend.api })
  const original = clone(state)
  const first = await transport.save(state, 0)
  assert.equal(first.revision, 1)
  assert.deepEqual(first.state, state)
  assert.deepEqual(state, original)
  assert.deepEqual(backend.writes[0].options, { mergeFields: ['plannerV2'] })
  assert.deepEqual(backend.value.assignments, { tenor: ['hudson'] })
  assert.equal(backend.value.updatedAt, 'keep legacy date')
  assert.equal(backend.value.plannerV2.updatedAt, 'SERVER_TIMESTAMP')

  const withNote = clone(state)
  withNote.notes['time-a'] = 'Apagar depois'
  await transport.save(withNote, 1)
  await transport.save(state, 2)
  assert.deepEqual(backend.value.plannerV2.state.notes, {})
  assert.equal(backend.value.plannerV2.revision, 3)
})

test('a stale revision cannot overwrite edits made on another device', async () => {
  const remote = createInitialState()
  remote.notes['time-a'] = 'Alteração em outro dispositivo'
  const backend = fakeFirebase({ plannerV2: { state: remote, revision: 7 } })
  await assert.rejects(createFirebaseTransport({ sdk: backend.api }).save(createInitialState(), 6), (error) => {
    assert.equal(error.code, 'conflict')
    assert.deepEqual(error.remote, { state: remote, revision: 7 })
    return true
  })
  assert.equal(backend.writes.length, 0)
  assert.equal(backend.value.plannerV2.revision, 7)
})

test('invalid local data, invalid remote data and failed commits never return a save acknowledgement', async () => {
  const state = createInitialState()
  const backend = fakeFirebase({ plannerV2: { state: {}, revision: 1 } })
  const transport = createFirebaseTransport({ sdk: backend.api })
  await assert.rejects(transport.save({}, 1), { code: 'invalid-data' })
  await assert.rejects(transport.save(state, null), { code: 'invalid-argument' })
  await assert.rejects(transport.save(state, 1), { code: 'invalid-data' })
  assert.equal(backend.writes.length, 0)

  const denied = fakeFirebase()
  const error = Object.assign(new Error('Missing permissions'), { code: 'permission-denied' })
  denied.setCommitError(error)
  await assert.rejects(createFirebaseTransport({ sdk: denied.api }).save(state, 0), error)
  assert.equal(denied.writes.length, 0)
  assert.equal(denied.value, null)
})

test('unsubscribing during lazy SDK loading does not attach a listener afterward', async () => {
  let resolveSdk
  const sdk = new Promise((resolve) => { resolveSdk = resolve })
  const backend = fakeFirebase()
  const stop = createFirebaseTransport({ sdk }).subscribe(assert.fail, assert.fail)
  stop()
  resolveSdk(backend.api)
  await tick()
  assert.equal(backend.unsubscribed, 0)
})

test('losing server confirmation reports unavailable once and a server snapshot restores the subscription', async () => {
  const state = createInitialState()
  const backend = fakeFirebase({ plannerV2: { state, revision: 3 } })
  const received = []
  const errors = []
  const stop = createFirebaseTransport({ sdk: backend.api }).subscribe((remote) => received.push(remote), (error) => errors.push(error))
  await tick()
  backend.emit(undefined, { fromCache: true })
  assert.equal(errors.length, 0)
  backend.emit()
  backend.emit(undefined, { hasPendingWrites: true })
  assert.equal(errors.length, 0)
  backend.emit(undefined, { fromCache: true })
  backend.emit(undefined, { fromCache: true, hasPendingWrites: true })
  assert.deepEqual(errors.map((error) => error.code), ['unavailable'])
  assert.equal(backend.unsubscribed, 0)
  backend.emit()
  assert.equal(received.length, 2)
  backend.emit(undefined, { fromCache: true })
  assert.deepEqual(errors.map((error) => error.code), ['unavailable', 'unavailable'])
  stop()
})

test('the initial confirmation timeout includes SDK loading and stays recoverable', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let resolveSdk
  const sdk = new Promise((resolve) => { resolveSdk = resolve })
  const backend = fakeFirebase()
  const received = []
  const errors = []
  const stop = createFirebaseTransport({ sdk }).subscribe((remote) => received.push(remote), (error) => errors.push(error))
  context.mock.timers.tick(11_999)
  assert.equal(errors.length, 0)
  context.mock.timers.tick(1)
  assert.deepEqual(errors.map((error) => error.code), ['unavailable'])
  context.mock.timers.tick(24_000)
  assert.equal(errors.length, 1)
  resolveSdk(backend.api)
  await tick()
  backend.emit(null)
  assert.deepEqual(received, [{ state: null, revision: 0 }])
  assert.equal(backend.unsubscribed, 0)
  stop()
})

test('confirmed snapshots, terminal errors and unsubscribe clear the initial timeout', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const backend = fakeFirebase()
  const errors = []
  const stop = createFirebaseTransport({ sdk: backend.api }).subscribe(() => {}, (error) => errors.push(error))
  await tick()
  backend.emit(null)
  context.mock.timers.tick(12_000)
  assert.equal(errors.length, 0)
  stop()

  const denied = fakeFirebase()
  const stopDenied = createFirebaseTransport({ sdk: denied.api }).subscribe(() => {}, (error) => errors.push(error))
  await tick()
  denied.fail(Object.assign(new Error('Denied'), { code: 'permission-denied' }))
  context.mock.timers.tick(12_000)
  assert.deepEqual(errors.map((error) => error.code), ['permission-denied'])
  stopDenied()

  const stopped = fakeFirebase()
  const stopEarly = createFirebaseTransport({ sdk: stopped.api }).subscribe(assert.fail, (error) => errors.push(error))
  stopEarly()
  await tick()
  context.mock.timers.tick(12_000)
  assert.equal(errors.length, 1)
})
