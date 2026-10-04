const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const { ProfileEditor, getPath } = require('../../src/profile/editor.js')
const codec = require('../../src/profile/codec.js')
const model = require('../../src/preview/model.js')
const demos = require('../../src/examples/profiles.js')
const { sampleText } = require('../../src/preview/scene.js')
const compression = { inflate: bytes => zlib.inflateRawSync(bytes), deflate: text => zlib.deflateRawSync(text) }
const positionPath = ['configs', 0, 'Position']

test('position editing preserves vector metadata, untouched axes and the imported profile', () => {
    const profile = structuredClone(demos.DelvUI)
    profile.configs[0].Position.Extra = { retained: true }
    const editor = new ProfileEditor(profile)
    assert.equal(editor.setPosition(positionPath, 10.5, 80, 'x'), true)
    assert.deepEqual(editor.position(positionPath), { X: 10.5, Y: 330 })
    editor.setPosition(positionPath, -99, 80.25, 'y')
    assert.deepEqual(editor.position(positionPath), { X: 10.5, Y: 80.25 })
    assert.equal(getPath(editor.working, positionPath).$type, profile.configs[0].Position.$type)
    assert.deepEqual(getPath(editor.working, positionPath).Extra, { retained: true })
    assert.equal(profile.configs[0].Position.X, -360)
    assert.equal(editor.changed.size, 1)
    for (const value of [NaN, Infinity]) assert.equal(editor.setPosition(positionPath, value, 2), false)
    assert.equal(editor.reset(positionPath), true)
    assert.deepEqual(editor.working, profile)
})

test('reset all restores moved parents and children including originally missing positions', () => {
    const editor = new ProfileEditor(demos.DelvUI)
    const missing = ['configs', 0, 'LeftLabelConfig', 'NewPosition']
    editor.setPosition(positionPath, 200, -100)
    editor.setPosition(missing, 30, 30)
    editor.setPosition(['configs', 0, 'LeftLabelConfig', 'Position'], 8, 12)
    assert.equal(editor.changed.size, 3)
    assert.equal(editor.resetAll(), true)
    assert.deepEqual(editor.working, demos.DelvUI)
    assert.equal(editor.changed.size, 0)
    editor.setPosition(positionPath, 5, 6)
    editor.setPosition(positionPath, -360, 330)
    assert.equal(editor.changed.size, 0)
    assert.deepEqual(editor.working, demos.DelvUI)
})

test('edited positions survive scaling and export without losing unrendered config', () => {
    for (const profile of Object.values(demos)) {
        const editor = new ProfileEditor(profile)
        const scene = model.build(editor.working, 2560, 1440)
        const path = scene.elements.find(e => e.kind === 'bar' || e.kind === 'icon').editPath
        editor.setPosition(path, -120.5, 234.25)
        const scaled = codec.scaled(editor.working, 1.5)
        const exported = codec.decode(codec.encode(scaled, compression), compression)
        assert.equal(getPath(exported, path).X, -180.75)
        assert.equal(getPath(exported, path).Y, 351.38)
        assert.equal(exported.configs.length, profile.configs.length)
        assert.deepEqual(exported, scaled)
        assert.deepEqual(editor.original, profile)
    }
})

test('dummy names, health and status counts change the scene without changing export data', () => {
    const editor = new ProfileEditor(demos.DelvUI)
    const before = codec.encode(editor.working, compression)
    const scene = model.build(editor.working, 2560, 1440, { dummyName: 'Test Person', hpPercent: 42, statusCount: 3 })
    assert.ok(scene.elements.some(e => e.text === 'Test Person'))
    assert.ok(scene.elements.some(e => e.text === '42.0k | 42%'))
    assert.equal(scene.elements.filter(e => e.status).length, 3)
    assert.equal(scene.elements.find(e => e.name === 'Player Unit Frame').fillRatio, .42)
    assert.equal(codec.encode(editor.working, compression), before)
    assert.equal(model.build(editor.working, 2560, 1440, { showStatuses: false }).elements.filter(e => e.status).length, 0)
})

test('status labels honor visibility and anchors and edit the shared original label position', () => {
    const profile = structuredClone(demos.DelvUI)
    const index = profile.configs.findIndex(c => c.IconConfig)
    const config = profile.configs[index]
    config.IconConfig.StacksLabelConfig.Enabled = false
    const editor = new ProfileEditor(profile)
    let scene = model.build(editor.working, 2560, 1440, { statusCount: 2 })
    const durations = scene.elements.filter(e => e.name.endsWith('/ duration'))
    assert.equal(durations.length, 2)
    assert.equal(scene.elements.filter(e => e.name.endsWith('/ stacks')).length, 0)
    assert.deepEqual(durations[0].editPath, ['configs', index, 'IconConfig', 'DurationLabelConfig', 'Position'])
    const x = durations[0].x, y = durations[0].y
    editor.setPosition(durations[0].editPath, 17, -4)
    scene = model.build(editor.working, 2560, 1440, { statusCount: 2 })
    assert.equal(scene.elements.find(e => e.id === durations[0].id).x, x + 17)
    assert.equal(scene.elements.find(e => e.id === durations[0].id).y, y - 4)
    assert.equal(scene.elements.find(e => e.id === durations[1].id).x, durations[1].x + 17)
    editor.resetAll()
    assert.deepEqual(editor.working, profile)
})

test('CD condition positions and group positions edit different owners', () => {
    const editor = new ProfileEditor(demos.DelvCD)
    const scene = model.build(editor.working, 2560, 1440, { conditionIndex: 0 })
    const icon = scene.elements.find(e => e.kind === 'icon')
    assert.ok(icon.editPath.includes('StyleConditions'))
    const basePath = ['configs', 0, 'ElementList', 'UIElements', 0, 'ElementList', 'UIElements', 0, 'IconStyleConfig', 'Position']
    editor.setPosition(icon.editPath, 12, 20)
    assert.equal(getPath(editor.working, basePath).X, 0)
    const group = scene.elements.find(e => e.kind === 'group' && e.name.includes('Cooldown row'))
    const before = model.build(editor.working, 2560, 1440, { conditionIndex: 0 }).elements.find(e => e.id === icon.id)
    const position = editor.position(group.editPath)
    editor.setPosition(group.editPath, position.X + 50, position.Y - 10)
    const after = model.build(editor.working, 2560, 1440, { conditionIndex: 0 }).elements.find(e => e.id === icon.id)
    assert.equal(after.x - before.x, 50)
    assert.equal(after.y - before.y, -10)
    assert.deepEqual(getPath(editor.working, icon.editPath), { ...getPath(demos.DelvCD, icon.editPath), X: 12, Y: 20 })
})

test('dummy text resolves actor groups, decimal health and experience tags used by the default profile', () => {
    const options = { dummyName: 'Alex Rivers', hpPercent: 42 }
    const format = '{player=[health:current-short]}{npc=[health:current-short] ([health:percent-decimal]%)}'
    assert.equal(sampleText(format, options, 'Alex Rivers', 'player'), '42.0k')
    assert.equal(sampleText(format, options, 'Training Dummy', 'npc'), '42.0k (42.0%)')
    assert.equal(sampleText('[exp:current-short]/[exp:required-short] ([exp:percent]%)', options), '7.2m/10.0m (72%)')
    assert.equal(sampleText('[player_name] [npc_name]', options, 'Training Dummy', 'npc'), ' Training Dummy')
})
