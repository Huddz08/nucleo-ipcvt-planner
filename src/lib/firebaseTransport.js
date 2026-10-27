import { migrateLegacyState, normalizePlannerState } from './planner.js'

// This is the same public Firebase project used by the previous planner.
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyAg9w5QohkcmXUFRgLfSI5Sh1chnCD1Owc',
  authDomain: 'repertorio-ipcvt.firebaseapp.com',
  projectId: 'repertorio-ipcvt',
  appId: '1:774659782213:web:79a4590ad0caf6a282152c',
})

const APP_NAME = 'ipcvt-planner'
const DOCUMENT_PATH = ['app_ipcvt', 'planner_dados']
let firebaseSdk

function transportError(code, message, remote) {
  const error = new Error(message)
  error.code = code
  if (remote !== undefined) error.remote = remote
  return error
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decodeDocument(data) {
  if (data === null) return { state: null, revision: 0 }
  if (!isRecord(data)) throw transportError('invalid-data', 'O planejamento da rede está em um formato inválido.')

  if (Object.hasOwn(data, 'plannerV2')) {
    const envelope = data.plannerV2
    if (!isRecord(envelope) || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1) {
      throw transportError('invalid-data', 'A revisão do planejamento da rede é inválida.')
    }
    const state = normalizePlannerState(envelope.state)
    if (!state) throw transportError('invalid-data', 'O planejamento da rede contém dados inválidos.')
    return { state, revision: envelope.revision }
  }

  if (Object.hasOwn(data, 'people') || Object.hasOwn(data, 'assignments')) {
    const legacyState = migrateLegacyState(data)
    if (!legacyState) throw transportError('invalid-data', 'O planejamento anterior da rede contém dados inválidos.')
    return { state: null, revision: 0, legacyState }
  }
  if (Object.keys(data).length === 0) return { state: null, revision: 0 }
  throw transportError('invalid-data', 'O documento da rede não contém um planejamento reconhecido.')
}

async function loadFirebaseSdk() {
  firebaseSdk ??= Promise.all([import('firebase/app'), import('firebase/firestore')])
    .then(([app, firestore]) => ({ ...app, ...firestore }))
    .catch((error) => {
      firebaseSdk = undefined
      throw error
    })
  return firebaseSdk
}

/** Network transport only; local pending changes are managed by the sync controller. */
export function createFirebaseTransport({ sdk, config = FIREBASE_CONFIG } = {}) {
  let connection
  function connect() {
    connection ??= Promise.resolve(sdk ?? loadFirebaseSdk()).then((api) => {
      const app = api.getApps().find((item) => item.name === APP_NAME) ?? api.initializeApp(config, APP_NAME)
      const database = api.getFirestore(app)
      return { api, database, reference: api.doc(database, ...DOCUMENT_PATH) }
    }).catch((error) => {
      connection = undefined
      throw error
    })
    return connection
  }

  return {
    subscribe(onRemote, onError) {
      let active = true
      let terminal = false
      let confirmed = false
      let unavailableReported = false
      let unsubscribe
      let initialTimer = setTimeout(() => {
        initialTimer = null
        if (!confirmed) reportUnavailable()
      }, 12_000)

      function clearInitialTimer() {
        if (initialTimer !== null) clearTimeout(initialTimer)
        initialTimer = null
      }

      function reportUnavailable() {
        if (!active || terminal || unavailableReported) return
        unavailableReported = true
        onError(transportError('unavailable', 'Não foi possível confirmar a conexão com o planejamento da rede.'))
      }

      function terminalError(error) {
        if (!active || terminal) return
        terminal = true
        clearInitialTimer()
        onError(error)
      }

      connect().then(({ api, reference }) => {
        if (!active || terminal) return
        unsubscribe = api.onSnapshot(reference, { includeMetadataChanges: true }, (snapshot) => {
          // A local cache event cannot confirm that another device can see these changes.
          if (!active || terminal) return
          if (snapshot.metadata.fromCache) {
            if (confirmed) reportUnavailable()
            return
          }
          if (snapshot.metadata.hasPendingWrites) return
          confirmed = true
          unavailableReported = false
          clearInitialTimer()
          let remote
          try {
            remote = decodeDocument(snapshot.exists() ? snapshot.data() : null)
          } catch (error) {
            onError(error)
            return
          }
          onRemote(remote)
        }, terminalError)
      }).catch(terminalError)
      return () => {
        active = false
        clearInitialTimer()
        unsubscribe?.()
      }
    },

    async save(state, expectedRevision) {
      const normalized = normalizePlannerState(state)
      if (!normalized) throw transportError('invalid-data', 'O planejamento local contém dados inválidos.')
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw transportError('invalid-argument', 'É necessário conhecer a revisão da rede antes de salvar.')
      }
      // Capture this specific edit before awaiting the SDK or retrying a transaction.
      const savedState = JSON.parse(JSON.stringify(normalized))
      const { api, database, reference } = await connect()
      return api.runTransaction(database, async (transaction) => {
        const snapshot = await transaction.get(reference)
        const remote = decodeDocument(snapshot.exists() ? snapshot.data() : null)
        if (remote.revision !== expectedRevision) {
          throw transportError('conflict', 'O planejamento foi alterado em outro dispositivo.', remote)
        }
        if (remote.revision === Number.MAX_SAFE_INTEGER) {
          throw transportError('invalid-data', 'A revisão do planejamento ultrapassou o limite permitido.')
        }
        const revision = remote.revision + 1
        const envelope = { state: savedState, revision, updatedAt: api.serverTimestamp() }
        // Replace the complete envelope, including removed notes, while keeping the legacy backup fields.
        transaction.set(reference, { plannerV2: envelope }, { mergeFields: ['plannerV2'] })
        return { state: savedState, revision }
      })
    },
  }
}
