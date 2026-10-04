const test = require('node:test')
const assert = require('node:assert/strict')
const alignment = require('../../src/ui/alignment.js')
const model = require('../../src/preview/model.js')
const rect = (x, y, width = 20, height = 10) => ({ x, y, width, height })
const vector = (X, Y) => ({ X, Y })
const bar = (type, extra = {}) => ({ $type: 'DelvUI.' + type, Enabled: true,
    Position: vector(0, 0), Size: vector(100, 20), Anchor: 4, FillColor: {}, ...extra })
const cdIcon = (name, x) => ({ $type: 'DelvCD.UIElements.Icon', Name: name,
    IconStyleConfig: { Position: vector(x, 0), Size: vector(20, 20) } })
const cdGroup = (name, elements) => ({ $type: 'DelvCD.UIElements.Group', Name: name,
    GroupConfig: { Position: vector(0, 0) }, ElementList: { UIElements: elements } })

test('bounds use the movable nameplate rectangle and focus families include descendants', () => {
    const selected = { ...rect(5, 10, 400, 80), id: 'group', name: 'Nameplate', alignmentRect: rect(20, 30, 100, 20) }
    assert.deepEqual(alignment.bounds(selected), rect(20, 30, 100, 20))
    assert.equal(alignment.related({ id: 'group', name: 'Other' }, selected), true)
    assert.equal(alignment.related({ id: 'health', name: 'Nameplate / health' }, selected), true)
    assert.equal(alignment.related({ id: 'different', name: 'Nameplate other' }, selected), false)
})

test('DelvCD focus includes nested group children without including another group with the same name', () => {
    const profile = { kind: 'DelvCD', configs: [cdGroup('Parent', [cdGroup('Nested', [cdIcon('Child', 0)])]), cdGroup('Parent', [cdIcon('Other', 200)])] }
    const scene = model.build(profile, 1000, 800)
    const selected = scene.elements.find(element => element.name === 'Parent (group)')
    const family = scene.elements.filter(element => alignment.related(element, selected))
    assert.deepEqual(family.map(element => element.name), ['Parent (group)', 'Parent / Nested (group)', 'Parent / Nested / Child'])
})

test('center and mirror actions account for unequal rectangle sizes', () => {
    const selected = rect(10, 20, 30, 10), reference = rect(100, 200, 80, 40)
    assert.deepEqual(alignment.align(selected, reference, 'centerX'), { dx: 115, dy: 0 })
    assert.deepEqual(alignment.align(selected, reference, 'centerY'), { dx: 0, dy: 195 })
    assert.deepEqual(alignment.align(selected, reference, 'mirrorX'), { dx: 230, dy: 0 })
    assert.deepEqual(alignment.align(selected, reference, 'mirrorY'), { dx: 0, dy: 390 })
    for (const [action, expected] of [['left', { dx: 90, dy: 0 }], ['right', { dx: 140, dy: 0 }],
        ['top', { dx: 0, dy: 180 }], ['bottom', { dx: 0, dy: 210 }]]) {
        assert.deepEqual(alignment.align(selected, reference, action), expected)
    }
})

test('snap returns edge guides and respects horizontal and vertical locks', () => {
    const selected = rect(10, 20), reference = rect(32, 33)
    assert.deepEqual(alignment.snap(selected, [reference], 3), {
        dx: 2, dy: 3, guides: [{ axis: 'x', position: 32 }, { axis: 'y', position: 33 }] })
    assert.deepEqual(alignment.snap(selected, [reference], 3, 'x'), { dx: 2, dy: 0, guides: [{ axis: 'x', position: 32 }] })
    assert.deepEqual(alignment.snap(selected, [reference], 3, 'y'), { dx: 0, dy: 3, guides: [{ axis: 'y', position: 33 }] })
})

test('snap chooses the nearest target and center-to-center wins exact ties', () => {
    assert.deepEqual(alignment.snap(rect(10, 20), [rect(12, 22)], 2), {
        dx: 2, dy: 2, guides: [{ axis: 'x', position: 22 }, { axis: 'y', position: 27 }] })
    const result = alignment.snap(rect(10, 20), [rect(14, 40), rect(11, 50)], 4, 'x')
    assert.equal(result.dx, 1)
    assert.deepEqual(result.guides, [{ axis: 'x', position: 21 }])
})

test('snap tolerance is inclusive and does not attract distant or invalid matches', () => {
    const selected = rect(10, 20), reference = rect(12, 22)
    assert.deepEqual(alignment.snap(selected, [reference], 1.999), { dx: 0, dy: 0, guides: [] })
    for (const tolerance of [-1, Infinity, NaN]) {
        assert.deepEqual(alignment.snap(selected, [reference], tolerance), { dx: 0, dy: 0, guides: [] })
    }
    assert.deepEqual(alignment.snap(selected, [selected], .01).guides,
        [{ axis: 'x', position: 20 }, { axis: 'y', position: 25 }])
})

test('target dependency probes exclude differently named anchored frames without mutating the profile', () => {
    const profile = { kind: 'DelvUI', configs: [bar('PlayerUnitFrameConfig'),
        bar('PlayerCastbarConfig', { AnchorToUnitFrame: true, UnitFrameAnchor: 6 }), bar('TargetUnitFrameConfig')] }
    const snapshot = structuredClone(profile), scene = model.build(profile, 1000, 800)
    const selected = scene.elements.find(element => element.name === 'Player Unit Frame')
    const targets = alignment.targets(profile, scene, selected)
    assert.deepEqual(targets.map(element => element.name), ['Screen', 'Target Unit Frame'])
    const cast = scene.elements.find(element => element.name === 'Player Castbar')
    assert.deepEqual(alignment.targets(profile, scene, selected, {}, cast), [])
    assert.deepEqual(alignment.targets(profile, scene, selected, {}, selected), [])
    assert.deepEqual(profile, snapshot)
    assert.deepEqual(scene, model.build(profile, 1000, 800))
})

test('a pinned actor-anchored nameplate descendant stays a valid reference', () => {
    const profile = { kind: 'DelvUI', configs: [bar('EnemyNameplateConfig', {
        BarConfig: bar('HealthConfig'), CastbarConfig: bar('CastConfig', { HealthBarAnchor: 7 }) })] }
    const scene = model.build(profile, 1000, 800)
    const selected = scene.elements.find(element => element.name === 'Enemy Nameplate')
    const reference = scene.elements.find(element => element.name === 'Enemy Nameplate / cast')
    assert.ok(selected && reference)
    assert.deepEqual(alignment.targets(profile, scene, selected, {}, reference),
        [{ ...alignment.bounds(reference), id: reference.id, name: reference.name }])
})

test('a nameplate health reference stays valid when an icon moves the outer group bounds', () => {
    const profile = { kind: 'DelvUI', configs: [bar('EnemyNameplateConfig', {
        BarConfig: bar('HealthConfig'), IconConfig: bar('IconConfig', { Position: vector(-100, 0), PrioritizeHealthBarAnchor: true }) })] }
    const scene = model.build(profile, 1000, 800)
    const selected = scene.elements.find(element => element.name === 'Enemy Nameplate / Icon')
    const reference = scene.elements.find(element => element.name === 'Enemy Nameplate')
    assert.ok(selected && reference.alignmentRect)
    assert.deepEqual(alignment.targets(profile, scene, selected, {}, reference),
        [{ ...alignment.bounds(reference), id: reference.id, name: reference.name }])
})

test('target probes exclude enclosing groups whose bounds follow the edited child', () => {
    const profile = { kind: 'DelvCD', configs: [cdGroup('Parent', [cdIcon('Child', 0), cdIcon('Sibling', 100)]), cdIcon('Other', 200)] }
    const scene = model.build(profile, 1000, 800), selected = scene.elements.find(element => element.name === 'Parent / Child')
    assert.deepEqual(alignment.targets(profile, scene, selected).map(element => element.name), ['Screen', 'Parent / Sibling', 'Other'])
})

test('enclosing DelvCD groups stay excluded when a small probe leaves their bounds unchanged', () => {
    const profile = { kind: 'DelvCD', configs: [cdGroup('Parent', [cdIcon('First', 0), cdIcon('Middle', 50), cdIcon('Last', 100)])] }
    const scene = model.build(profile, 1000, 800), selected = scene.elements.find(element => element.name === 'Parent / Middle')
    const parent = scene.elements.find(element => element.name === 'Parent (group)')
    assert.equal(alignment.targets(profile, scene, selected).some(element => element.name === parent.name), false)
    assert.deepEqual(alignment.targets(profile, scene, selected, {}, parent), [])
})

test('moving a group excludes nested children and preserves unrelated groups', () => {
    const profile = { kind: 'DelvCD', configs: [cdGroup('Parent', [cdGroup('Nested', [cdIcon('Child', 0)])]), cdIcon('Other', 200)] }
    const scene = model.build(profile, 1000, 800), selected = scene.elements.find(element => element.name === 'Parent (group)')
    assert.deepEqual(alignment.targets(profile, scene, selected).map(element => element.name), ['Screen', 'Other'])
})

test('an unavailable probe conservatively excludes GroupConfig owner descendants', () => {
    const path = ['configs', 0, 'GroupConfig', 'Position']
    const selected = { ...rect(0, 0), id: 'parent', name: 'Parent (group)', kind: 'group', editPath: path }
    const children = [{ ...rect(50, 50), id: 'child', name: 'Parent / Child', kind: 'icon',
        editPath: ['configs', 0, 'ElementList', 'UIElements', 0, 'IconStyleConfig', 'Position'] },
        { ...rect(70, 50), id: 'other', name: 'Other', kind: 'bar', editPath: ['configs', 1, 'Position'] }]
    const scene = { width: 100, height: 100, elements: [selected, ...children] }
    assert.deepEqual(alignment.targets(null, scene, selected).map(element => element.name), ['Screen', 'Other'])
})

test('targets filter disabled, text, status and undrawable elements and keep pinned bounds', () => {
    const selected = { ...rect(0, 0), id: 'selected', name: 'Selected', kind: 'bar', editPath: ['missing', 'Position'] }
    const element = { ...rect(10, 10), id: 'other', name: 'Other', kind: 'bar', editPath: ['different', 'Position'] }
    const scene = { width: 100, height: 80, elements: [selected, element,
        { ...element, id: 'disabled', disabled: true }, { ...element, id: 'status', kind: 'icon', status: true },
        { ...element, id: 'text', kind: 'text' }, { ...element, id: 'empty', width: 0 }, { ...element, id: 'readonly', editPath: null }] }
    assert.deepEqual(alignment.targets(null, scene, selected).map(element => element.id), ['screen', 'other'])
    const reference = { ...element, alignmentRect: rect(20, 30, 40, 50) }
    assert.deepEqual(alignment.targets(null, scene, selected, {}, reference), [{ ...rect(20, 30, 40, 50), id: 'other', name: 'Other' }])
})
