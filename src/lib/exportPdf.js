import { jsPDF } from 'jspdf'
import { allRoles, slugify } from './planner.js'

const PAPER = '#faf9f4'
const INK = '#283d34'
const MUTED = '#6c786e'
const PALETTES = {
  sage: { background: '#e7eddf', border: '#c4cfbd', ink: '#496447' },
  peach: { background: '#f4e6da', border: '#e2cdbb', ink: '#86664c' },
  lavender: { background: '#eae5f1', border: '#d3c9e1', ink: '#726083' },
}
const MARGIN = 12
const BOTTOM = 196
const GRID_GAP = 3
const TOKEN_COLUMNS = 4
const NAME_LINE_HEIGHT = 2.9

function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words.length > 1 ? words[0][0] + words.at(-1)[0] : words[0].slice(0, 2)).toLocaleUpperCase('pt-BR')
}

function setType(pdf, size, style = 'normal', color = INK) {
  pdf.setFont('helvetica', style)
  pdf.setFontSize(size)
  pdf.setTextColor(color)
}

function wrapped(pdf, text, width, size, style = 'normal') {
  setType(pdf, size, style)
  return pdf.splitTextToSize(String(text || ''), width)
}

function rolePieces(pdf, role, team, peopleById, width, maxHeight) {
  const people = (team.assignments[role.id] || []).map((id) => peopleById[id]).filter(Boolean)
  const tokenWidth = (width - 8) / TOKEN_COLUMNS
  const rows = []
  for (let index = 0; index < people.length; index += TOKEN_COLUMNS) {
    const tokens = people.slice(index, index + TOKEN_COLUMNS).map((person) => ({ person, lines: wrapped(pdf, person.name, tokenWidth - 2, 7.4) }))
    rows.push({ tokens, height: 11 + Math.max(...tokens.map((token) => token.lines.length)) * NAME_LINE_HEIGHT })
  }
  const parts = []
  let remaining = [...rows]
  do {
    const title = `${role.name}${parts.length ? ' (continuação)' : ''}`
    const titleLines = wrapped(pdf, title, width - 8, 9, 'bold')
    const titleHeight = 4.5 + titleLines.length * 3.6
    const partRows = []
    let height = titleHeight + 2
    while (remaining.length && (partRows.length === 0 || height + remaining[0].height <= maxHeight)) {
      const row = remaining.shift()
      partRows.push(row)
      height += row.height
    }
    parts.push({ titleLines, titleHeight, rows: partRows, height: Math.max(22, height) })
  } while (remaining.length)
  return parts
}

function drawRole(pdf, part, x, y, width, height, palette, photos) {
  pdf.setFillColor('#ffffff')
  pdf.setDrawColor(palette.border)
  pdf.setLineWidth(0.22)
  pdf.roundedRect(x, y, width, height, 2, 2, 'FD')
  setType(pdf, 9, 'bold', palette.ink)
  pdf.text(part.titleLines, x + 4, y + 5.5, { lineHeightFactor: 1.13 })
  let rowY = y + part.titleHeight
  if (!part.rows.length) {
    pdf.setDrawColor(palette.border)
    pdf.circle(x + 7, rowY + 4, 2.5)
    setType(pdf, 8, 'normal', MUTED)
    pdf.text('Sem integrante', x + 12, rowY + 5)
    return
  }
  const tokenWidth = (width - 8) / TOKEN_COLUMNS
  for (const row of part.rows) {
    row.tokens.forEach(({ person, lines }, index) => {
      const centerX = x + 4 + tokenWidth * (index + 0.5)
      const centerY = rowY + 4
      pdf.setFillColor(palette.background)
      pdf.circle(centerX, centerY, 4, 'F')
      const photo = photos[person.id]
      let hasPhoto = false
      if (photo) {
        try { pdf.addImage(photo, 'PNG', centerX - 4, centerY - 4, 8, 8, `portrait-${person.id}`, 'FAST'); hasPhoto = true } catch { /* Keep the initials if a photo cannot be embedded. */ }
      }
      if (!hasPhoto) {
        setType(pdf, 7.4, 'bold', palette.ink)
        pdf.text(initials(person.name), centerX, centerY + 0.9, { align: 'center' })
      }
      setType(pdf, 7.4, 'normal', INK)
      lines.forEach((line, lineIndex) => pdf.text(line, centerX, rowY + 11 + lineIndex * NAME_LINE_HEIGHT, { align: 'center' }))
    })
    rowY += row.height
  }
}

/** Creates a text-searchable PDF without relying on the current screen, theme, or zoom. */
export function buildPlannerPdf(state, { teamId = null, groupId = 'all', photos = {} } = {}) {
  const teams = teamId ? state.teams.filter((team) => team.id === teamId) : state.teams
  const groups = groupId === 'all' ? state.groups : state.groups.filter((group) => group.id === groupId)
  if (!teams.length) throw new Error('Time não encontrado para exportar.')
  if (groupId !== 'all' && !groups.length) throw new Error('Núcleo não encontrado para exportar.')

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2
  const roleWidth = (contentWidth - GRID_GAP * 2) / 3
  const peopleById = Object.fromEntries(state.people.map((person) => [person.id, person]))
  const visibleRoles = allRoles(groups)
  const pageLabels = []
  let started = false

  pdf.setProperties({ title: `Planner IPCVT · ${teams.length === 1 ? teams[0].name : 'Planejamento de times'}`, subject: 'Formações e funções das equipes', creator: 'Planner IPCVT', author: 'IPCVT' })

  for (const team of teams) {
    const uniquePeople = new Set(visibleRoles.flatMap((role) => team.assignments[role.id] || []).filter((id) => peopleById[id]))
    const filledRoles = visibleRoles.filter((role) => team.assignments[role.id]?.some((id) => peopleById[id])).length
    let y = 0
    let bodyTop = 0

    const startPage = () => {
      if (started) pdf.addPage()
      started = true
      pageLabels.push(team.name)
      pdf.setFillColor(PAPER)
      pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F')
      pdf.setFillColor('#53735b')
      pdf.rect(0, 0, pageWidth, 2, 'F')
      setType(pdf, 8.5, 'bold', '#53735b')
      pdf.text('IPCVT  /  PLANNER', MARGIN, 11)
      setType(pdf, 7.5, 'normal', MUTED)
      pdf.text(groupId === 'all' ? 'FORMAÇÃO COMPLETA' : 'NÚCLEO SELECIONADO', pageWidth - MARGIN, 11, { align: 'right' })
      const nameLines = wrapped(pdf, team.name, contentWidth, 21, 'bold')
      setType(pdf, 21, 'bold')
      pdf.text(nameLines, MARGIN, 22, { lineHeightFactor: 1.1 })
      y = 23 + nameLines.length * 7.5
      if (team.description.trim()) {
        const descriptionLines = wrapped(pdf, team.description.trim(), contentWidth, 8.5)
        setType(pdf, 8.5, 'normal', MUTED)
        pdf.text(descriptionLines, MARGIN, y, { lineHeightFactor: 1.2 })
        y += descriptionLines.length * 3.6 + 1
      }
      setType(pdf, 8, 'normal', MUTED)
      pdf.text(`${uniquePeople.size} ${uniquePeople.size === 1 ? 'integrante' : 'integrantes'}  ·  ${filledRoles}/${visibleRoles.length} funções ocupadas`, MARGIN, y + 1)
      pdf.setDrawColor('#d9dfd3')
      pdf.setLineWidth(0.25)
      pdf.line(MARGIN, y + 5, pageWidth - MARGIN, y + 5)
      bodyTop = y + 10
      y = bodyTop
    }

    startPage()

    const drawGroupHeading = (group, continued = false) => {
      const palette = PALETTES[group.color] || PALETTES.sage
      const index = state.groups.indexOf(group) + 1
      const titleLines = wrapped(pdf, `${group.name}${continued ? ' · continuação' : ''}`, contentWidth - 20, 12.5, 'bold')
      const height = 6 + titleLines.length * 4.6
      pdf.setFillColor(palette.background)
      pdf.roundedRect(MARGIN, y, contentWidth, height, 2, 2, 'F')
      setType(pdf, 7.5, 'bold', palette.ink)
      pdf.text(String(index).padStart(2, '0'), MARGIN + 4, y + 6.8)
      setType(pdf, 12.5, 'bold', palette.ink)
      pdf.text(titleLines, MARGIN + 13, y + 7, { lineHeightFactor: 1.04 })
      y += height + 2
    }

    const groupHeadingHeight = (group) => 8 + wrapped(pdf, `${group.name} · continuação`, contentWidth - 20, 12.5, 'bold').length * 4.6
    const sectionHeadingHeight = (section) => 4 + wrapped(pdf, section.name, contentWidth - 2, 9, 'bold').length * 3.5
    const drawSectionHeading = (section, continued = false) => {
      const lines = wrapped(pdf, `${section.name}${continued ? ' · continuação' : ''}`, contentWidth - 2, 9, 'bold')
      setType(pdf, 9, 'bold', MUTED)
      pdf.text(lines, MARGIN + 1, y + 3.5, { lineHeightFactor: 1.1 })
      y += 4 + lines.length * 3.5
    }

    if (!groups.length) {
      setType(pdf, 10, 'normal', MUTED)
      pdf.text('Nenhum núcleo criado neste planejamento.', MARGIN, y + 6)
      y += 15
    }

    for (const group of groups) {
      const palette = PALETTES[group.color] || PALETTES.sage
      const maxRoleHeight = BOTTOM - bodyTop - groupHeadingHeight(group) - 18
      const preparedSections = group.sections.map((section) => ({
        section,
        pieces: section.roles.flatMap((role) => rolePieces(pdf, role, team, peopleById, roleWidth, maxRoleHeight)),
      }))
      const firstSection = preparedSections[0]
      const firstRowHeight = firstSection ? Math.max(12, ...firstSection.pieces.slice(0, 3).map((part) => part.height)) : 12
      const requiredStart = groupHeadingHeight(group) + (firstSection ? sectionHeadingHeight(firstSection.section) : 0) + firstRowHeight
      if (y + requiredStart > BOTTOM && y > bodyTop) startPage()
      drawGroupHeading(group)

      if (!preparedSections.length) {
        setType(pdf, 8.5, 'normal', MUTED)
        pdf.text('Sem subgrupos definidos.', MARGIN + 1, y + 4)
        y += 12
      }

      for (const { section, pieces } of preparedSections) {
        const rowHeight = Math.max(12, ...pieces.slice(0, 3).map((part) => part.height))
        if (y + sectionHeadingHeight(section) + rowHeight > BOTTOM && y > bodyTop) {
          startPage()
          drawGroupHeading(group, true)
        }
        drawSectionHeading(section)
        if (!pieces.length) {
          setType(pdf, 8, 'normal', MUTED)
          pdf.text('Sem funções definidas.', MARGIN + 1, y + 4)
          y += 12
        }
        for (let index = 0; index < pieces.length; index += 3) {
          const row = pieces.slice(index, index + 3)
          const height = Math.max(...row.map((part) => part.height))
          if (y + height > BOTTOM) {
            startPage()
            drawGroupHeading(group, true)
            drawSectionHeading(section, true)
          }
          row.forEach((part, column) => drawRole(pdf, part, MARGIN + column * (roleWidth + GRID_GAP), y, roleWidth, height, palette, photos))
          y += height + GRID_GAP
        }
        y += 1
      }
      y += 3
    }

    const note = state.notes?.[team.id]?.trim()
    if (note) {
      const lines = wrapped(pdf, note, contentWidth - 10, 9)
      let offset = 0
      let continued = false
      while (offset < lines.length) {
        if (y + 20 > BOTTOM) startPage()
        const capacity = Math.max(1, Math.floor((BOTTOM - y - 14) / 4.2))
        const chunk = lines.slice(offset, offset + capacity)
        const height = 13 + chunk.length * 4.2
        pdf.setFillColor('#f2eddb')
        pdf.setDrawColor('#ddd3b3')
        pdf.setLineWidth(0.2)
        pdf.roundedRect(MARGIN, y, contentWidth, height, 2, 2, 'FD')
        setType(pdf, 9, 'bold', '#776a43')
        pdf.text(`Ideias para este time${continued ? ' · continuação' : ''}`, MARGIN + 5, y + 6)
        setType(pdf, 9)
        chunk.forEach((line, index) => pdf.text(line, MARGIN + 5, y + 12 + index * 4.2))
        offset += chunk.length
        continued = true
        y += height + 5
      }
    }
  }

  const total = pdf.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor('#d9dfd3')
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN, 200, pageWidth - MARGIN, 200)
    setType(pdf, 7, 'normal', MUTED)
    pdf.text('IPCVT · Planejamento de equipes', MARGIN, 204)
    pdf.text(`${pageLabels[page - 1]}  /  ${page} de ${total}`, pageWidth - MARGIN, 204, { align: 'right' })
  }
  return pdf
}

function loadedPortraits(state) {
  if (typeof document === 'undefined') return {}
  const images = new Map()
  document.querySelectorAll('.avatar[aria-label] img').forEach((image) => {
    if (image.complete && image.naturalWidth > 0) images.set(image.closest('.avatar').getAttribute('aria-label'), image)
  })
  const photos = {}
  for (const person of state.people) {
    const image = images.get(person.name)
    if (!image) continue
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 160
      const context = canvas.getContext('2d')
      if (!context) continue
      context.beginPath()
      context.arc(80, 80, 80, 0, Math.PI * 2)
      context.clip()
      const cropSize = Math.min(image.naturalWidth, image.naturalHeight)
      context.drawImage(image, (image.naturalWidth - cropSize) / 2, (image.naturalHeight - cropSize) / 2, cropSize, cropSize, 0, 0, 160, 160)
      photos[person.id] = canvas.toDataURL('image/png')
    } catch { /* Remote photos may disallow canvas access; initials remain available. */ }
  }
  return photos
}

/** Downloads the active team, or every team when teamId is omitted. */
export async function exportPlannerPdf({ state, teamId = null, groupId = 'all' }) {
  const team = state.teams.find((item) => item.id === teamId)
  const group = state.groups.find((item) => item.id === groupId)
  const suffix = [team ? team.name : 'planejamento', groupId !== 'all' ? group?.name : ''].filter(Boolean).map((value) => slugify(value).slice(0, 60)).filter(Boolean).join('-')
  const filename = `planner-ipcvt-${suffix || 'planejamento'}.pdf`
  const pdf = buildPlannerPdf(state, { teamId, groupId, photos: loadedPortraits(state) })
  await pdf.save(filename, { returnPromise: true })
  return filename
}
