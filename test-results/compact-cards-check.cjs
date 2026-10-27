const { chromium } = require('C:/Users/hamorimo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    assert.deepEqual(await page.locator('[data-team="time-a"] [data-section="vocal"] .role-heading h5').allTextContents(), ['Voz Guia', 'Soprano', 'Contralto', 'Tenor'])
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ipcvt-planner-v2')))
    const initial = await saved()
    for (const width of [1440, 1920, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 })
      await page.evaluate(() => window.scrollTo(0, 0))
      const layout = await page.locator('.team-board').evaluateAll((boards) => boards.map((board) => ({
        top: board.getBoundingClientRect().top,
        sections: [...board.querySelectorAll('.formation-section')].map((section) => ({
          top: section.getBoundingClientRect().top,
          roles: [...section.querySelectorAll('.role-box')].map((role) => {
            const { x, y, width } = role.getBoundingClientRect()
            return { id: role.dataset.role, x, y, width }
          }),
        })),
      })))
      assert.equal(layout.length, 3)
      for (const board of layout) {
        assert(board.sections.every((section) => Math.abs(section.top - board.sections[0].top) < 2))
        for (const section of board.sections) {
          assert(section.roles.every((role) => Math.abs(role.width - 144) < 1))
          assert(section.roles.every((role) => Math.abs(role.y - section.roles[0].y) < 1))
          assert(section.roles.every((role, i) => i === 0 || role.x > section.roles[i - 1].x + 140))
        }
      }
      const columns = layout.map((board) => board.sections.flatMap((section) => section.roles.map((role) => ({ id: role.id, x: role.x, width: role.width }))))
      assert.deepEqual(columns[1], columns[0])
      assert.deepEqual(columns[2], columns[0])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(await saved(), initial)
      await page.screenshot({ path: `test-results/compact-cards-${width}.png` })
      console.log(`PASS ${width}px: fixed-width role cards in one row, aligned teams, no document overflow or data changes`)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByLabel('Filtrar seção', { exact: true }).selectOption('midia')
    const media = await page.locator('.team-board').first().locator('.role-box').evaluateAll((roles) => roles.map((role) => ({ width: role.getBoundingClientRect().width, y: role.getBoundingClientRect().y })))
    assert(media.every((role) => role.width === 144 && role.y === media[0].y))
    await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click()
    await page.screenshot({ path: 'test-results/compact-cards-midia-dark.png' })
    await page.getByLabel('Filtrar seção', { exact: true }).selectOption('all')
    const canvases = page.locator('.canvas-scroll')
    for (const offset of [500, 0, 900, 0]) {
      await canvases.first().evaluate((canvas, left) => { canvas.scrollLeft = left }, offset)
      await page.waitForFunction((left) => [...document.querySelectorAll('.canvas-scroll')].every((canvas) => Math.abs(canvas.scrollLeft - left) < 1), offset)
    }
    await page.getByRole('button', { name: 'Exibir integrantes pela logo', exact: true }).click()
    await page.locator('.directory-person').filter({ has: page.locator('.directory-name', { hasText: /^Hudson$/ }) }).click()
    await page.locator('[data-team="time-b"] [data-role="guitarra"]').getByRole('button', { name: 'Adicionar integrante em Guitarra', exact: true }).click()
    assert.deepEqual((await saved()).teams.find((team) => team.id === 'time-b').assignments.guitarra, ['hudson'])
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    assert.deepEqual(await saved(), initial)
    assert.deepEqual(errors, [])
    console.log('PASS single-section view, dark theme, scroll in both directions, assignment to an offscreen card and undo')
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
