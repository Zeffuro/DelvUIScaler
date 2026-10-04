const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalize } = require('../../src/ui/preferences.js')

test('preview preferences validate values and discard profile data', () => {
    const saved = normalize({ showGrid: false, showNames: 'true', snapGrid: true, showResolutions: true, gridX: '32.5', gridY: 0,
        previewZoom: 2000, moveAxis: 'y', focusMode: 'only', aspectRatio: '2.3333333333333335',
        inputStr: 'private profile', manualScale: '5', editPositions: true, dummyName: 'Private name' })
    assert.equal(saved.showGrid, false)
    assert.equal(saved.showNames, false)
    assert.equal(saved.snapGrid, true)
    assert.equal(saved.showResolutions, true)
    assert.equal(saved.gridX, 32.5)
    assert.equal(saved.gridY, 20)
    assert.equal(saved.previewZoom, 800)
    assert.equal(saved.moveAxis, 'y')
    assert.equal(saved.focusMode, 'only')
    assert.equal(saved.aspectRatio, '2.3333333333333335')
    for (const key of ['inputStr', 'manualScale', 'editPositions', 'dummyName']) assert.equal(Object.hasOwn(saved, key), false)
})

test('bad and missing preferences use usable defaults', () => {
    for (const value of [null, undefined, 'broken', [], { gridX: Infinity, gridY: -10, previewZoom: 'broken', moveAxis: 'z' }]) {
        assert.deepEqual(normalize(value), normalize())
    }
    assert.equal(normalize({ previewZoom: -1 }).previewZoom, 100)
    assert.equal(normalize({ previewZoom: 200.6 }).previewZoom, 201)
})
