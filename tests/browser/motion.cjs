const assert = require('node:assert/strict')
const fs = require('node:fs')

module.exports = async function checkMotion(browser, url) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.evaluate(() => {
            const render = ProfilePreview.prototype.render
            ProfilePreview.prototype.render = function (...args) {
                window.motionPreview = this
                return render.apply(this, args)
            }
        })
        if (process.env.DELVUI_SAMPLE) {
            await page.fill('#inputStr', fs.readFileSync(process.env.DELVUI_SAMPLE, 'utf8'))
            await page.click('#previewBtn')
        } else await page.click('#demoUI')
        await page.check('#editPositions')
        await page.uncheck('#snapGrid')
        await page.uncheck('#smartGuides')
        const geometry = () => [...motionPreview.drawing.elements].map(([id, state]) => {
            const box = state.group.getBBox()
            const matrix = state.group.ownerSVGElement.getCTM().inverse().multiply(state.group.getCTM())
            const point = new DOMPoint(box.x, box.y).matrixTransform(matrix)
            const empty = box.width === 0 && box.height === 0
            return { id, x: empty ? 0 : point.x, y: empty ? 0 : point.y, width: box.width, height: box.height }
        })
        for (const view of ['original', 'scaled']) {
            await page.click(view === 'original' ? '#viewOriginal' : '#viewScaled')
            const report = await page.evaluate(async geometrySource => {
                const p = motionPreview, get = id => document.getElementById(id)
                const geometry = eval(`(${geometrySource})`)
                const selected = p.model.elements.find(e => e.name === 'Player Unit Frame')
                p.picker.value = selected.id
                p.render()
                const initial = structuredClone(p.profile), position = p.editor.position(selected.editPath)
                const nodes = [...p.drawing.elements].map(([id, entry]) => [id, entry.group])
                const option = p.picker.options[1], fontRow = get('fontRows').firstChild
                let scaleCalls = 0, fontCalls = 0
                const scaled = ConfigCodec.scaled, fonts = p.fonts.render
                ConfigCodec.scaled = (...args) => { scaleCalls++; return scaled(...args) }
                p.fonts.render = (...args) => { fontCalls++; return fonts.apply(p.fonts, args) }
                p.editor.beginTransaction()
                p.beginMotion()
                const timings = []
                for (let i = 0; i < 45; i++) {
                    await new Promise(requestAnimationFrame)
                    const start = performance.now()
                    p.editor.setPosition(selected.editPath, position.X + i + 1, position.Y + (i + 1) / 2)
                    p.renderMotion(selected.editPath)
                    p.svg.getBoundingClientRect()
                    timings.push(performance.now() - start)
                }
                const preserved = nodes.filter(([id, node]) => p.drawing.elements.get(id)?.group === node).length
                const stablePanels = option === p.picker.options[1] && fontRow === get('fontRows').firstChild
                ConfigCodec.scaled = scaled
                p.fonts.render = fonts
                p.editor.endTransaction()
                const fast = geometry(), model = p.model.elements
                p.motion = null
                p.render()
                const full = geometry(), fullModel = p.model.elements
                p.editor.undo()
                p.render()
                timings.sort((a, b) => a - b)
                return { scaleCalls, fontCalls, stablePanels, preserved, total: nodes.length, fast, full,
                    model, fullModel, restored: JSON.stringify(initial) === JSON.stringify(p.profile),
                    median: timings[22], p95: timings[42] }
            }, geometry.toString())
            assert.equal(report.scaleCalls, 0, 'Drag frames must not scale the full profile')
            assert.equal(report.fontCalls, 0, 'Drag frames must not rebuild the font panel')
            assert.equal(report.stablePanels, true)
            assert.equal(report.preserved, report.total, 'Position-only motion should retain scene nodes')
            assert.deepEqual(report.model, report.fullModel, 'Fast geometry must match a complete render')
            for (let i = 0; i < report.fast.length; i++) {
                assert.equal(report.fast[i].id, report.full[i].id)
                for (const key of ['x', 'y', 'width', 'height']) {
                    assert.ok(Math.abs(report.fast[i][key] - report.full[i][key]) < .03, `${report.fast[i].id}: ${key}`)
                }
            }
            assert.equal(report.restored, true, 'One undo must restore the entire gesture')
            console.log(`${view} motion: median ${report.median.toFixed(1)} ms, p95 ${report.p95.toFixed(1)} ms, ${report.total} retained elements`)
        }
        const burst = await page.evaluate(() => {
            const p = motionPreview, interactions = p.interactions
            const e = p.model.elements.find(e => e.name === 'Player Unit Frame'), position = p.editor.position(e.editPath)
            p.picker.value = e.id
            p.render()
            p.beginMotion()
            p.editor.beginTransaction()
            const box = p.svg.getBoundingClientRect(), point = interactions.point({ clientX: box.x, clientY: box.y })
            interactions.drag = { pointer: 77, start: point, path: e.editPath, position, displayed: p.positionInView(e.editPath),
                factor: p.factor(), element: e, rect: PreviewAlignment.bounds(e), targets: [] }
            let calls = 0
            const renderMotion = p.renderMotion
            p.renderMotion = function (...args) { calls++; return renderMotion.apply(this, args) }
            for (let i = 0; i < 100; i++) interactions.move({ pointerId: 77, clientX: box.x + i + 1, clientY: box.y + 10 })
            const queuedCalls = calls
            p.render()
            p.svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 77, bubbles: true }))
            const final = p.editor.position(e.editPath)
            p.renderMotion = renderMotion
            return { queuedCalls, calls, expected: position.X + 100 * p.svg.viewBox.baseVal.width / box.width / p.factor(),
                final: final.X, pending: Boolean(interactions.pendingMove || interactions.dragFrame), history: p.editor.undoStack.length }
        })
        assert.equal(burst.queuedCalls, 0)
        assert.equal(burst.calls, 1, 'A burst must coalesce and flush its final position at pointerup')
        assert.ok(Math.abs(burst.final - burst.expected) < .01)
        assert.equal(burst.pending, false)
        assert.equal(burst.history, 1)
        const cd = await page.evaluate(geometrySource => {
            const p = motionPreview, geometry = eval(`(${geometrySource})`), failures = []
            for (const view of ['original', 'scaled']) {
                p.view = view
                p.setProfile(structuredClone(DemoProfiles.DelvCD))
                const paths = [...new Map(p.model.elements.filter(e => e.editPath).map(e => [JSON.stringify(e.editPath), e.editPath])).values()]
                for (const path of paths) {
                    p.picker.value = p.model.elements.find(e => JSON.stringify(e.editPath) === JSON.stringify(path)).id
                    p.render()
                    const position = p.editor.position(path)
                    p.beginMotion()
                    p.editor.setPosition(path, position.X + 200, position.Y - 70)
                    p.renderMotion(path)
                    const model = p.model.elements, fast = geometry()
                    p.render()
                    const full = geometry()
                    if (JSON.stringify(model) !== JSON.stringify(p.model.elements)) failures.push(`${view}: ${JSON.stringify(path)} model`)
                    for (let i = 0; i < fast.length; i++) {
                        if (['x', 'y', 'width', 'height'].some(key => Math.abs(fast[i][key] - full[i][key]) > .03)) failures.push(`${view}: ${fast[i].id} geometry`)
                    }
                    p.editor.reset(path)
                    p.render()
                }
            }
            return failures
        }, geometry.toString())
        assert.deepEqual(cd, [], 'Moving DelvCD children must resize enclosing group bounds correctly')
        await page.evaluate(() => {
            const p = motionPreview
            p.profile.configs.push({ $type: 'DelvUI.Config.GCDIndicatorConfig', AnchorToMouse: true })
        })
        await page.fill('#manualScale', '0')
        await page.locator('#screenScroll').dispatchEvent('pointermove', { clientX: 400, clientY: 400, pointerId: 5 })
        await page.evaluate(() => new Promise(requestAnimationFrame))
        assert.deepEqual(errors, [])
    } finally { await page.close() }
}
