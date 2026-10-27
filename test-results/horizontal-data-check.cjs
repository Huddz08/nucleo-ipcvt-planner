const { chromium } = require('C:/Users/hamorimo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')

;(async () => {
  const { createInitialState, normalizePlannerState } = await import(pathToFileURL(`${process.cwd()}/src/lib/planner.js`))
  const old = createInitialState()
  old.groups.find((g) => g.id === 'louvor').sections.find((s) => s.id === 'tecnica').roles.push({ id: 'repertorio', name: 'Repertório' })
  old.groups.find((g) => g.id === 'liturgicos').sections[0].roles.push({ id: 'eventos', name: 'Eventos' })
  old.teams[0].assignments.repertorio = ['liliane']
  old.teams[1].assignments.eventos = ['hudson']
  old.notes['time-b'] = 'Manter anotação no backup.'
  old.settings = { custom: true }
  const expected = normalizePlannerState(old)
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } })
    await context.addInitScript((fixture) => {
      if (!localStorage.getItem('ipcvt-planner-v2')) localStorage.setItem('ipcvt-planner-v2', JSON.stringify(fixture))
    }, old)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ipcvt-planner-v2')))
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
    assert.deepEqual(await saved(), expected)
    assert.equal(await page.locator('[data-role="repertorio"], [data-role="eventos"]').count(), 0)
    assert.equal(await page.locator('.team-board').count(), 3)
    console.log('PASS old saved state migrates with all remaining data intact')

    const canvases = page.locator('.canvas-scroll')
    await canvases.first().evaluate((el) => { el.scrollLeft = el.scrollWidth - el.clientWidth })
    await page.waitForTimeout(150)
    const offsets = await canvases.evaluateAll((els) => els.map((el) => el.scrollLeft))
    assert(offsets[0] > 0)
    assert(offsets.every((left) => Math.abs(left - offsets[0]) < 2), JSON.stringify(offsets))
    const tops = await page.locator('.team-board').first().locator('[data-group="louvor"] .formation-section').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
    assert(tops.every((top) => Math.abs(top - tops[0]) < 2))
    const origins = await page.locator('.team-board').evaluateAll((boards) => boards.map((board) => [...board.querySelectorAll('.formation-section')].map((section) => section.getBoundingClientRect().left)))
    assert(origins.every((lefts) => lefts.every((left, i) => Math.abs(left - origins[0][i]) < 2)))
    await canvases.nth(1).scrollIntoViewIfNeeded()
    for (const offset of [0, 150, 70, 200, 0]) {
      await canvases.nth(1).evaluate((el, left) => { el.scrollLeft = left }, offset)
      await page.waitForFunction((left) => [...document.querySelectorAll('.canvas-scroll')].every((el) => Math.abs(el.scrollLeft - left) < 2), offset, { timeout: 3000 })
      const positions = await canvases.evaluateAll((els) => els.map((el) => el.scrollLeft))
      assert(positions.every((left) => Math.abs(left - offset) < 2), JSON.stringify({ offset, positions }))
    }
    console.log('PASS horizontal scroll synchronizes team columns without wrapping subgroups')

    await page.getByRole('button', { name: 'Opções do time', exact: true }).click()
    await page.getByRole('button', { name: 'Restaurar backup', exact: true }).click()
    await page.getByLabel('Importar backup do planejamento', { exact: true }).setInputFiles({ name: 'backup-antigo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) })
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar backup', exact: true }).click()
    assert.deepEqual(await saved(), expected)
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(await saved(), expected)
    console.log('PASS restoring an old backup and reloading preserve normalized data')

    await page.getByLabel('Filtrar seção', { exact: true }).selectOption('louvor')
    await page.getByLabel('Filtrar times', { exact: true }).selectOption('time-b')
    const tenor = page.locator('[data-role="tenor"]')
    await tenor.getByRole('button', { name: 'Adicionar integrante em Tenor', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hudson', exact: true }).click()
    assert((await saved()).teams[1].assignments.tenor.includes('hudson'))
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    assert.deepEqual(await saved(), expected)
    assert.deepEqual(errors, [])
    console.log('PASS assignments, filters and undo still work in the horizontal formation; no runtime errors')
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
