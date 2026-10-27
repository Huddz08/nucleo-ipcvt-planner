import { useId, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { allRoles } from '../lib/planner.js'

const DRAG_TYPE = 'application/x-ipcvt-person'
const groupIcons = { sage: 'music', peach: 'book', lavender: 'camera' }
const teamLetter = (name) => name.replace(/^time\s+/i, '').slice(0, 2).toUpperCase()

function PersonToken({ person, teamId, role, count, selected, onSelect, onRemove, onDragStart, onDragEnd }) {
  return <div className={`person-token ${selected ? 'is-selected' : ''}`} draggable onDragStart={(event) => onDragStart(event, person.id, role.id, teamId)} onDragEnd={onDragEnd}>
    <button className="token-main" aria-label={`Selecionar ${person.name}`} onClick={() => onSelect({ personId: person.id, fromRoleId: role.id, teamId })} title={`${person.name} · ${count} ${count === 1 ? 'função' : 'funções'} neste time. Arraste para mover.`}>
      <span className="token-portrait"><Avatar person={person} size="sm" />{count > 1 && <span className="multi-badge">{count}</span>}</span>
      <span className="token-name">{person.name}</span>
    </button>
    <button className="token-remove" aria-label={`Remover ${person.name} de ${role.name}`} title="Retirar desta função" onClick={() => onRemove(teamId, role.id, person.id)}><Icon name="close" size={10} /></button>
  </div>
}

function RoleBox({ teamId, role, people, counts, selected, dragging, onSelect, onAssign, onRemove, onDragStart, onDragEnd, onOpenAssign }) {
  const [over, setOver] = useState(false)
  const addPerson = () => selected ? onAssign(teamId, role.id) : onOpenAssign(teamId, role)

  return <div className={`role-box ${over ? 'drag-over' : ''} ${dragging || selected ? 'can-drop' : ''}`} data-role={role.id}
    onDragOver={(event) => {
      if (!Array.from(event.dataTransfer.types).includes(DRAG_TYPE)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = event.altKey || !dragging?.fromRoleId ? 'copy' : 'move'
      setOver(true)
    }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOver(false) }}
    onDrop={(event) => {
      event.preventDefault()
      setOver(false)
      try {
        const item = JSON.parse(event.dataTransfer.getData(DRAG_TYPE))
        if (item && typeof item.personId === 'string') onAssign(teamId, role.id, item, event.altKey)
      } catch { /* Ignore drops from other applications. */ }
    }}>
    <div className="role-heading"><h5>{role.name}</h5><button className="role-add" aria-label={`Adicionar integrante em ${role.name}`} title="Escolher integrante" onClick={addPerson}><Icon name="plus" size={13} /></button></div>
    <div className="role-people">
      {people.map((person) => <PersonToken key={person.id} person={person} teamId={teamId} role={role} count={counts[person.id] || 0} selected={selected?.personId === person.id && selected?.fromRoleId === role.id && selected?.teamId === teamId} onSelect={onSelect} onRemove={onRemove} onDragStart={onDragStart} onDragEnd={onDragEnd} />)}
      {people.length === 0 && <button className="empty-role" onClick={addPerson}><span className="empty-avatar"><Icon name="plus" size={16} /></span><span>{selected ? 'Adicionar aqui' : 'Arraste para cá'}</span></button>}
    </div>
    {selected && people.length > 0 && <button className="place-selected" onClick={() => onAssign(teamId, role.id)}><Icon name="plus" size={12} />Adicionar aqui</button>}
  </div>
}

export default function TeamBoard({ team, teamIndex, groups, peopleById, selected, dragging, isActive, notes, onActivate, onSelect, onAssign, onRemove, onDragStart, onDragEnd, onOpenAssign, onAddRole, onAddSection, onNotesChange, onClear, zoom = 100 }) {
  const headingId = useId()
  const counts = useMemo(() => {
    const result = {}
    Object.values(team.assignments).flat().forEach((id) => {
      if (peopleById[id]) result[id] = (result[id] || 0) + 1
    })
    return result
  }, [team.assignments, peopleById])
  const assignedCount = Object.keys(counts).length
  const filledRoles = Object.values(team.assignments).filter((ids) => ids.some((id) => peopleById[id])).length

  return <section className={`team-board ${isActive ? 'is-active' : ''}`} data-team={team.id} aria-labelledby={headingId}>
    <header className="team-board-header">
      <span className={`team-letter team-color-${teamIndex % 3}`}>{teamLetter(team.name)}</span>
      <h2 id={headingId}><button className="team-name-button" onClick={() => onActivate(team.id)} title={team.description || `Selecionar ${team.name}`}>{team.name}</button></h2>
      <p className="team-board-summary">{assignedCount} {assignedCount === 1 ? 'integrante' : 'integrantes'}<span aria-hidden="true"> · </span>{filledRoles} {filledRoles === 1 ? 'função' : 'funções'}</p>
      <button className="text-button clear-team-button" aria-label={`Limpar ${team.name}`} title={`Retirar todos os integrantes do ${team.name}`} onClick={() => onClear(team.id)} disabled={assignedCount === 0}><Icon name="trash" size={14} /><span>Limpar time</span></button>
    </header>
    <div className="canvas-scroll" role="region" aria-label={`Funções de ${team.name}`}>
      <div className={`formation-board horizontal-groups ${groups.length === 3 ? 'three-groups' : ''} ${groups.length === 1 ? 'single-group' : ''} ${dragging ? 'is-dragging' : ''}`} style={{ zoom: zoom / 100, '--board-zoom': zoom / 100, '--group-columns': Math.max(1, groups.length) }}>
        {groups.map((group, groupIndex) => {
          const groupRoles = allRoles([group])
          const total = new Set(groupRoles.flatMap((role) => team.assignments[role.id] || []).filter((id) => peopleById[id])).size
          const sectionLayouts = group.sections.map((section) => ({
            ...section,
            columns: Math.max(1, Math.min(3, group.sections.length === 1 ? section.roles.length : Math.ceil(section.roles.length / 2))),
          }))

          return <section className={`group-card group-${group.color} ${groupIndex === 0 && groups.length > 1 ? 'group-primary' : ''}`} key={group.id} data-group={group.id}>
            <header className="group-heading">
              <div className="group-icon"><Icon name={groupIcons[group.color] || 'users'} size={20} /></div>
              <div><h3>{group.name}</h3></div>
              <span className="group-person-count" title={`${total} ${total === 1 ? 'integrante' : 'integrantes'}`}><Icon name="users" size={13} />{total}</span>
            </header>
            <div className="group-sections">
              {sectionLayouts.map((section) => <section className="formation-section" key={section.id} data-section={section.id} style={{ '--section-columns': section.columns }}>
                <div className="section-heading"><h4>{section.name}</h4><span /><button onClick={() => onAddRole(group.id, section.id)} title={`Adicionar função em ${section.name}`} aria-label={`Adicionar função em ${section.name}`}><Icon name="plus" size={13} /></button></div>
                <div className="role-grid">
                  {section.roles.map((role) => <RoleBox key={role.id} teamId={team.id} role={role} people={(team.assignments[role.id] || []).map((id) => peopleById[id]).filter(Boolean)} counts={counts} selected={selected} dragging={dragging} onSelect={onSelect} onAssign={onAssign} onRemove={onRemove} onDragStart={onDragStart} onDragEnd={onDragEnd} onOpenAssign={onOpenAssign} />)}
                  {section.roles.length === 0 && <button className="add-empty-structure" onClick={() => onAddRole(group.id, section.id)}><Icon name="plus" size={16} />Adicionar função</button>}
                </div>
              </section>)}
            </div>
            {group.sections.length === 0 && <button className="add-empty-structure" onClick={() => onAddSection(group.id)}><Icon name="plus" size={16} />Criar um subgrupo</button>}
            <footer className="group-footer"><span className="sketch-mark" />{groupRoles.length} {groupRoles.length === 1 ? 'função' : 'funções'}<span>·</span>{total} {total === 1 ? 'integrante' : 'integrantes'}</footer>
          </section>
        })}
      </div>
    </div>
    <details className="team-notes">
      <summary><Icon name="pencil" size={13} />Anotações{notes?.trim() && <span className="notes-indicator" aria-label="Há anotações">•</span>}</summary>
      <textarea aria-label={`Anotações de ${team.name}`} placeholder="Uma troca para testar, algo para lembrar…" value={notes || ''} maxLength={3000} onChange={(event) => onNotesChange(team.id, event.target.value)} />
    </details>
  </section>
}
