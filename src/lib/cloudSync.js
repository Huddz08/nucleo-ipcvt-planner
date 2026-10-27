import { normalizePlannerState } from './planner.js'

export const SYNC_STORAGE_KEY = 'ipcvt-planner-sync-v1'
export const CONFLICT_BACKUP_KEY = 'ipcvt-planner-conflict-backup-v1'

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  return value
}

export const stateFingerprint = (state) => JSON.stringify(stable(state))

const errorCode = (error) => String(error?.code || '').replace(/^firestore\//, '')
const isOfflineError = (error) => ['offline', 'unavailable', 'network-request-failed', 'deadline-exceeded'].includes(errorCode(error))

function validState(state) {
  try { return normalizePlannerState(state) } catch { return null }
}

function remoteSnapshot(value) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0) return null
  const state = value.state === null ? null : validState(value.state)
  if (value.state !== null && !state) return null
  return { state, revision: value.revision, legacyState: validState(value.legacyState) }
}

function defaultStorage() {
  try { return globalThis.localStorage } catch { return null }
}

/** Coordinates confirmed server snapshots and conditional writes without owning the UI. */
export function createCloudSync({
  transport, initialState, hasLocalState = false, storage = defaultStorage(),
  onRemoteState = () => {}, onStatus = () => {}, debounceMs = 500,
}) {
  const initial = validState(initialState)
  if (!initial) throw new TypeError('O planejamento inicial não é válido.')
  if (!transport?.subscribe || !transport?.save) throw new TypeError('Transporte de sincronização inválido.')

  let local = initial
  let fingerprint = stateFingerprint(local)
  const initialFingerprint = fingerprint
  let hasBase = false
  let baseState = null
  let baseRevision = null
  let baseFingerprint = null
  let dirty = Boolean(hasLocalState)
  let latestRemote = null
  let conflict = null
  let running = false
  let online = typeof navigator === 'undefined' || navigator.onLine !== false
  let connected = false
  let unsubscribe = null
  let timer = null
  let inFlight = null
  let epoch = 0
  let subscription = 0

  if (hasLocalState) {
    try {
      const metadata = JSON.parse(storage?.getItem(SYNC_STORAGE_KEY) || 'null')
      const savedBase = metadata?.baseState === null ? null : validState(metadata?.baseState)
      if (metadata?.version === 1 && metadata.hasBase !== false
        && Number.isSafeInteger(metadata.baseRevision) && metadata.baseRevision >= 0
        && (metadata.baseState === null || savedBase)) {
        hasBase = true
        baseState = savedBase
        baseRevision = metadata.baseRevision
        baseFingerprint = baseState === null ? null : stateFingerprint(baseState)
        dirty = fingerprint !== baseFingerprint
      }
    } catch { /* An unreadable sync record cannot replace the local planning data. */ }
  }

  function status(phase, message) {
    if (!running) return
    if (!online && ['connecting', 'saving', 'saved'].includes(phase)) {
      phase = 'offline'
      message = 'Sem conexão. As alterações continuam neste aparelho e serão enviadas quando a conexão voltar.'
    }
    onStatus({ phase, ...(message ? { message } : {}), ...(conflict ? { remote: conflict } : {}) })
  }

  function persist() {
    try {
      storage?.setItem(SYNC_STORAGE_KEY, JSON.stringify({
        version: 1, hasBase, baseState, baseRevision,
        localFingerprint: fingerprint, dirty,
      }))
    } catch { /* Local planner persistence is reported independently by the application. */ }
  }

  function cancelTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function setBase(remote) {
    hasBase = true
    baseState = remote.state
    baseRevision = remote.revision
    baseFingerprint = remote.state === null ? null : stateFingerprint(remote.state)
    dirty = fingerprint !== baseFingerprint
    persist()
  }

  function adopt(remote) {
    const nextFingerprint = stateFingerprint(remote.state)
    const changed = fingerprint !== nextFingerprint
    local = remote.state
    fingerprint = nextFingerprint
    conflict = null
    setBase(remote)
    if (changed) onRemoteState(local)
    status('saved')
  }

  function flagConflict(remote, message) {
    cancelTimer()
    conflict = remote
    persist()
    status('conflict', message || 'Há alterações diferentes neste aparelho e na rede. Escolha qual planejamento usar.')
  }

  function queueSave(delay = debounceMs) {
    cancelTimer()
    if (!running || !online || !connected || !hasBase || !dirty || conflict) return
    status('saving')
    if (inFlight) return
    timer = setTimeout(flush, Math.max(0, delay))
  }

  function fail(error) {
    connected = false
    cancelTimer()
    const offline = isOfflineError(error)
      || (typeof navigator !== 'undefined' && navigator.onLine === false)
    status(offline ? 'offline' : 'error', offline
      ? 'Sem conexão. As alterações continuam neste aparelho e serão enviadas quando a conexão voltar.'
      : 'Não foi possível sincronizar. Suas alterações continuam neste aparelho. Tente novamente.')
  }

  function receive(value) {
    const remote = remoteSnapshot(value)
    if (!remote) {
      fail({ code: 'invalid-state' })
      return
    }
    // An older acknowledgement must never undo a newer server snapshot.
    if (latestRemote && remote.revision < latestRemote.revision) return
    latestRemote = remote
    connected = online
    if (conflict) {
      if (remote.state && stateFingerprint(remote.state) === fingerprint) {
        conflict = null
        setBase(remote)
        status('saved')
      } else flagConflict(remote)
      return
    }

    const remoteFingerprint = remote.state === null ? null : stateFingerprint(remote.state)
    // A listener can acknowledge our write before the save promise resolves.
    if (inFlight && remoteFingerprint === inFlight.fingerprint && remote.revision > inFlight.revision) {
      setBase(remote)
      status(dirty ? 'saving' : 'saved')
      return
    }

    if (!hasBase) {
      if (remote.state === null) {
        if (!hasLocalState && fingerprint === initialFingerprint && remote.legacyState) {
          local = remote.legacyState
          fingerprint = stateFingerprint(local)
          onRemoteState(local)
        }
        setBase(remote)
        queueSave()
      } else if ((!hasLocalState && fingerprint === initialFingerprint) || remoteFingerprint === fingerprint) adopt(remote)
      else flagConflict(remote)
      return
    }

    if (remoteFingerprint === fingerprint && remote.state) {
      setBase(remote)
      status('saved')
      return
    }
    if (remote.revision === baseRevision && remoteFingerprint === baseFingerprint) {
      if (dirty) queueSave()
      else status('saved')
      return
    }
    // A revision with unchanged content is still a usable base for pending edits.
    if (remoteFingerprint === baseFingerprint) {
      setBase(remote)
      if (dirty) queueSave()
      else status('saved')
      return
    }
    if (!dirty && remote.state) adopt(remote)
    else flagConflict(remote)
  }

  function flush() {
    timer = null
    if (!running || !online || !connected || !hasBase || !dirty || conflict || inFlight) return
    const operation = { state: local, fingerprint, revision: baseRevision, epoch, subscription }
    inFlight = operation
    status('saving')
    Promise.resolve().then(() => transport.save(operation.state, operation.revision)).then((saved) => {
      if (!running || operation.epoch !== epoch || inFlight !== operation) return
      // Keep inFlight set while processing the ACK so receive recognizes its origin.
      receive(saved)
      inFlight = null
      if (conflict || !connected) return
      if (dirty) queueSave()
      else status('saved')
    }, (error) => {
      if (!running || operation.epoch !== epoch || inFlight !== operation) return
      inFlight = null
      if (errorCode(error) === 'conflict') {
        let remote = remoteSnapshot(error.remote)
        if (remote) {
          if (latestRemote && latestRemote.revision > remote.revision) remote = latestRemote
          receive(remote)
        } else fail({ code: 'invalid-state' })
      } else if (online && operation.subscription !== subscription && isOfflineError(error)) {
        // A request from before an offline/online cycle may fail after the new
        // listener is already connected. Confirm its base again and retry once.
        connect()
      } else fail(error)
    })
  }

  function connect() {
    cancelTimer()
    connected = false
    const token = ++subscription
    try { unsubscribe?.() } catch { /* Listener cleanup must not prevent reconnecting. */ }
    unsubscribe = null
    if (!online) {
      status('offline', 'Sem conexão. As alterações continuam neste aparelho e serão enviadas quando a conexão voltar.')
      return
    }
    status('connecting')
    try {
      const detach = transport.subscribe(
        (value) => { if (running && token === subscription) receive(value) },
        (error) => { if (running && token === subscription) fail(error) },
      )
      if (running && token === subscription) unsubscribe = detach
      else if (typeof detach === 'function') detach()
    } catch (error) { if (running && token === subscription) fail(error) }
  }

  function start() {
    if (running) return stop
    running = true
    epoch += 1
    connect()
    return stop
  }

  function stop() {
    running = false
    connected = false
    epoch += 1
    subscription += 1
    cancelTimer()
    try { unsubscribe?.() } catch { /* No work remains after stopping. */ }
    unsubscribe = null
    inFlight = null
  }

  function change(value) {
    const next = validState(value)
    if (!next) throw new TypeError('O planejamento não é válido.')
    const nextFingerprint = stateFingerprint(next)
    if (fingerprint === nextFingerprint) return
    local = next
    fingerprint = nextFingerprint
    dirty = hasBase ? fingerprint !== baseFingerprint : Boolean(hasLocalState || fingerprint !== initialFingerprint)
    persist()
    if (conflict) {
      if (conflict.state && stateFingerprint(conflict.state) === fingerprint) {
        const remote = conflict
        conflict = null
        setBase(remote)
        status('saved')
      } else status('conflict')
    } else if (!connected) {
      // Keep an offline/error status visible until a confirmed server read succeeds.
    } else if (dirty) queueSave()
    else if (!inFlight) { cancelTimer(); status('saved') }
  }

  function preserveConflict(choice) {
    if (!conflict) return false
    try {
      if (!storage?.setItem) throw new Error('Storage unavailable')
      let records
      try { records = JSON.parse(storage.getItem(CONFLICT_BACKUP_KEY) || '[]') } catch { records = [] }
      if (!Array.isArray(records)) records = []
      records.push({ at: new Date().toISOString(), choice, localState: local, remoteState: conflict.state, remoteRevision: conflict.revision })
      storage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify(records.slice(-5)))
      return true
    } catch {
      status('conflict', 'Não foi possível guardar uma cópia antes de resolver o conflito. Libere espaço neste navegador ou baixe um backup.')
      return false
    }
  }

  function useRemote() {
    if (!conflict || !preserveConflict('remote')) return false
    const remote = conflict
    conflict = null
    connected = online
    if (remote.state) adopt(remote)
    else {
      const next = remote.legacyState || initial
      const changed = fingerprint !== stateFingerprint(next)
      local = next
      fingerprint = stateFingerprint(next)
      setBase(remote)
      if (changed) onRemoteState(local)
      queueSave(0)
    }
    return true
  }

  function keepLocal() {
    if (!conflict || !preserveConflict('local')) return false
    const remote = conflict
    conflict = null
    connected = online
    setBase(remote)
    if (dirty) queueSave(0)
    else status('saved')
    return true
  }

  function retry() {
    if (!running) return start()
    if (inFlight) return
    connect()
  }

  function setOnline(value) {
    const next = Boolean(value)
    if (online === next) return
    online = next
    if (running) connect()
  }

  return { start, stop, change, retry, useRemote, keepLocal, setOnline }
}
