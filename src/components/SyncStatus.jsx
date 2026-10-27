import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const phases = {
  connecting: { label: 'Conectando à rede', icon: 'move', description: 'Buscando o planejamento compartilhado. Você pode continuar trabalhando.' },
  saving: { label: 'Salvando na rede', icon: 'upload', description: 'Enviando as alterações. Aguarde a confirmação antes de fechar o planner.' },
  saved: { label: 'Salvo na rede', icon: 'check-circle', description: 'O planejamento está salvo na rede e disponível nos outros aparelhos.' },
  offline: { label: 'Salvo neste aparelho', icon: 'notebook', description: 'Sem conexão com a rede. As alterações ficam neste aparelho e serão enviadas quando a conexão voltar.' },
  error: { label: 'Não foi possível sincronizar', icon: 'help', description: 'Não foi possível salvar na rede. Tente novamente ou baixe uma cópia do planejamento.' },
  conflict: { label: 'Revisar versões', icon: 'copy', description: 'Há alterações diferentes neste aparelho e na rede. Escolha qual planejamento usar.' },
}

function syncInfo(status, localSaveError) {
  const phase = Object.hasOwn(phases, status?.phase) ? status.phase : 'connecting'
  const info = phases[phase]
  const label = localSaveError && phase === 'offline' ? 'Sem cópia salva neste aparelho'
    : localSaveError && phase === 'saved' ? 'Salvo na rede, sem cópia neste aparelho'
      : localSaveError && phase === 'saving' ? 'Salvando na rede, sem cópia neste aparelho'
        : localSaveError && phase === 'connecting' ? 'Não foi possível salvar neste aparelho'
      : info.label
  return { ...info, phase, label, attention: localSaveError || ['offline', 'error', 'conflict'].includes(phase) }
}

export default function SyncStatus({ status, localSaveError = false }) {
  const [expanded, setExpanded] = useState(false)
  const container = useRef(null)
  const detailsId = useId()
  const info = syncInfo(status, localSaveError)

  useEffect(() => {
    if (!expanded) return
    const closeOutside = (event) => { if (!container.current?.contains(event.target)) setExpanded(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setExpanded(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded])

  useEffect(() => { setExpanded(false) }, [info.phase, localSaveError])

  return <div className="sync-status" ref={container}>
    <button
      type="button"
      className={`sync-status-indicator sync-phase-${info.phase}${localSaveError ? ' sync-local-error' : ''}`}
      aria-label={info.label}
      title={info.label}
      aria-controls={info.attention ? 'planner-sync-notice' : detailsId}
      aria-expanded={info.attention ? undefined : expanded}
      onClick={() => {
        const notice = info.attention && document.getElementById('planner-sync-notice')
        if (notice) { setExpanded(false); notice.focus(); return }
        setExpanded((value) => !value)
      }}
    ><Icon name={info.icon} size={18} /><span className="sync-status-dot" /></button>
    {expanded && <div className="sync-status-details" id={detailsId} role="status">
      <strong>{info.label}</strong>
      <p>{localSaveError ? 'A cópia neste aparelho não pôde ser gravada. Baixe um backup para guardar suas alterações.' : info.description}</p>
    </div>}
  </div>
}

export function SyncNotice({ status, localSaveError = false, onRetry, onUseRemote, onKeepLocal, onBackup }) {
  const info = syncInfo(status, localSaveError)
  if (!info.attention) return null
  const isConflict = info.phase === 'conflict'
  const isFailure = info.phase === 'error'
  const message = typeof status?.message === 'string' && status.message.trim() ? status.message : null

  return <aside
    id="planner-sync-notice"
    className={`sync-notice sync-notice-${info.phase}${localSaveError ? ' sync-notice-local-error' : ''}`}
    role={isConflict || isFailure || localSaveError ? 'alert' : 'status'}
    aria-labelledby="planner-sync-notice-title"
    tabIndex={-1}
  >
    <Icon name={info.icon} size={19} />
    <div className="sync-notice-content">
      <strong id="planner-sync-notice-title">{info.label}</strong>
      {isConflict ? <>
        <p>Há alterações diferentes neste aparelho e na rede. Escolha qual planejamento usar. A escolha define a versão disponível nos outros aparelhos.</p>
        {message && message !== 'Há alterações diferentes neste aparelho e na rede. Escolha qual planejamento usar.' && <p>{message}</p>}
      </>
        : info.phase === 'offline' && localSaveError ? <p>Sem conexão com a rede e sem uma cópia salva neste aparelho. Mantenha esta página aberta e baixe um backup para guardar suas alterações.</p>
          : <p>{message || info.description}</p>}
      {localSaveError && info.phase !== 'offline' && <p>A cópia neste aparelho não pôde ser gravada. Baixe um backup para guardar suas alterações.</p>}
      {isFailure && !localSaveError && <p>Suas alterações continuam salvas neste aparelho.</p>}
      <div className="sync-notice-actions">
        {isConflict && <>
          <button type="button" className="primary-button" onClick={onUseRemote} disabled={!onUseRemote}>Carregar da rede</button>
          <button type="button" className="secondary-button" onClick={onKeepLocal} disabled={!onKeepLocal}>Usar este planejamento</button>
        </>}
        {!isConflict && ['offline', 'error'].includes(info.phase) && onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Tentar novamente</button>}
        {onBackup && <button type="button" className="text-button" onClick={onBackup}><Icon name="download" size={15} />Baixar backup deste aparelho</button>}
      </div>
    </div>
  </aside>
}
