const test = require('node:test')
const assert = require('node:assert/strict')
const grid = require('../../src/ui/grid.js')
const { ProfileEditor } = require('../../src/profile/editor.js')
const codec = require('../../src/profile/codec.js')
const model = require('../../src/preview/model.js')

test('grid spacing accepts separate axes and falls back for invalid input', () => {
    assert.deepEqual(grid.settings('24', '40'), { x: 24, y: 40 })
    for (const value of ['', 0, -10, Infinity, NaN, 1001]) assert.equal(grid.settings(value, 8).x, 20)
})

test('snap follows visible corners with parent offsets instead of rounding relative positions', () => {
    const position = { X: 13, Y: -9 }, point = { x: 677, y: 321 }, origin = { x: 640, y: 360 }
    const snapped = grid.snap(position, point, { x: 20, y: 30 }, origin)
    assert.deepEqual(snapped, { X: 16, Y: 0 })
    assert.deepEqual(position, { X: 13, Y: -9 })
    assert.equal(point.x + snapped.X - position.X, 680)
    assert.equal(point.y + snapped.Y - position.Y, 330)
})

test('scaled snapping converts screen movement to source coordinates and preserves locked axes', () => {
    const position = { X: 13, Y: 12.345 }, point = { x: 677, y: 321 }, origin = { x: 640, y: 360 }
    assert.deepEqual(grid.snap(position, point, { x: 20, y: 30 }, origin, 1.5, 'x'), { X: 15, Y: 12.345 })
    const vertical = grid.snap(position, point, { x: 20, y: 30 }, origin, 1.5, 'y')
    assert.equal(vertical.X, 13)
    assert.ok(Math.abs(vertical.Y - 18.345) < 1e-10)
})

test('snap edits preserve export metadata and reset restores the imported position', () => {
    const path = ['configs', 0, 'Position']
    const profile = { configs: [{ Position: { X: 13, Y: -9, $type: 'Vector2' }, Name: 'Nested label' }] }
    const editor = new ProfileEditor(profile)
    const snapped = grid.snap(editor.position(path), { x: 677, y: 321 }, { x: 20, y: 30 }, { x: 640, y: 360 })
    assert.equal(editor.setPosition(path, snapped.X, snapped.Y), true)
    assert.deepEqual(editor.working.configs[0].Position, { X: 16, Y: 0, $type: 'Vector2' })
    editor.reset(path)
    assert.deepEqual(editor.working, profile)
})

test('scaled whole-number coordinates snap onto the rebuilt grid without integer rounding drift', () => {
    for (const factor of [1.5, .563]) {
        const profile = { kind: 'DelvUI', configs: [{ $type: 'DelvUI.PlayerUnitFrameConfig', Enabled: true,
            Position: { X: 1, Y: 1 }, Size: { X: 40, Y: 20 }, Anchor: 4,
            FillColor: { Vector: { X: 1, Y: 1, Z: 1, W: 1 } } }] }
        const scaled = codec.scaled(profile, factor)
        assert.equal(scaled.configs[0].Position.X, Math.round(factor * 100) / 100)
        const before = model.build(scaled, 1440, 900).elements.find(element => element.kind === 'bar')
        const snapped = grid.snap(profile.configs[0].Position, before, { x: 20, y: 20 }, { x: 720, y: 450 }, factor, 'free', scaled.configs[0].Position)
        profile.configs[0].Position = snapped
        const after = model.build(codec.scaled(profile, factor), 1440, 900).elements.find(element => element.kind === 'bar')
        assert.deepEqual([after.x, after.y], [720, 450])
    }
})
