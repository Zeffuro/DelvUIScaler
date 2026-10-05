const assert = require('node:assert/strict')

module.exports = async function checkHardening(browser, url) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const external = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
        window.cspViolations = []
        document.addEventListener('securitypolicyviolation', event => cspViolations.push(event.violatedDirective))
    })
    await page.route('**/*', route => {
        if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue()
        external.push(route.request().url())
        return route.abort()
    })
    const loaded = () => page.waitForFunction(() => document.getElementById('inputStatus').classList.contains('success'))
    const ready = () => page.waitForFunction(() => document.getElementById('outputStatus').textContent.startsWith('Ready'))
    const frame = () => page.evaluate(() => new Promise(requestAnimationFrame))
    const enter = async (id, value) => { await page.fill(id, value); await page.locator(id).press('Tab') }
    try {
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.evaluate(() => {
            const render = ProfilePreview.prototype.render
            ProfilePreview.prototype.render = function (...args) { window.reviewPreview = this; return render.apply(this, args) }
        })
        await page.click('#demoUI')
        await loaded()
        await page.selectOption('#targetRes', 'custom')
        await enter('#targetWidth', '2560')
        await enter('#targetHeight', '1600')
        assert.equal(await page.isVisible('#aspectHint'), true)
        for (const [mode, factor] of [['height', '1.111'], ['width', '1.000'], ['fit', '1.000'], ['fill', '1.111']]) {
            await page.selectOption('#scaleMode', mode)
            assert.equal(await page.inputValue('#manualScale'), factor)
        }
        await enter('#manualScale', '1.25')
        assert.equal(await page.inputValue('#scaleMode'), 'manual')
        await enter('#targetHeight', '1200')
        assert.equal(await page.inputValue('#manualScale'), '1.25')
        await page.click('#undoEdit')
        assert.equal(await page.inputValue('#targetHeight'), '1600')
        assert.equal(await page.inputValue('#scaleMode'), 'manual')
        await page.click('#undoEdit')
        assert.equal(await page.inputValue('#scaleMode'), 'fill')
        assert.equal(await page.inputValue('#manualScale'), '1.111')

        const cache = await page.evaluate(async () => {
            const p = reviewPreview, scaled = ConfigCodec.scaled
            let scales = 0, renders = 0
            ConfigCodec.scaled = (...args) => { scales++; return scaled(...args) }
            const render = p.render
            p.render = function (...args) { renders++; return render.apply(this, args) }
            document.getElementById('manualScale').value = '2'
            p.render()
            const first = p.scaledProfile()
            p.view = 'scaled'
            p.render()
            p.fonts.render(p.profile)
            const beforeBurst = renders
            for (let i = 0; i < 100; i++) {
                const field = document.getElementById('dummyName')
                field.value = `Sample ${i}`
                field.dispatchEvent(new Event('input', { bubbles: true }))
            }
            await new Promise(requestAnimationFrame)
            const same = first === p.scaledProfile(), burst = renders - beforeBurst
            ConfigCodec.scaled = scaled
            p.render = render
            return { scales, same, burst }
        })
        assert.deepEqual(cache, { scales: 1, same: true, burst: 1 })
        const partial = await page.evaluate(() => {
            const p = reviewPreview, profile = structuredClone(DemoProfiles.DelvCD)
            const path = ['configs', 0, 'ElementList', 'UIElements', 1, 'BarStyleConfig', 'Position']
            profile.configs[0].ElementList.UIElements[1].BarStyleConfig.Position = { X: 10 }
            p.setProfile(profile)
            p.beginMotion()
            p.editor.setPosition(path, 20, 0)
            p.renderMotion(path)
            p.editor.setPosition(path, 10, 0)
            p.renderMotion(path)
            const fast = p.positionInView(path)
            p.render()
            const full = p.positionInView(path)
            const fresh = ConfigCodec.scaled(p.profile, 2)
            const cacheMatches = JSON.stringify(fresh) === JSON.stringify(p.scaledProfile())
            p.editor.setPosition(path, 30, 4)
            p.render()
            p.editor.undo()
            p.render()
            return { fast, full, cacheMatches, restored: p.positionInView(path) }
        })
        assert.deepEqual(partial, { fast: { X: 20, Y: 0 }, full: { X: 20, Y: 0 }, cacheMatches: true, restored: { X: 20, Y: 0 } })
        const unknownStyle = await page.evaluate(() => {
            const p = reviewPreview, profile = structuredClone(DemoProfiles.DelvCD)
            const path = ['configs', 0, 'ElementList', 'UIElements', 1, 'BarStyleConfig', 'Position']
            const style = profile.configs[0].ElementList.UIElements[1].BarStyleConfig
            style.$type = 'Future.CustomBarStyleConfig'
            style.Position = { X: 10 }
            p.setProfile(profile)
            p.beginMotion()
            p.editor.setPosition(path, 20, 0)
            p.renderMotion(path)
            p.editor.setPosition(path, 10, 0)
            p.renderMotion(path)
            const fast = p.positionInView(path)
            p.render()
            return { fast, full: p.positionInView(path), matches: JSON.stringify(p.scaledProfile()) === JSON.stringify(ConfigCodec.scaled(p.profile, 2)) }
        })
        assert.deepEqual(unknownStyle, { fast: { X: 10, Y: 0 }, full: { X: 10, Y: 0 }, matches: true })
        await page.click('#demoUI')
        await loaded()
        assert.equal(await page.isVisible('#exportAudit'), true, 'Audit is available before generating')
        await page.selectOption('#wheelMode', 'scroll')
        const zoom = await page.inputValue('#previewZoom')
        await page.locator('#screenScroll').hover()
        await page.mouse.wheel(0, 200)
        assert.equal(await page.inputValue('#previewZoom'), zoom)
        await page.reload({ waitUntil: 'networkidle' })
        assert.equal(await page.inputValue('#wheelMode'), 'scroll')
        await page.click('#demoUI')
        await loaded()
        await page.selectOption('#wheelMode', 'zoom')
        await page.locator('#screenScroll').hover()
        await page.mouse.wheel(0, -250)
        await page.waitForFunction(() => Number(document.getElementById('previewZoom').value) > 100)

        await page.evaluate(() => {
            const real = ProfileCodecService.prototype.decode
            ProfileCodecService.prototype.decode = function (text) {
                ProfileCodecService.prototype.decode = real
                return new Promise(resolve => { window.releaseDecode = () => real.call(this, text).then(resolve) })
            }
        })
        await page.click('#demoCD')
        await page.waitForFunction(() => typeof window.releaseDecode === 'function')
        await page.click('#clearBtn')
        await page.evaluate(async () => { await window.releaseDecode(); await new Promise(resolve => setTimeout(resolve, 20)) })
        assert.equal(await page.textContent('#profileKind'), 'No profile loaded', 'Late decoded profile cannot replace Clear')
        await page.click('#demoUI')
        await loaded()
        await page.evaluate(() => {
            const real = ProfileCodecService.prototype.encode
            ProfileCodecService.prototype.encode = function (profile, factor) {
                ProfileCodecService.prototype.encode = real
                return new Promise(resolve => { window.releaseExport = () => real.call(this, profile, factor).then(resolve) })
            }
        })
        await page.click('#processBtn')
        await page.waitForFunction(() => typeof window.releaseExport === 'function')
        await enter('#manualScale', '1.7')
        await page.evaluate(async () => { await window.releaseExport(); await new Promise(resolve => setTimeout(resolve, 20)) })
        assert.equal(await page.inputValue('#outputStr'), '', 'Late export cannot replace changed settings')
        assert.equal(await page.isDisabled('#downloadBtn'), true)

        await page.evaluate(() => {
            const field = document.getElementById('inputStr')
            field.value = ' '.repeat(ProfileLimits.sourceBytes + 1) + ConfigCodec.encode(DemoProfiles.DelvUI)
        })
        await page.click('#previewBtn')
        await page.waitForFunction(() => document.getElementById('inputStatus').classList.contains('error'))
        assert.match(await page.textContent('#inputStatus'), /8 MiB/)
        assert.equal(await page.textContent('#profileKind'), 'No profile loaded')

        const count = 150000
        const totalUnknown = await page.evaluate(count => {
            const profile = structuredClone(DemoProfiles.DelvUI)
            profile.configs[0].FutureSettings = Object.fromEntries(Array.from({ length: count }, (_, i) => [`value${i}`, i]))
            document.getElementById('inputStr').value = ConfigCodec.encode(profile)
            return ProfileScalePolicy.inspect(profile).unknownNumeric.length
        }, count)
        await page.click('#previewBtn')
        await loaded()
        assert.match(await page.textContent('#exportAuditSummary'), new RegExp(`${totalUnknown} unknown`))
        assert.equal(await page.locator('#exportAuditUnknown li').count(), 51)
        await page.click('#processBtn')
        await ready()
        const unknown = await page.evaluate(() => ConfigCodec.decode(document.getElementById('outputStr').value).configs[0].FutureSettings)
        assert.equal(Object.keys(unknown).length, count)
        assert.equal(unknown.value149999, 149999)
        assert.equal(await page.locator('#exportAuditUnknown li').count(), 51)
        await page.fill('#manualScale', '0')
        await frame()
        assert.equal(await page.isVisible('#exportAudit'), false, 'Invalid scale hides stale audit')
        assert.deepEqual(await page.evaluate(() => cspViolations), [])
        assert.deepEqual(external, [])
        assert.deepEqual(errors, [])
        console.log('Worker races, budgets, offline assets, CSP, scale modes, audit and cache checks passed.')
    } finally { await page.close() }
}
