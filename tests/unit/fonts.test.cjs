const test = require('node:test')
const assert = require('node:assert/strict')
const fonts = require('../../src/preview/fonts.js')

const uiProfile = () => ({ kind: 'DelvUI', configs: [
    { $type: 'DelvUI.Interface.GeneralElements.FontsConfig, DelvUI', Fonts: {
        Expressway_24: { Name: 'Expressway', Size: 24 },
        Expressway_20: { Name: 'Expressway', Size: 20 },
        Expressway_16: { Name: 'Expressway', Size: 16 },
        My_Font_2_18: { Name: 'My_Font_2', Size: 18 }
    } },
    { Enabled: true, Label: { FontID: 'My_Font_2_18', Text: 'Alex Rivers' },
        DefaultLabel: { FontID: null }, MissingLabel: { FontID: 'Unavailable_30' } }
] })
const cdProfile = () => ({ kind: 'DelvCD', configs: [{ FontConfig: { Fonts: {
    Typeface_2_21_cnjp_kr: { Name: 'Typeface_2', Size: 21, Chinese: true, Korean: true }
} }, Label: { LabelStyleConfig: { FontID: 3, FontKey: 'Typeface_2_21_cnjp_kr', TextFormat: '[value]' },
    VisibilityConfig: { AlwaysHide: true }, StyleConditions: { Conditions: [
        { Style: { FontID: 0, FontKey: 'Dalamud Font' } }
    ] } }
}] })

test('font key parser preserves numbered families, glyph flags and game identifiers', () => {
    assert.deepEqual(fonts.parseKey('Roboto_2_18_cnjp_kr'), {
        family: 'Roboto_2', size: 18, suffix: '_cnjp_kr', chinese: true, korean: true
    })
    assert.equal(fonts.scaleKey('Roboto_2_18_cnjp_kr', 1.5), 'Roboto_2_27_cnjp_kr')
    assert.equal(fonts.scaleKey('axis-ffxiv_18', 1.5), 'axis-ffxiv_27')
    assert.equal(fonts.scaleKey('Dalamud Font', 1.5), 'Dalamud Font')
    assert.equal(fonts.scaleKey('Broken_18_suffix', 1.5), 'Broken_18_suffix')
    assert.equal(fonts.scaleKey('Tiny_1', .01), 'Tiny_1')
})

test('DelvUI resolution uses registry values and actual default fallback', () => {
    const profile = uiProfile()
    profile.configs[0].Fonts.My_Font_2_18.Size = 22
    const label = fonts.resolve(profile.configs[1].Label, profile)
    assert.equal(label.size, 22)
    assert.equal(label.family, 'My_Font_2')
    assert.equal(label.missingRegistry, false)
    const fallback = fonts.resolve(profile.configs[1].MissingLabel, profile)
    assert.equal(fallback.size, 24)
    assert.equal(fallback.family, 'Expressway')
    assert.equal(fallback.missingRegistry, true)
    assert.equal(fallback.defaultFallback, true)
    assert.equal(fonts.resolve(profile.configs[1].DefaultLabel, profile).size, 24)
})

test('partial profiles infer sizes and expose uncertainty instead of claiming a registry exists', () => {
    const profile = { kind: 'DelvUI', configs: [{ FontID: 'My_Font_2_18' }] }
    const resolved = fonts.resolve(profile.configs[0], profile)
    assert.equal(resolved.size, 18)
    assert.equal(resolved.family, 'My_Font_2')
    assert.equal(resolved.inferred, true)
    assert.equal(resolved.registryKnown, false)
    assert.equal(resolved.missingRegistry, false)
    assert.equal(resolved.approximate, true)
})

test('DelvUI scaling retains protected default IDs and exact custom registry mappings', () => {
    const source = uiProfile()
    const copy = fonts.scaleProfileFonts(structuredClone(source), 1.5)
    assert.equal(copy.configs[0].Fonts.Expressway_24.Size, 36)
    assert.equal(copy.configs[0].Fonts.Expressway_20.Size, 30)
    assert.equal(copy.configs[0].Fonts.My_Font_2_27.Size, 27)
    assert.equal(copy.configs[1].Label.FontID, 'My_Font_2_27')
    assert.equal(fonts.resolve(copy.configs[1].DefaultLabel, copy).size, 36)
    assert.equal(fonts.resolve(copy.configs[1].Label, copy).fontSize, 27)
    assert.equal(source.configs[1].Label.FontID, 'My_Font_2_18')
    assert.equal(source.configs[0].Fonts.Expressway_24.Size, 24)
})

test('DelvCD lookup derives runtime keys from values and leaves numeric FontID alone', () => {
    const source = cdProfile()
    source.configs[0].FontConfig.Fonts.stale = source.configs[0].FontConfig.Fonts.Typeface_2_21_cnjp_kr
    delete source.configs[0].FontConfig.Fonts.Typeface_2_21_cnjp_kr
    const resolved = fonts.resolve(source.configs[0].Label.LabelStyleConfig, source)
    assert.equal(resolved.size, 21)
    assert.equal(resolved.registryKey, 'stale')
    assert.ok(resolved.warnings.some(warning => warning.includes('Registry key differs')))
    const scaled = fonts.scaleProfileFonts(structuredClone(source), 1.5)
    assert.equal(scaled.configs[0].Label.LabelStyleConfig.FontID, 3)
    assert.equal(scaled.configs[0].Label.LabelStyleConfig.FontKey, 'Typeface_2_32_cnjp_kr')
    assert.equal(scaled.configs[0].FontConfig.Fonts.Typeface_2_32_cnjp_kr.Size, 32)
    assert.equal(fonts.resolve(scaled.configs[0].Label.LabelStyleConfig, scaled).fontSize, 32)
})

test('DelvUI system and icon fonts scale runtime FontScale and ignore FontID', () => {
    const profile = { kind: 'DelvUI', configs: [
        { $type: 'DelvUI.Interface.GeneralElements.DefaultFontLabelConfig, DelvUI', FontID: 'Unused_30', FontScale: 1.25 },
        { IconId: 123, FontID: 'Unused_30', FontScale: 1.5 }
    ] }
    const scaled = fonts.scaleProfileFonts(structuredClone(profile), 2)
    assert.equal(scaled.configs[0].FontScale, 2.5)
    assert.equal(scaled.configs[1].FontScale, 3)
    assert.equal(scaled.configs[0].FontID, 'Unused_30')
    assert.equal(fonts.resolve(scaled.configs[0], scaled).fontSize, 40)
    assert.equal(fonts.resolve(scaled.configs[1], scaled).iconFont, true)
    assert.equal(fonts.audit(profile, 2, scaled).problems, 0)
})

test('an explicit ordinary DelvUI label ignores a stray FontScale field', () => {
    const profile = uiProfile()
    const label = { $type: 'DelvUI.Interface.GeneralElements.LabelConfig, DelvUI', FontID: 'My_Font_2_18', FontScale: 3 }
    profile.configs.push(label)
    const resolved = fonts.resolve(label, profile)
    assert.equal(resolved.fontSize, 18)
    assert.equal(resolved.fontScale, 1)
    assert.equal(resolved.systemFont, false)
    const scaled = fonts.scaleProfileFonts(structuredClone(profile), 2)
    assert.equal(scaled.configs.at(-1).FontID, 'My_Font_2_36')
    assert.equal(scaled.configs.at(-1).FontScale, 3)
    assert.equal(fonts.resolve(scaled.configs.at(-1), scaled).fontSize, 36)
})

test('audit includes disabled ancestors and every conditional font with precise paths', () => {
    const profile = cdProfile()
    const audit = fonts.audit(profile, 1.5)
    assert.equal(audit.total, 2)
    assert.equal(audit.disabled, 2)
    assert.equal(audit.conditional, 1)
    const normal = audit.rows.find(row => !row.conditional)
    assert.equal(normal.pathString, 'configs[0].Label.LabelStyleConfig')
    assert.equal(normal.source.fontSize, 21)
    assert.equal(normal.actual.fontSize, 32)
    assert.equal(normal.expectedSize, 31.5)
    assert.equal(normal.rounding, .5)
    assert.equal(normal.problem, false)
    const conditional = audit.rows.find(row => row.conditional)
    assert.equal(conditional.problem, true)
    assert.ok(conditional.warnings.some(warning => warning.includes('expected scaled size')))
})

test('audit detects the actual original failure: changed references with stale registry keys', () => {
    const source = uiProfile()
    const broken = structuredClone(source)
    broken.configs[1].Label.FontID = 'My_Font_2_27'
    broken.configs[0].Fonts.My_Font_2_18.Size = 27
    const row = fonts.audit(source, 1.5, broken).rows.find(item => item.pathString.endsWith('.Label'))
    assert.equal(row.problem, true)
    assert.equal(row.actual.missingRegistry, true)
    assert.equal(row.actual.family, 'Expressway')
    assert.ok(row.warnings.includes('Scaling broke the font registry mapping.'))
})

test('rounding collisions retain all DelvUI lookups and deduplicate equivalent DelvCD handles', () => {
    for (const kind of ['DelvUI', 'DelvCD']) {
        const property = kind === 'DelvUI' ? 'FontID' : 'FontKey'
        const profile = { kind, configs: [{ Fonts: {
            Custom_20: { Name: 'Custom', Size: 20 }, Custom_21: { Name: 'Custom', Size: 21 }
        } }, { [property]: 'Custom_20' }, { [property]: 'Custom_21' }] }
        const scaled = fonts.scaleProfileFonts(structuredClone(profile), .05)
        assert.equal(fonts.resolve(scaled.configs[1], scaled).size, 1)
        assert.equal(fonts.resolve(scaled.configs[2], scaled).size, 1)
        assert.equal(fonts.audit(profile, .05, scaled).problems, 0)
        assert.equal(Object.keys(scaled.configs[0].Fonts).length, kind === 'DelvUI' ? 2 : 1)
    }
})

test('custom entries cannot displace protected DelvUI defaults even when serialized first', () => {
    const profile = { kind: 'DelvUI', configs: [{ Fonts: {
        Expressway_12: { Name: 'Expressway', Size: 12 },
        Expressway_24: { Name: 'Expressway', Size: 24 }
    } }, { FontID: 'Expressway_12' }, { FontID: null }] }
    const scaled = fonts.scaleProfileFonts(structuredClone(profile), 2)
    assert.equal(scaled.configs[0].Fonts.Expressway_24.Size, 48)
    assert.equal(fonts.resolve(scaled.configs[1], scaled).fontSize, 24)
    assert.equal(fonts.resolve(scaled.configs[2], scaled).fontSize, 48)
    assert.equal(fonts.audit(profile, 2, scaled).problems, 0)
})

test('game-font labels are recognized and invalid scaling fails without mutation', () => {
    const profile = { kind: 'DelvUI', configs: [{ FontID: 'jupiter-numeric-ffxiv_24' }] }
    assert.equal(fonts.resolve(profile.configs[0], profile).gameFont, true)
    for (const factor of [0, -1, NaN, Infinity]) assert.throws(() => fonts.scaleProfileFonts(profile, factor), /greater than zero/)
    assert.equal(profile.configs[0].FontID, 'jupiter-numeric-ffxiv_24')
})
