const { test } = require('node:test')
const assert = require('node:assert/strict')
const { dimensions, ratio, scaleFactor } = require('../../src/ui/screen-resolutions.js')

test('custom sizes determine their own aspect while presets use the selected ratio', () => {
    assert.deepEqual(dimensions('custom', '2560', '1600', 16 / 9), { width: 2560, height: 1600, aspect: 1.6 })
    assert.deepEqual(dimensions('1440', '', '', 16 / 9), { width: 2560, height: 1440, aspect: 16 / 9 })
    assert.deepEqual(dimensions('1080', 2560, 1600, 16 / 10), { width: 1728, height: 1080, aspect: 1.6 })
    assert.equal(ratio(2560, 1600), '16:10')
    assert.equal(ratio(3440, 1440), '43:18')
})

test('invalid custom dimensions never produce a usable preview or export size', () => {
    for (const value of ['', '0', '-1', '1600.5', '32769', 'NaN', 'Infinity', '9007199254740992']) {
        assert.equal(dimensions('custom', value, '1600', 16 / 9), null)
        assert.equal(dimensions('custom', '2560', value, 16 / 9), null)
    }
    assert.equal(dimensions('custom', '1600', '2560', 16 / 9).aspect, .625)
    assert.equal(dimensions('1440', '', '', Infinity), null)
    assert.equal(dimensions('custom', 32768, 32768, 16 / 9).width, 32768)
})

test('uniform scale modes use the selected screen dimensions and preserve manual factors', () => {
    const source = { width: 2560, height: 1440 }, target = { width: 2560, height: 1600 }
    assert.equal(scaleFactor(source, target), 1600 / 1440)
    assert.equal(scaleFactor(source, target, 'width'), 1)
    assert.equal(scaleFactor(source, target, 'fit'), 1)
    assert.equal(scaleFactor(source, target, 'fill'), 1600 / 1440)
    assert.equal(scaleFactor(target, source, 'fit'), .9)
    assert.equal(scaleFactor(target, source, 'fill'), 1)
    assert.equal(scaleFactor(null, null, 'manual', '1.25'), 1.25)
    assert.equal(scaleFactor(null, target), null)
})
