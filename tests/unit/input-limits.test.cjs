const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const limits = require('../../src/profile/limits.js')

function loadClass(file, name, additions = {}) {
    const elements = new Map()
    const document = { getElementById(id) {
        if (!elements.has(id)) elements.set(id, { addEventListener() {}, files: [], value: '', classList: { add() {}, remove() {} } })
        return elements.get(id)
    }, fonts: { add() {}, delete() {} } }
    const context = vm.createContext({ document, ProfileLimits: limits, ...additions })
    vm.runInContext(fs.readFileSync(require.resolve(file), 'utf8'), context)
    return { Constructor: vm.runInContext(name, context), document }
}

test('oversized profile files clear the source but never read the file', async () => {
    const { Constructor } = loadClass('../../src/ui/profile-files.js', 'ProfileFiles')
    const statuses = []
    let began = 0, reads = 0, loads = 0
    const files = new Constructor({ begin: () => began++, load: () => loads++, status: message => statuses.push(message) })
    await files.open({ name: 'huge.delvui', size: limits.sourceBytes + 1, text() { reads++; return '' } })
    assert.equal(began, 1)
    assert.equal(reads, 0)
    assert.equal(loads, 0)
    assert.match(statuses.at(-1), /8 MiB input limit/)
    assert.equal(files.name, '')
})

test('asynchronous file decode cancellation cannot restore an old filename', async () => {
    const { Constructor } = loadClass('../../src/ui/profile-files.js', 'ProfileFiles')
    let resolveLoad, resolveStarted
    const started = new Promise(resolve => { resolveStarted = resolve })
    const files = new Constructor({ begin() {}, load: () => new Promise(resolve => { resolveLoad = resolve; resolveStarted() }), status() {} })
    const pending = files.open({ name: 'old.delvui', size: 20, text: async () => 'data' })
    await started
    files.cancel()
    resolveLoad(true)
    await pending
    assert.equal(files.name, '')
    files.load = async () => false
    await files.open({ name: 'failed.delvui', size: 20, text: async () => 'bad' })
    assert.equal(files.name, '')
    files.load = async () => true
    await files.open({ name: 'new.delvui', size: 20, text: async () => 'new' })
    assert.equal(files.name, 'new.delvui')
})

function fontPanel(additions = {}) {
    const { Constructor } = loadClass('../../src/ui/font-panel.js', 'PreviewFontPanel', additions)
    const panel = new Constructor({ render() {} })
    panel.groups = [{ row: { source: { family: 'Custom' } } }]
    panel.selected = 0
    panel.compare = () => {}
    return panel
}

test('oversized and unsupported font replacements never read bytes or replace the loaded font', async () => {
    const panel = fontPanel()
    const previous = { face: {}, file: 'existing.ttf' }
    panel.loaded.set('Custom', previous)
    let reads = 0
    await panel.load({ value: '', files: [{ name: 'huge.ttf', size: limits.fontBytes + 1, arrayBuffer() { reads++ } }] })
    assert.match(panel.errors.get('Custom'), /16 MiB limit/)
    assert.equal(panel.loaded.get('Custom'), previous)
    await panel.load({ value: '', files: [{ name: 'script.html', size: 20, arrayBuffer() { reads++ } }] })
    assert.match(panel.errors.get('Custom'), /Choose a TTF/)
    assert.equal(reads, 0)
    assert.equal(panel.loaded.get('Custom'), previous)
})

test('cancelled font reads do not construct or load a stale font face', async () => {
    let constructions = 0, resolveRead
    const panel = fontPanel({ FontFace: class { constructor() { constructions++ } } })
    const pending = panel.load({ value: '', files: [{ name: 'font.ttf', size: 20,
        arrayBuffer: () => new Promise(resolve => { resolveRead = resolve }) }] })
    panel.requests.delete('Custom')
    resolveRead(new ArrayBuffer(20))
    await pending
    assert.equal(constructions, 0)
    assert.equal(panel.loaded.size, 0)
})
