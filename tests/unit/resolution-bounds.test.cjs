const { test } = require('node:test')
const assert = require('node:assert/strict')
const { layout, outside } = require('../../src/ui/resolution-bounds.js')

test('resolution bounds share the native center without changing layout coordinates', () => {
    const bounds = layout(2560, 1440, 16 / 9)
    assert.deepEqual(bounds.viewport, { x: -640, y: -360, width: 3840, height: 2160 })
    assert.deepEqual(bounds.screens.map(({ x, y, width, height }) => ({ x, y, width, height })), [
        { x: 320, y: 180, width: 1920, height: 1080 },
        { x: 0, y: 0, width: 2560, height: 1440 },
        { x: -640, y: -360, width: 3840, height: 2160 }
    ])
    for (const screen of bounds.screens) {
        assert.equal(screen.x + screen.width / 2, 1280)
        assert.equal(screen.y + screen.height / 2, 720)
    }
})

test('1080p, 4K and ultrawide viewports fit all bounds', () => {
    assert.deepEqual(layout(1920, 1080, 16 / 9).viewport, { x: -960, y: -540, width: 3840, height: 2160 })
    assert.deepEqual(layout(3840, 2160, 16 / 9).viewport, { x: 0, y: 0, width: 3840, height: 2160 })
    const wide = layout(3360, 1440, 21 / 9)
    assert.deepEqual(wide.screens.map(screen => screen.width), [2520, 3360, 5040])
    assert.deepEqual(wide.viewport, { x: -840, y: -360, width: 5040, height: 2160 })
    assert.deepEqual(layout(5120, 1440, 32 / 9).screens.map(screen => screen.width), [3840, 5120, 7680])
})

test('outside counts include partial clipping and exclude group containers and rounding noise', () => {
    const screen = { x: 320, y: 180, width: 1920, height: 1080 }
    const element = { kind: 'bar', x: 320, y: 180, width: 1920, height: 1080 }
    assert.equal(outside([element], screen), 0)
    assert.equal(outside([{ ...element, x: 319.995 }], screen), 0)
    assert.equal(outside([{ ...element, x: 319 }, { ...element, y: 181 }, { ...element, kind: 'group', x: 0 }], screen), 2)
})
