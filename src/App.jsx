import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './components/Icon.jsx'
import Avatar from './components/Avatar.jsx'
import PlaybookBackground from './components/PlaybookBackground.jsx'
import PlannerDialogs from './components/PlannerDialogs.jsx'
import TeamBoard from './components/TeamBoard.jsx'
import { STORAGE_KEY, allRoles, applyAssignment, normalizePlannerState, personSkills, readPlannerState, removeAssignment } from './lib/planner.js'

const DRAG_TYPE = 'application/x-ipcvt-person'
const THEME_KEY = 'ipcvt-planner-theme'
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function readTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export default function App() {
  const [history, setHistory] = useState(() => ({ past: [], present: readPlannerState(), future: [] }))
  const state = history.present
  const [activeTeamId, setActiveTeamId] = useState(state.teams[0].id)
  const [teamFilter, setTeamFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [peopleFilter, setPeopleFilter] = useState('all')
  const [selection, setSelected] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [structureType, setStructureType] = useState('role')
  const [structureGroup, setStructureGroup] = useState(state.groups[0]?.id || '')
  const importRef = useRef(null)
  const menuRef = useRef(null)

  const activeTeam = state.teams.find((team) => team.id === activeTeamId) || state.teams[0]
  const resolvedTeamFilter = state.teams.some((team) => team.id === teamFilter) ? teamFilter : 'all'
  const resolvedGroupFilter = state.groups.some((group) => group.id === groupFilter) ? groupFilter : 'all'
  const visibleTeams = state.teams.filter((team) => resolvedTeamFilter === 'all' || team.id === resolvedTeamFilter)
  const visibleGroups = state.groups.filter((group) => resolvedGroupFilter === 'all' || group.id === resolvedGroupFilter)
  const roles = useMemo(() => allRoles(state.groups), [state.groups])
  const peopleById = useMemo(() => Object.fromEntries(state.people.map((person) => [person.id, person])), [state.people])
  const sourceTeam = state.teams.find((team) => team.id === selection?.teamId)
  const selected = selection && peopleById[selection.personId] && (!selection.fromRoleId || sourceTeam?.assignments[selection.fromRoleId]?.includes(selection.personId)) ? selection : null
  const counts = useMemo(() => {
    const result = {}
    Object.values(activeTeam.assignments).flat().forEach((id) => { result[id] = (result[id] || 0) + 1 })
    return result
  }, [activeTeam])
  const filteredPeople = state.people.filter((person) => normalize(person.name).includes(normalize(search.trim())) && (peopleFilter !== 'available' || !counts[person.id]))

  const commit = useCallback((updater) => setHistory((current) => {
    const next = typeof updater === 'function' ? updater(current.present) : updater
    return next === current.present ? current : { past: [...current.past.slice(-39), current.present], present: next, future: [] }
  }), [])
  const undo = useCallback(() => setHistory((current) => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1), future: [current.present, ...current.future] } : current), [])
  const redo = useCallback(() => setHistory((current) => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) } : current), [])
  const notify = (message) => setToast(message)
  const openModal = (next) => { setModal(next); setMenuOpen(false) }

  // New, restored, or duplicated teams join the complete board immediately.
  function showCreatedTeam(id) {
    setActiveTeamId(id)
    setTeamFilter('all')
    setSelected(null)
  }

  // Also update a board kept open while the application is refreshed in development.
  useEffect(() => {
    setHistory((current) => {
      const present = normalizePlannerState(current.present)
      if (!present || present === current.present) return current
      const normalizeSnapshot = (snapshot) => normalizePlannerState(snapshot) || snapshot
      return { present, past: current.past.map(normalizeSnapshot), future: current.future.map(normalizeSnapshot) }
    })
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaveError(false) } catch { setSaveError(true) }
  }, [state])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#2b4436')
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* The theme also works without storage. */ }
  }, [theme])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { setSelected(null); setMenuOpen(false) }
      if (modal || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
      }
      if (event.key === '/') {
        event.preventDefault()
        setSidebarOpen(true)
        requestAnimationFrame(() => document.querySelector('[aria-label="Buscar integrante"]')?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, undo, redo])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  function changeTeamFilter(id) {
    setTeamFilter(id)
    if (id !== 'all') setActiveTeamId(id)
    setSelected(null)
    setDragging(null)
  }
  function selectPerson(item) {
    setSelected((current) => current?.personId === item.personId && current?.fromRoleId === item.fromRoleId && current?.teamId === item.teamId ? null : item)
    if (item.teamId) setActiveTeamId(item.teamId)
    if (!item.fromRoleId && window.matchMedia('(max-width: 1100px)').matches) setSidebarOpen(false)
  }
  function dragStart(event, personId, fromRoleId = null, teamId = null) {
    const payload = { personId, fromRoleId, teamId }
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
    event.dataTransfer.setData('text/plain', peopleById[personId].name)
    event.dataTransfer.effectAllowed = 'copyMove'
    if (teamId) setActiveTeamId(teamId)
    setDragging(payload)
    setSelected(null)
  }
  function assign(teamId, roleId, item = selected, copy = false) {
    if (!item || !peopleById[item.personId] || !state.teams.some((team) => team.id === teamId)) return
    commit((current) => applyAssignment(current, {
      teamId,
      roleId,
      personId: item.personId,
      fromRoleId: item.fromRoleId,
      fromTeamId: item.fromRoleId ? item.teamId || teamId : null,
      copy,
    }))
    setActiveTeamId(teamId)
    setSelected(null)
    setDragging(null)
    notify(`${peopleById[item.personId].name} em ${roles.find((role) => role.id === roleId)?.name} · ${state.teams.find((team) => team.id === teamId).name}`)
  }
  function clearTeamDialog(teamId) {
    setActiveTeamId(teamId)
    openModal({ type: 'clear', teamId })
  }
  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `planner-ipcvt-${new Date().toLocaleDateString('sv-SE')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('Cópia do planejamento exportada.')
    setMenuOpen(false)
  }
  async function exportPdf(allTeams = false) {
    if (exporting) return
    setExporting(true)
    setMenuOpen(false)
    try {
      const { exportPlannerPdf } = await import('./lib/exportPdf.js')
      const targets = allTeams ? state.teams : visibleTeams
      const exportState = { ...state, teams: targets }
      await exportPlannerPdf({ state: exportState, teamId: targets.length === 1 ? targets[0].id : null, groupId: allTeams ? 'all' : resolvedGroupFilter })
      notify(targets.length === 1 ? `PDF do ${targets[0].name} exportado.` : 'PDF dos times visíveis exportado.')
    } catch (error) {
      console.error('Falha ao exportar PDF:', error)
      notify('Não foi possível gerar o PDF. Tente novamente.')
    } finally { setExporting(false) }
  }
  async function importBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error()
      const data = normalizePlannerState(JSON.parse(await file.text()))
      if (!data) throw new Error()
      openModal({ type: 'import', data })
    } catch { notify('Não foi possível importar. Escolha um backup válido do Planner IPCVT.') }
  }

  return <div className={`app-shell workspace-shell compact-layout stacked-workspace ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
    <PlaybookBackground />
    <header className="topbar" aria-label="Barra de planejamento">
      <button className="brand-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? 'Ocultar integrantes pela logo' : 'Exibir integrantes pela logo'} aria-expanded={sidebarOpen} aria-controls="people-directory" title="Abrir ou recolher os integrantes">
        <Icon name="notebook" size={23} />
        <span className="brand"><span className="brand-name">IPCVT<span className="brand-divider" />Planner<span className="brand-dot">.</span></span></span>
      </button>
      <div className="planner-toolbar-controls">
        <label className="toolbar-field team-filter"><span className="visually-hidden">Filtrar times</span>
          <select aria-label="Filtrar times" value={resolvedTeamFilter} onChange={(event) => changeTeamFilter(event.target.value)}>
            <option value="all">Todos os times</option>
            {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label className="toolbar-field section-filter"><span className="visually-hidden">Filtrar seção</span>
          <select aria-label="Filtrar seção" value={resolvedGroupFilter} onChange={(event) => { setGroupFilter(event.target.value); setSelected(null) }}>
            <option value="all">Geral</option>
            {state.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <span className="toolbar-divider" />
        <button className="icon-button structure-button" aria-label="Editar grupos e funções" title="Grupos e funções" onClick={() => openModal({ type: 'structure' })}><Icon name="settings" size={17} /></button>
        <button className="toolbar-action new-team-button" onClick={() => openModal({ type: 'team' })} aria-label="Novo time" title="Novo time"><Icon name="plus" size={17} /><span>Novo time</span></button>
        <button className="toolbar-action clear-team-button" onClick={() => clearTeamDialog(activeTeam.id)} disabled={!Object.values(activeTeam.assignments).some((ids) => ids.length)} aria-label="Limpar time selecionado" title={`Limpar todos os integrantes de ${activeTeam.name}`}><Icon name="trash" size={16} /><span>Limpar time</span></button>
        <button className="icon-button theme-toggle" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'} title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /></button>
        <button className="export-pdf-button" onClick={() => exportPdf()} disabled={exporting} aria-label="Exportar planejamento em PDF" title="Exportar os times e as seções visíveis em PDF"><Icon name="download" size={17} /><span>{exporting ? 'Gerando…' : 'PDF'}</span></button>
        <div className="team-menu-wrap" ref={menuRef}>
          <button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Opções do time" aria-expanded={menuOpen} title={`Opções de ${activeTeam.name}`}><Icon name="more" size={21} /></button>
          {menuOpen && <div className="dropdown-menu">
            <button onClick={() => openModal({ type: 'renameTeam', teamId: activeTeam.id })}><Icon name="pencil" size={16} />Editar {activeTeam.name}</button>
            <button onClick={() => openModal({ type: 'team', source: activeTeam.id })}><Icon name="copy" size={16} />Duplicar {activeTeam.name}</button>
            <button disabled={exporting} onClick={() => exportPdf(true)}><Icon name="download" size={16} />Todos os times em PDF</button>
            <div className="menu-separator" />
            <button onClick={exportBackup}><Icon name="download" size={16} />Baixar backup (.json)</button>
            <button onClick={() => { importRef.current.click(); setMenuOpen(false) }}><Icon name="upload" size={16} />Restaurar backup</button>
            <button onClick={() => openModal({ type: 'person' })}><Icon name="users" size={16} />Novo integrante</button>
            <button onClick={() => openModal({ type: 'help' })}><Icon name="help" size={16} />Como usar</button>
            <div className="menu-separator" />
            <button className="danger-text" disabled={state.teams.length <= 1} onClick={() => openModal({ type: 'deleteTeam', teamId: activeTeam.id })}><Icon name="trash" size={16} />Excluir {activeTeam.name}</button>
          </div>}
        </div>
        <span className={`save-status ${saveError ? 'save-error' : ''}`} aria-label={saveError ? 'Falha ao salvar' : 'Salvo neste navegador'} title={saveError ? 'Não foi possível salvar. Baixe um backup pelo menu.' : 'Salvo neste navegador'}><Icon name={saveError ? 'help' : 'check-circle'} size={14} /></span>
      </div>
    </header>

    {sidebarOpen && <aside id="people-directory" className="people-sidebar" aria-label="Menu de integrantes">
      <div className="sidebar-title"><div><h2>Integrantes <span>{state.people.length}</span></h2><p>Funções em {activeTeam.name}</p></div><button className="icon-button" onClick={() => setSidebarOpen(false)} aria-label="Ocultar integrantes" title="Ocultar integrantes"><Icon name="panel-left" size={18} /></button></div>
      <div className="search-field"><Icon name="search" size={17} /><input type="search" placeholder="Buscar integrante…" aria-label="Buscar integrante" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></div>
      <div className="people-filter"><button className={peopleFilter === 'all' ? 'active' : ''} onClick={() => setPeopleFilter('all')}>Todos <span>{state.people.length}</span></button><button className={peopleFilter === 'available' ? 'active' : ''} onClick={() => setPeopleFilter('available')}>Sem função <span>{state.people.length - Object.keys(counts).length}</span></button></div>
      <div className="directory-list">
        {filteredPeople.map((person) => <button key={person.id} className={`directory-person ${selected?.personId === person.id && !selected?.fromRoleId ? 'is-selected' : ''}`} draggable onDragStart={(event) => dragStart(event, person.id)} onDragEnd={() => setDragging(null)} onClick={() => selectPerson({ personId: person.id, fromRoleId: null, teamId: null })} title={`${person.name}${personSkills(person.id).length ? ` · ${personSkills(person.id).join(', ')}` : ''}. Arraste ou selecione e escolha uma função em qualquer time.`}><span className="directory-avatar"><Avatar person={person} />{counts[person.id] > 0 && <span className="directory-count">{counts[person.id]}</span>}</span><span className="directory-name">{person.name}</span></button>)}
        {filteredPeople.length === 0 && <div className="empty-directory"><Icon name="search" /><p>Nenhum integrante por aqui.</p><button className="text-button" onClick={() => { setSearch(''); setPeopleFilter('all') }}>Limpar filtros</button></div>}
      </div>
      <div className="sidebar-footer"><button className="add-person-button" onClick={() => openModal({ type: 'person' })}><Icon name="plus" size={17} />Novo integrante</button><p><Icon name="move" size={14} />Arraste para uma função<br /> em qualquer time.</p></div>
    </aside>}

    <main className="main-content" aria-label="Quadro de planejamento">
      <h1 className="visually-hidden">Planejamento de equipes</h1>
      {saveError && <div className="storage-alert" role="alert">Não foi possível salvar neste navegador. Baixe um backup pelo menu para guardar suas alterações.</div>}
      {selected && <div className="selection-banner" role="status"><Avatar person={peopleById[selected.personId]} size="xs" /><span><strong>{peopleById[selected.personId].name}</strong>: escolha “+” em uma função de qualquer time{selected.fromRoleId ? ' para mover' : ''}.</span><button className="icon-button" aria-label="Cancelar seleção" onClick={() => setSelected(null)}><Icon name="close" size={16} /></button></div>}
      <div className="teams-stack">
        {visibleTeams.map((team) => <TeamBoard
          key={team.id}
          team={team}
          teamIndex={state.teams.findIndex((item) => item.id === team.id)}
          groups={visibleGroups}
          peopleById={peopleById}
          selected={selected}
          dragging={dragging}
          isActive={team.id === activeTeam.id}
          notes={state.notes[team.id] || ''}
          onActivate={setActiveTeamId}
          onSelect={selectPerson}
          onAssign={assign}
          onRemove={(teamId, roleId, personId) => { setActiveTeamId(teamId); commit((current) => removeAssignment(current, teamId, roleId, personId)) }}
          onDragStart={dragStart}
          onDragEnd={() => setDragging(null)}
          onOpenAssign={(teamId, role) => { setActiveTeamId(teamId); openModal({ type: 'assign', teamId, role }) }}
          onAddRole={(groupId, sectionId) => { setStructureGroup(groupId); setStructureType('role'); openModal({ type: 'structure', sectionId }) }}
          onAddSection={(groupId) => { setStructureGroup(groupId); setStructureType('section'); openModal({ type: 'structure' }) }}
          onNotesChange={(teamId, value) => commit((current) => ({ ...current, notes: { ...current.notes, [teamId]: value } }))}
          onClear={clearTeamDialog}
          zoom={zoom}
        />)}
      </div>
      <div className="canvas-controls">
        <div><button className="icon-button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Icon name="undo" size={17} /></button><button className="icon-button" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}><Icon name="redo" size={17} /></button></div>
        <span /><button className="zoom-button" onClick={() => setZoom(Math.max(70, zoom - 10))} disabled={zoom <= 70} aria-label="Diminuir quadro">−</button><button className="zoom-label" title="Restaurar tamanho do quadro" onClick={() => setZoom(100)}>{zoom}%</button><button className="zoom-button" onClick={() => setZoom(Math.min(130, zoom + 10))} disabled={zoom >= 130} aria-label="Aumentar quadro">+</button>
      </div>
    </main>

    <input ref={importRef} type="file" accept=".json,application/json" className="visually-hidden" aria-label="Importar backup do planejamento" onChange={importBackup} />
    {toast && <div className="toast" role="status"><Icon name="check-circle" size={17} />{toast}<button onClick={() => setToast('')} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}
    {modal && <PlannerDialogs modal={modal} onClose={() => setModal(null)} openModal={openModal} state={state} activeTeam={activeTeam} commit={commit} onSetTeam={showCreatedTeam} notify={notify} assign={(roleId, item) => assign(modal.teamId || activeTeam.id, roleId, item)} counts={counts} structureGroup={structureGroup} setStructureGroup={setStructureGroup} structureType={structureType} setStructureType={setStructureType} onStructureChange={() => { setGroupFilter('all'); setSelected(null) }} />}
  </div>
}
