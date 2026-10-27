const { chromium } = require('C:/Users/hamorimo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const output = path.resolve('test-results')
  const results = []
  const errors = []
  try {
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(`${width}: ${error.message}`))
      await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
      await page.locator('.team-board').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      for (const theme of ['light', 'dark']) {
        const currentTheme = await page.evaluate(() => document.documentElement.dataset.theme)
        if (currentTheme !== theme) await page.locator('.theme-toggle').click()
        for (const filter of ['all', 'louvor', 'midia']) {
          await page.getByLabel('Filtrar seção', { exact: true }).selectOption(filter)
          await page.evaluate(() => document.querySelectorAll('.canvas-scroll').forEach((canvas) => { canvas.scrollLeft = 0 }))
          await page.waitForTimeout(100)
          const info = await page.evaluate(() => {
            const rect = (element) => {
              const r = element.getBoundingClientRect()
              return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
            }
            const canvases = Array.from(document.querySelectorAll('.canvas-scroll'))
            const teamBoards = Array.from(document.querySelectorAll('.team-board'))
            const toolbar = document.querySelector('.planner-toolbar-controls')
            const controls = Array.from(toolbar.children).map((element) => ({ class: element.className, ...rect(element) }))
            return {
              docOverflow: document.documentElement.scrollWidth - innerWidth,
              header: rect(document.querySelector('.topbar')),
              toolbar: { client: toolbar.clientWidth, scroll: toolbar.scrollWidth },
              controls,
              teams: teamBoards.map((team) => ({
                id: team.dataset.team, ...rect(team),
                groups: Array.from(team.querySelectorAll('.group-card')).map((group) => ({
                  id: group.dataset.group, ...rect(group),
                  sections: Array.from(group.querySelectorAll('.formation-section')).map((section) => ({ id: section.dataset.section, ...rect(section), expectedColumns: Number(section.style.getPropertyValue('--section-columns')), actualColumns: getComputedStyle(section.querySelector('.role-grid')).gridTemplateColumns.split(' ').length })),
                })),
              })),
              canvases: canvases.map((canvas) => ({ client: canvas.clientWidth, scroll: canvas.scrollWidth, ...rect(canvas) })),
            }
          })
          const failures = []
          if (info.docOverflow > 1) failures.push(`document overflow ${info.docOverflow}px`)
          if (info.header.height !== 52) failures.push(`header height ${info.header.height}`)
          if (width >= 768 && info.toolbar.scroll > info.toolbar.client + 1) failures.push(`toolbar overflow ${info.toolbar.scroll - info.toolbar.client}px`)
          for (const team of info.teams) {
            if (new Set(team.groups.map((group) => group.y)).size > 1) failures.push(`${team.id}: group rows differ`)
            const worship = team.groups.find((group) => group.id === 'louvor')
            if (worship && new Set(worship.sections.map((section) => section.y)).size > 1) failures.push(`${team.id}: section rows differ`)
            for (const group of team.groups) for (const section of group.sections) {
              if (section.expectedColumns !== section.actualColumns) failures.push(`${team.id}/${section.id}: ${section.actualColumns} columns instead of ${section.expectedColumns}`)
            }
          }
          if (info.teams.length > 1) {
            const first = info.teams[0].groups
            for (const team of info.teams.slice(1)) {
              if (JSON.stringify(team.groups.map(({ id, x, width }) => ({ id, x, width }))) !== JSON.stringify(first.map(({ id, x, width }) => ({ id, x, width })))) failures.push(`${team.id}: columns differ from Time A`)
            }
          }
          let sync = null
          if (info.canvases[0].scroll > info.canvases[0].client) {
            await page.locator('.canvas-scroll').first().evaluate((canvas) => { canvas.scrollLeft = 230 })
            await page.waitForTimeout(130)
            sync = await page.locator('.canvas-scroll').evaluateAll((canvases) => canvases.map((canvas) => canvas.scrollLeft))
            if (new Set(sync.map(Math.round)).size > 1) failures.push(`scroll sync differs: ${sync}`)
            await page.locator('.canvas-scroll').first().evaluate((canvas) => { canvas.scrollLeft = 0 })
            await page.waitForTimeout(150)
            const reset = await page.locator('.canvas-scroll').evaluateAll((canvases) => canvases.map((canvas) => canvas.scrollLeft))
            if (reset.some((offset) => offset !== 0)) failures.push(`scroll did not return to the start: ${reset}`)
          }
          const screenshot = path.join(output, `horizontal-${width}-${theme}-${filter}.png`)
          await page.screenshot({ path: screenshot, fullPage: true })
          results.push({ width, height, theme, filter, failures, sync, screenshot, ...info })
          process.stdout.write(`${failures.length ? 'FAIL' : 'PASS'} ${width} ${theme} ${filter}: docOverflow=${info.docOverflow}, canvas=${info.canvases[0].client}/${info.canvases[0].scroll}\n`)
        }
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
  const report = { errors, results }
  fs.writeFileSync(path.join(output, 'horizontal-responsive-report.json'), JSON.stringify(report, null, 2))
  process.stdout.write(`Errors: ${JSON.stringify(errors)}\n`)
  if (errors.length || results.some((result) => result.failures.length)) process.exitCode = 1
})().catch((error) => { console.error(error); process.exitCode = 1 })
