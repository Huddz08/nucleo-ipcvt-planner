import { useEffect, useMemo, useState } from 'react'
import PersonCard from './components/PersonCard.jsx'
import RoleBox from './components/RoleBox.jsx'
import { people as initialPeople } from './data/people.js'
import { areas } from './data/areas.js'
import { initialAssignments } from './data/initialAssignments.js'

const STORAGE_KEY = 'nucleo-ipcvt-planner-v1'

function readSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export default function App() {
  const saved = readSavedData()
  const [people, setPeople] = useState(saved?.people ?? initialPeople)
  const [assignments, setAssignments] = useState(saved?.assignments ?? initialAssignments)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, assignments }))
  }, [people, assignments])

  const peopleById = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person])),
    [people],
  )

  const counts = useMemo(() => {
    const result = {}
    Object.values(assignments).flat().forEach((personId) => {
      result[personId] = (result[personId] ?? 0) + 1
    })
    return result
  }, [assignments])

  const filteredPeople = people.filter((person) =>
    person.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function addPersonToRole(roleId, personId) {
    setAssignments((current) => {
      const rolePeople = current[roleId] ?? []
      if (rolePeople.includes(personId)) return current
      return { ...current, [roleId]: [...rolePeople, personId] }
    })
  }

  function removePersonFromRole(roleId, personId) {
    setAssignments((current) => ({
      ...current,
      [roleId]: (current[roleId] ?? []).filter((id) => id !== personId),
    }))
  }

  function addNewPerson(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
    if (people.some((person) => person.id === id)) {
      alert('Essa pessoa já está cadastrada.')
      return
    }
    setPeople((current) => [...current, { id, name, status: 'possivel' }].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
  }

  function resetBoard() {
    const confirmed = window.confirm('Restaurar a organização inicial? As alterações locais serão perdidas.')
    if (!confirmed) return
    setPeople(initialPeople)
    setAssignments(initialAssignments)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">IPCVT</p>
          <h1>Núcleo Planner</h1>
          <p className="subtitle">Brainstorm de equipes, funções e sobrecarga</p>
        </div>
        <div className="legend" aria-label="Legenda de carga">
          <span><i className="dot safe-dot" />1 função</span>
          <span><i className="dot warning-dot" />2 funções</span>
          <span><i className="dot danger-dot" />3 ou mais</span>
          <button type="button" className="secondary-button" onClick={resetBoard}>Restaurar</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <h2>Banco de pessoas</h2>
              <p>{people.length} cadastradas</p>
            </div>
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Buscar nome..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <form className="new-person-form" onSubmit={addNewPerson}>
            <input
              type="text"
              placeholder="Possível novo integrante"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button type="submit">Adicionar</button>
          </form>

          <p className="drag-help">Arraste um cartão até uma função. A mesma pessoa pode aparecer em várias áreas.</p>

          <div className="people-list">
            {filteredPeople.map((person) => (
              <PersonCard key={person.id} person={person} count={counts[person.id] ?? 0} />
            ))}
          </div>
        </aside>

        <div className="board">
          {areas.map((area) => (
            <section className={`area-section area-${area.id}`} key={area.id}>
              <div className="area-title-row">
                <h2>{area.name}</h2>
                <span>{area.roles.length} {area.roles.length === 1 ? 'função' : 'funções'}</span>
              </div>
              <div className="roles-grid">
                {area.roles.map((role) => (
                  <RoleBox
                    key={role.id}
                    role={role}
                    counts={counts}
                    assignedPeople={(assignments[role.id] ?? []).map((id) => peopleById[id]).filter(Boolean)}
                    onDropPerson={addPersonToRole}
                    onRemovePerson={removePersonFromRole}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
