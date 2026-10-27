import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createCloudSync } from './cloudSync.js'
import { createFirebaseTransport } from './firebaseTransport.js'
import { migrateLegacyState, normalizePlannerState, STORAGE_KEY } from './planner.js'

function hasSavedPlanning() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && normalizePlannerState(JSON.parse(saved))) return true
  } catch { /* A damaged v2 save must not hide a recoverable legacy board. */ }
  try {
    const legacy = localStorage.getItem('nucleo-ipcvt-planner-v1')
    return Boolean(legacy && migrateLegacyState(JSON.parse(legacy)))
  } catch { return false }
}

export function useCloudPlanner(state, onRemoteState) {
  const initial = useRef(null)
  if (initial.current === null) initial.current = { state, hasLocalState: hasSavedPlanning() }
  const receiver = useRef(onRemoteState)
  receiver.current = onRemoteState
  const observedState = useRef(state)
  const controller = useRef(null)
  const [status, setStatus] = useState({ phase: 'connecting' })

  useEffect(() => {
    const sync = createCloudSync({
      transport: createFirebaseTransport(),
      initialState: initial.current.state,
      hasLocalState: initial.current.hasLocalState,
      onStatus: setStatus,
      onRemoteState: (next) => {
        observedState.current = next
        receiver.current(next)
      },
    })
    controller.current = sync
    const online = () => sync.setOnline(true)
    const offline = () => sync.setOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    sync.start()
    if (navigator.onLine === false) sync.setOnline(false)
    return () => {
      sync.stop()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      if (controller.current === sync) controller.current = null
    }
  }, [])

  useLayoutEffect(() => {
    if (observedState.current === state) return
    observedState.current = state
    controller.current?.change(state)
  }, [state])

  return {
    status,
    retry: () => controller.current?.retry(),
    useRemote: () => controller.current?.useRemote(),
    keepLocal: () => controller.current?.keepLocal(),
  }
}
