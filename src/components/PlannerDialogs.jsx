import { useEffect, useRef, useState } from 'react'
import { allRoles, clearTeam, createId, removeTeam, validateState } from '../lib/planner.js'
import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ')
const nodeLabels = { group: 'grupo', section: 'subgrupo', role: 'função' }

function findNode(groups, node) {
  if (!node) return null
  for (const group of groups) {
    if (node.type === 'group' && group.id === node.id) return { item: group, group, siblings: groups }
    for (const section of group.sections) {
      if (node.type === 'section' && section.id === node.id) return { item: section, group, section, siblings: group.sections }
      const role = section.roles.find((item) => item.id === node.id)
      if (node.type === 'role' && role) return { item: role, group, section, siblings: section.roles }
    }
  }
  return null
}

function copyName(team, teams) {
  const base = `${team.name.slice(0, 54)} (cópia)`
  let name = base
  let index = 2
  while (teams.some((item) => normalize(item.name) === normalize(name))) name = `${base} ${index++}`
  return name
}

export default function PlannerDialogs({
  modal, onClose, openModal, state, activeTeam, commit, onSetTeam, notify,
  assign, structureGroup, setStructureGroup, structureType = 'role', setStructureType,
  onStructureChange = () => {},
}) {
  const dialogRef = useRef(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [color, setColor] = useState('sage')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const type = modal?.type
  const source = modal?.source && (typeof modal.source === 'string' ? state.teams.find((team) => team.id === modal.source) : modal.source)
  const editedTeam = (modal?.teamId && state.teams.find((team) => team.id === modal.teamId)) || modal?.team || activeTeam
  const currentGroup = state.groups.find((group) => group.id === structureGroup) || state.groups[0]
  const currentSection = currentGroup?.sections.find((section) => section.id === sectionId) || currentGroup?.sections[0]
  const node = findNode(state.groups, modal?.node)
  const roleId = modal?.roleId || modal?.role?.id
  const role = allRoles(state.groups).find((item) => item.id === roleId)

  useEffect(() => {
    setError('')
    setSearch('')
    setName(type === 'team' && source ? copyName(source, state.teams)
      : type === 'renameTeam' ? editedTeam?.name || ''
        : type === 'renameNode' ? node?.item.name || '' : '')
    setDescription(type === 'renameTeam' ? editedTeam?.description || '' : type === 'team' ? source?.description || '' : '')
    setSourceId(type === 'team' ? source?.id || '' : '')
    setColor(type === 'renameNode' && node?.group ? node.group.color : 'sage')
    setSectionId(modal?.sectionId || '')
    const dialog = dialogRef.current
    if (modal) {
      if (!dialog.open) dialog.showModal()
      const frame = requestAnimationFrame(() => dialog.querySelector('[data-autofocus]')?.focus())
      return () => cancelAnimationFrame(frame)
    }
    if (dialog.open) dialog.close()
    // Form fields initialize on navigation between dialogs, never while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])

  const finish = (next, message, teamId) => {
    commit(next)
    notify(message)
    if (teamId) onSetTeam(teamId)
    onClose()
  }

  const save = (event) => {
    event.preventDefault()
    setError('')
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (!cleanName) return setError('Escreva um nome para continuar.')
    if (type === 'team' || type === 'renameTeam') {
      if (state.teams.some((team) => team.id !== (type === 'renameTeam' ? editedTeam?.id : null) && normalize(team.name) === normalize(cleanName))) {
        return setError('Já existe um time com esse nome.')
      }
      if (type === 'renameTeam') {
        if (!editedTeam) return setError('Este time não está mais disponível.')
        finish({ ...state, teams: state.teams.map((team) => team.id === editedTeam.id ? { ...team, name: cleanName, description: description.trim() } : team) }, 'Time atualizado.')
        return
      }
      const original = state.teams.find((team) => team.id === sourceId)
      const id = createId('time')
      const assignments = Object.fromEntries(Object.entries(original?.assignments || {}).map(([roleId, people]) => [roleId, [...people]]))
      const next = { ...state, teams: [...state.teams, { id, name: cleanName, description: description.trim(), assignments }] }
      if (original && state.notes[original.id]) next.notes = { ...state.notes, [id]: state.notes[original.id] }
      finish(next, 'Time criado.', id)
      return
    }
    if (type === 'person') {
      if (state.people.some((person) => normalize(person.name) === normalize(cleanName))) return setError('Este integrante já está cadastrado.')
      finish({ ...state, people: [...state.people, { id: createId('pessoa'), name: cleanName, status: 'ativo' }] }, 'Integrante adicionado.')
      return
    }
    if (type === 'structure') {
      if (structureType !== 'group' && !currentGroup) return setError('Crie um grupo primeiro.')
      if (structureType === 'role' && !currentSection) return setError('Crie um subgrupo antes de adicionar funções.')
      const siblings = structureType === 'group' ? state.groups : structureType === 'section' ? currentGroup.sections : currentSection.roles
      if (siblings.some((item) => normalize(item.name) === normalize(cleanName))) return setError('Já existe um item com esse nome neste nível.')
      let groups
      const newSectionId = structureType === 'section' ? createId('subgrupo') : null
      if (structureType === 'group') {
        const id = createId('grupo')
        groups = [...state.groups, { id, name: cleanName, color, sections: [] }]
        setStructureGroup(id)
        setSectionId('')
      } else {
        groups = state.groups.map((group) => group.id !== currentGroup.id ? group : {
          ...group,
          sections: structureType === 'section'
            ? [...group.sections, { id: newSectionId, name: cleanName, roles: [] }]
            : group.sections.map((section) => section.id !== currentSection.id ? section : { ...section, roles: [...section.roles, { id: createId('funcao'), name: cleanName }] }),
        })
      }
      commit({ ...state, groups })
      notify(`${structureType === 'role' ? 'Função adicionada' : structureType === 'group' ? 'Grupo adicionado' : 'Subgrupo adicionado'}.`)
      setName('')
      if (structureType === 'group') setStructureType('section')
      if (structureType === 'section') { setSectionId(newSectionId); setStructureType('role') }
      onStructureChange()
      dialogRef.current?.querySelector('input[name="name"]')?.focus()
      return
    }
    if (type === 'renameNode') {
      if (!node) return setError('Este item não está mais disponível.')
      if (node.siblings.some((item) => item.id !== node.item.id && normalize(item.name) === normalize(cleanName))) return setError('Já existe um item com esse nome neste nível.')
      const groups = state.groups.map((group) => {
        if (modal.node.type === 'group' && group.id === node.item.id) return { ...group, name: cleanName, color }
        return { ...group, sections: group.sections.map((section) => {
          if (modal.node.type === 'section' && section.id === node.item.id) return { ...section, name: cleanName }
          return { ...section, roles: section.roles.map((item) => modal.node.type === 'role' && item.id === node.item.id ? { ...item, name: cleanName } : item) }
        }) }
      })
      commit({ ...state, groups })
      notify('Estrutura atualizada.')
      openModal({ type: 'structure' })
    }
  }

  const deleteNode = () => {
    if (!node) return setError('Este item não está mais disponível.')
    const removedRoles = new Set(modal.node.type === 'group' ? node.group.sections.flatMap((section) => section.roles.map((item) => item.id))
      : modal.node.type === 'section' ? node.section.roles.map((item) => item.id) : [node.item.id])
    const groups = state.groups.filter((group) => !(modal.node.type === 'group' && group.id === node.item.id)).map((group) => ({
      ...group,
      sections: group.sections.filter((section) => !(modal.node.type === 'section' && section.id === node.item.id)).map((section) => ({
        ...section, roles: section.roles.filter((item) => !(modal.node.type === 'role' && item.id === node.item.id)),
      })),
    }))
    const teams = state.teams.map((team) => ({ ...team, assignments: Object.fromEntries(Object.entries(team.assignments).filter(([roleId]) => !removedRoles.has(roleId))) }))
    commit({ ...state, groups, teams })
    notify('Item excluído da estrutura.')
    onStructureChange()
    openModal({ type: 'structure' })
  }

  const title = {
    team: source ? 'Duplicar time' : 'Criar um time', renameTeam: 'Editar time', person: 'Novo integrante',
    structure: 'Organizar a estrutura', assign: `Adicionar em ${role?.name || 'uma função'}`,
    deleteTeam: 'Excluir este time?', clear: `Limpar ${editedTeam?.name || 'time'}?`, import: 'Restaurar backup?',
    help: 'Seu quadro de planejamento', renameNode: `Editar ${nodeLabels[modal?.node?.type] || 'item'}`,
    deleteNode: `Excluir ${nodeLabels[modal?.node?.type] || 'item'}?`,
  }[type] || ''
  const isForm = ['team', 'renameTeam', 'person', 'structure', 'renameNode'].includes(type)
  const actionLabel = { team: 'Criar time', renameTeam: 'Salvar alterações', person: 'Adicionar integrante', structure: 'Adicionar', renameNode: 'Salvar alterações' }[type]
  const colorFields = (
    <fieldset className="color-options">
      <legend>Cor do grupo</legend>
      {[[ 'sage', 'Verde' ], [ 'peach', 'Pêssego' ], [ 'lavender', 'Lavanda' ]].map(([value, label]) => (
        <label key={value} className={`color-option ${color === value ? 'active' : ''}`}>
          <input type="radio" name="color" value={value} checked={color === value} onChange={() => setColor(value)} />
          <span className={`color-dot dot-${value}`} />{label}
        </label>
      ))}
    </fieldset>
  )
  const nodeActions = (item, nodeType, group, section) => {
    const target = { type: nodeType, id: item.id, groupId: group.id, sectionId: section?.id }
    return <span className="structure-node-actions">
      <button type="button" className="icon-button" aria-label={`Editar ${item.name}`} title={`Editar ${item.name}`} onClick={() => openModal({ type: 'renameNode', node: target })}><Icon name="pencil" size={15} /></button>
      <button type="button" className="icon-button danger-text" aria-label={`Excluir ${item.name}`} title={`Excluir ${item.name}`} onClick={() => openModal({ type: 'deleteNode', node: target })}><Icon name="trash" size={15} /></button>
    </span>
  }

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${type === 'structure' || type === 'help' ? 'dialog-wide' : ''}`}
      aria-labelledby="planner-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      {modal && <>
        <div className="dialog-header">
          <div><span className="eyebrow">PLANNER IPCVT</span><h2 id="planner-dialog-title">{title}</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar janela" title="Fechar" onClick={onClose}><Icon name="close" /></button>
        </div>

        {isForm && <div className={type === 'structure' ? 'structure-dialog' : undefined}>
          <form className="dialog-form" onSubmit={save}>
            {type === 'structure' && <>
              <p className="form-hint">A estrutura é compartilhada por todos os times. Cada time mantém seus próprios integrantes.</p>
              <div className="structure-type" role="group" aria-label="Tipo de item">
                {[['group', 'Grupo'], ['section', 'Subgrupo'], ['role', 'Função']].map(([value, label]) => <button key={value} type="button" className={structureType === value ? 'active' : ''} aria-pressed={structureType === value} onClick={() => { setStructureType(value); setError('') }}>{label}</button>)}
              </div>
              <div className="structure-fields">
                {structureType !== 'group' && <label>Grupo<select value={currentGroup?.id || ''} onChange={(event) => { setStructureGroup(event.target.value); setSectionId(''); setError('') }} required>
                  {!state.groups.length && <option value="">Crie um grupo</option>}
                  {state.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select></label>}
                {structureType === 'role' && <label>Subgrupo<select value={currentSection?.id || ''} onChange={(event) => setSectionId(event.target.value)} required>
                  {!currentGroup?.sections.length && <option value="">Crie um subgrupo</option>}
                  {currentGroup?.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select></label>}
              </div>
            </>}
            <label>{type === 'person' ? 'Nome do integrante' : type === 'structure' ? `Nome ${structureType === 'role' ? 'da função' : `do ${nodeLabels[structureType]}`}` : 'Nome'}
              <input data-autofocus name="name" value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder={type === 'person' ? 'Como o integrante é conhecido?' : type === 'team' ? 'Ex.: Time D' : type === 'structure' ? structureType === 'group' ? 'Ex.: Apoio' : structureType === 'section' ? 'Ex.: Recepção' : 'Ex.: Acolhimento' : undefined} maxLength={70} required autoComplete="off" />
            </label>
            {(type === 'team' || type === 'renameTeam') && <label>Descrição <span className="form-hint">(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={250} placeholder="Uma referência para este time…" /></label>}
            {type === 'team' && <label>Começar a partir de<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Um time vazio</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><span className="form-hint">Copia a escalação e as anotações. Depois, cada time pode ser ajustado separadamente.</span></label>}
            {type === 'person' && <p className="form-hint">A foto será carregada da pasta <code>public/fotos</code> pelo nome exato do integrante. Sem foto, aparecem as iniciais.</p>}
            {(type === 'structure' && structureType === 'group' || type === 'renameNode' && modal.node?.type === 'group') && colorFields}
            {error && <p className="dialog-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => type === 'renameNode' ? openModal({ type: 'structure' }) : onClose()}>{type === 'renameNode' ? 'Voltar' : type === 'structure' ? 'Concluir' : 'Cancelar'}</button>
              <button type="submit" className="primary-button"><Icon name={type === 'renameTeam' || type === 'renameNode' ? 'check' : 'plus'} size={17} />{actionLabel}</button>
            </div>
          </form>
          {type === 'structure' && <div className="structure-tree" aria-label="Estrutura atual">
            <h3>Estrutura atual</h3>
            {!state.groups.length && <p className="form-hint">Adicione o primeiro grupo para começar.</p>}
            {state.groups.map((group) => <details key={group.id} open>
              <summary><span className="structure-node group-node"><span className={`color-dot dot-${group.color}`} />{group.name}</span>{nodeActions(group, 'group', group)}</summary>
              {group.sections.map((section) => <div key={section.id} className="structure-section">
                <div className="structure-node"><span>{section.name}</span>{nodeActions(section, 'section', group, section)}</div>
                {section.roles.map((item) => <div key={item.id} className="structure-node role-node"><span>{item.name}</span>{nodeActions(item, 'role', group, section)}</div>)}
                {!section.roles.length && <p className="form-hint">Nenhuma função.</p>}
              </div>)}
              {!group.sections.length && <p className="form-hint">Nenhum subgrupo.</p>}
            </details>)}
          </div>}
        </div>}

        {type === 'assign' && <div className="assign-dialog">
          <p className="form-hint">{role ? `${role.groupName} / ${role.sectionName} · ${activeTeam?.name || ''}` : 'Escolha um integrante para esta função.'}</p>
          <label className="search-field"><Icon name="search" size={18} /><input data-autofocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar integrante" placeholder="Buscar integrante…" autoComplete="off" /></label>
          <div className="assign-list">
            {state.people.filter((person) => normalize(person.name).includes(normalize(search))).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((person) => {
              const assigned = activeTeam?.assignments[roleId]?.includes(person.id)
              return <button type="button" key={person.id} aria-label={person.name} disabled={assigned || !role} onClick={() => { assign(roleId, { personId: person.id }); onClose() }}>
                <Avatar person={person} size="sm" /><span>{person.name}</span><span className="form-hint">{assigned ? 'Já está nesta função' : <Icon name="plus" size={17} />}</span>
              </button>
            })}
            {!state.people.some((person) => normalize(person.name).includes(normalize(search))) && <p className="form-hint">Nenhum integrante encontrado.</p>}
          </div>
        </div>}

        {['deleteTeam', 'clear', 'import', 'deleteNode'].includes(type) && <div className="confirm-dialog">
          {type === 'deleteTeam' && <p>O <strong>{editedTeam?.name}</strong> e suas anotações serão excluídos. Os integrantes continuam no menu.</p>}
          {type === 'clear' && <p>Todos os integrantes serão retirados de todas as funções do <strong>{editedTeam?.name}</strong>, incluindo as seções ocultas pelo filtro. A estrutura, as anotações e os outros times serão mantidos.</p>}
          {type === 'import' && <><p>O backup substituirá os times, integrantes, estrutura e anotações deste navegador.</p><p className="form-hint">O arquivo contém {modal.data?.teams?.length || 0} times e {modal.data?.people?.length || 0} integrantes. Você poderá desfazer a restauração.</p></>}
          {type === 'deleteNode' && <p><strong>{node?.item.name}</strong> será excluído{modal.node?.type === 'group' ? ', junto com seus subgrupos e funções' : modal.node?.type === 'section' ? ', junto com suas funções' : ''}. As pessoas atribuídas a essas funções serão retiradas de todos os times, mas continuam no menu de integrantes.</p>}
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button data-autofocus type="button" className="secondary-button" onClick={() => type === 'deleteNode' ? openModal({ type: 'structure' }) : onClose()}>Cancelar</button>
            <button type="button" className={type === 'import' ? 'primary-button' : 'danger-button'} onClick={() => {
              if (type === 'deleteTeam') {
                if (state.teams.length <= 1) return setError('Mantenha pelo menos um time. Você pode limpar sua escalação.')
                const next = removeTeam(state, editedTeam?.id)
                finish(next, 'Time excluído.', editedTeam?.id === activeTeam?.id ? next.teams[0]?.id : undefined)
              }
              if (type === 'clear') finish(clearTeam(state, editedTeam?.id), `${editedTeam?.name} limpo. Você pode desfazer.`)
              if (type === 'import') {
                if (!validateState(modal.data) || !modal.data.teams.length) return setError('Este backup não é válido. Escolha outro arquivo.')
                finish(modal.data, 'Backup restaurado.', modal.data.teams[0].id)
                onStructureChange()
              }
              if (type === 'deleteNode') deleteNode()
            }}>{type === 'deleteTeam' ? 'Excluir time' : type === 'clear' ? 'Limpar time' : type === 'import' ? 'Restaurar backup' : 'Excluir'}</button>
          </div>
        </div>}

        {type === 'help' && <div className="help-content">
          <p>Monte equipes fixas e experimente a distribuição das pessoas entre as funções.</p>
          <div><h3>Arrastar e escalar</h3><p>Arraste um integrante do menu até uma função. O menu sempre mantém o integrante disponível para outras funções. No quadro, arrastar move a pessoa; segure <kbd>Alt</kbd> ao soltar para copiar.</p><p>No celular, toque em um integrante e depois no botão <strong>+</strong> da função. Você também pode usar o <strong>+</strong> para procurar alguém.</p></div>
          <div><h3>Times</h3><p>Cada time reúne Louvor, Litúrgicos e Mídia. Os filtros permitem enxergar um grupo por vez.</p><p>O Time A começa com a organização anterior, como rascunho. Os times B e C começam vazios. Crie outros times do zero ou copie um existente.</p></div>
          <div><h3>Todos os times no mesmo quadro</h3><p>Os times aparecem um abaixo do outro e podem ser editados diretamente. No tablet em pé, os três núcleos ficam lado a lado em cada time. Os filtros de time e seção ficam na barra superior, junto com os outros controles.</p><p>Arrastar entre times move somente aquela atribuição. Segure Alt para copiar. O menu de integrantes sempre cria uma nova atribuição. Os espaços são compactos para uma ou duas pessoas, mas aceitam mais.</p></div>
          <div><h3>Limpar um time</h3><p>Use Limpar time no cabeçalho da formação ou na barra superior. Esse botão retira todas as pessoas das funções do time, incluindo as seções ocultas pelo filtro. Os outros times, os integrantes cadastrados e as anotações são mantidos. Você pode desfazer a limpeza.</p></div>
          <div><h3>Um quadro do seu jeito</h3><p>Em Estrutura, adicione grupos, subgrupos e funções. Essa organização é compartilhada entre os times. Clique na logo IPCVT para mostrar ou recolher o menu de integrantes. O quadro ocupa toda a área disponível.</p><p>O botão de sol ou lua no topo alterna os modos claro e escuro. Sua escolha fica salva neste navegador.</p></div>
          <div><h3>Fotos, PDF e backup</h3><p>Coloque as fotos em <code>public/fotos</code> usando o nome exato do integrante, incluindo espaços e acentos. Exemplo: <code>Nome do Integrante.jpg</code>. São aceitos JPG, JPEG, PNG e WebP.</p><p>Exporte o planejamento em PDF pelo botão no topo. As alterações ficam salvas neste navegador. Nas opções do time, use o backup JSON para guardar os dados ou restaurá-los em outro navegador.</p></div>
          <p className="help-footnote">O botão Desfazer recupera alterações desta sessão. Os backups ajudam a manter uma cópia fora do navegador.</p>
          <div className="dialog-actions"><button data-autofocus type="button" className="primary-button" onClick={onClose}>Voltar ao quadro<Icon name="arrow-right" size={17} /></button></div>
        </div>}
      </>}
    </dialog>
  )
}
