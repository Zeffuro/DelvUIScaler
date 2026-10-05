const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const codec = require('../../src/profile/codec.js')
const fonts = require('../../src/preview/fonts.js')
const compression = { inflate: bytes => zlib.inflateRawSync(bytes), deflate: text => zlib.deflateRawSync(text) }
const dictionaryType = 'System.Collections.Generic.SortedList`2[[System.String, System.Private.CoreLib],[DelvUI.Interface.GeneralElements.FontData, DelvUI]], System.Collections'

function profile(kind = 'DelvUI') {
    return { kind, piped: kind === 'DelvUI', configs: [{
        $type: `${kind}.Interface.GeneralElements.FontsConfig, ${kind}`,
        Fonts: { $type: dictionaryType, $id: 'fonts',
            Expressway_12: { $type: 'DelvUI.Interface.GeneralElements.FontData, DelvUI', Name: 'Expressway', Size: 12 },
            Expressway_24: { $type: 'DelvUI.Interface.GeneralElements.FontData, DelvUI', Name: 'Expressway', Size: 24 },
            Expressway_20: { Name: 'Expressway', Size: 20 },
            Expressway_16: { Name: 'Expressway', Size: 16 },
            Custom_18: { Name: 'Custom', Size: 18 }
        }
    }, kind === 'DelvUI' ? { FontID: 'Expressway_12' } : { FontKey: 'Custom_18' }] }
}

test('DelvUI font metadata precedes dictionary entries in every scaled encoded section', () => {
    const source = profile(), original = structuredClone(source)
    for (const factor of [1, .75, 1.5, 2, .05]) {
        const scaled = codec.scaled(source, factor)
        const exportString = codec.encode(scaled, compression)
        const decoded = codec.decode(exportString, compression)
        const registry = decoded.configs[0].Fonts
        assert.deepEqual(Object.keys(registry).slice(0, 2), ['$type', '$id'])
        assert.equal(registry.$type, dictionaryType)
        assert.equal(registry.$id, 'fonts')
        assert.equal(registry.Expressway_24.$type, 'DelvUI.Interface.GeneralElements.FontData, DelvUI')
        assert.equal(registry.Expressway_24.Size, Math.max(1, Math.round(24 * factor)))
        assert.equal(fonts.resolve(decoded.configs[1], decoded).fontSize, Math.max(1, Math.round(12 * factor)))
        assert.equal(decoded.configs.length, source.configs.length)
    }
    assert.deepEqual(source, original)
})

test('metadata ordering does not displace protected defaults during a scaled key collision', () => {
    const scaled = codec.scaled(profile(), 2)
    const registry = scaled.configs[0].Fonts
    assert.deepEqual(Object.keys(registry).slice(0, 2), ['$type', '$id'])
    assert.equal(registry.Expressway_24.Size, 48)
    assert.equal(fonts.resolve(scaled.configs[1], scaled).fontSize, 24)
    assert.equal(registry.Custom_36.Size, 36)
})

test('DelvCD keeps its dictionary metadata and scales runtime keys', () => {
    const source = profile('DelvCD'), scaled = codec.scaled(source, 1.5)
    assert.deepEqual(Object.keys(scaled.configs[0].Fonts).slice(0, 2), ['$type', '$id'])
    assert.equal(scaled.configs[0].Fonts.$type, dictionaryType)
    assert.equal(scaled.configs[1].FontKey, 'Custom_27')
    assert.equal(scaled.configs[0].Fonts.Custom_27.Size, 27)
})
