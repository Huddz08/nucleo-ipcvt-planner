const { chromium } = require('C:/Users/hamorimo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')

;(async () => {
  const { createInitialState } = await import(pathToFileURL(`${process.cwd()}/src/lib/planner.js`))
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    for (const [width, height] of [[1440, 1000], [768, 1024], [820, 1180], [1024, 768], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ipcvt-planner-v2')))
      const before = await saved()
      const layout = await page.locator('.team-board').first().evaluate((team) => {
        const canvas = team.querySelector('.canvas-scroll')
        const box = canvas.getBoundingClientRect()
        const bounds = team.getBoundingClientRect()
        return {
          top: bounds.top, bottom: bounds.bottom, height: bounds.height,
          canvas: { width: canvas.clientWidth, scroll: canvas.scrollWidth },
          groups: [...team.querySelectorAll('.group-card')].map((group) => ({ name: group.querySelector('h3').textContent, top: group.getBoundingClientRect().top, width: group.getBoundingClientRect().width })),
          outliers: [...team.querySelectorAll('.role-box, .person-token')].filter((item) => {
            const r = item.getBoundingClientRect()
            return r.left < box.left - 2 || r.right > box.right + 2
          }).map((item) => item.dataset.role || item.textContent),
        }
      })
      console.log(`${width}x${height}`, JSON.stringify(layout))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert(layout.canvas.scroll <= layout.canvas.width + 1)
      assert.deepEqual(layout.outliers, [])
      if (width >= 768) assert(layout.bottom < height - 15, `Time A did not fit: ${JSON.stringify(layout)}`)
      assert.deepEqual(await saved(), before)
      assert.equal(await page.locator('.team-board').count(), 3)
      await page.screenshot({ path: `test-results/fitted-${width}-light.png` })
      await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click()
      await page.screenshot({ path: `test-results/fitted-${width}-dark.png` })
      await page.getByLabel('Filtrar times', { exact: true }).selectOption('time-b')
      await page.locator('[data-role="voz-guia"]').getByRole('button', { name: 'Adicionar integrante em Voz Guia', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Hudson', exact: true }).click()
      assert.deepEqual((await saved()).teams[1].assignments['voz-guia'], ['hudson'])
      await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
      assert.deepEqual(await saved(), before)
      await page.getByLabel('Filtrar seção', { exact: true }).selectOption('midia')
      assert.equal(await page.locator('.group-card').count(), 1)
      assert.equal(await page.locator('.role-box').count(), 3)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.getByRole('button', { name: 'Exibir integrantes pela logo', exact: true }).click()
      assert.equal(await page.locator('.people-sidebar').count(), 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
      await context.close()
    }
    const fixture = createInitialState()
    for (const team of fixture.teams) for (const [id, people] of Object.entries(team.assignments)) team.assignments[id] = people.slice(0, 2)
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } })
    await context.addInitScript((state) => localStorage.setItem('ipcvt-planner-v2', JSON.stringify(state)), fixture)
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'test-results/fitted-tablet-two-people.png' })
    const bottom = await page.locator('.team-board').first().evaluate((team) => team.getBoundingClientRect().bottom)
    assert(bottom < 1000)
    console.log('PASS typical tablet team fits at bottom', bottom)
    await context.close()
    console.log('PASS fitted layout, no clipping or horizontal scroll, assignment/undo, filters, directory and themes')
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
