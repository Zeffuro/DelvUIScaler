const test = require('node:test')
const assert = require('node:assert/strict')
const state = require('../../src/preview/state.js')
const model = require('../../src/preview/model.js')
const codec = require('../../src/profile/codec.js')
const fonts = require('../../src/preview/fonts.js')
const trigger = (type, extra = {}) => ({ $type: `DelvCD.Config.${type}, DelvCD`, ...extra })
const options = { state: 'combat', hpPercent: 72, partyCount: 8, level: 100, jobId: 19, cooldown: 12, charges: 3, gauge: 50, dummyName: 'Alex Rivers' }

test('visibility handles combat, duty, job groups and DelvUI show overrides', () => {
    assert.equal(state.visible({ HideOutsideCombat: true }, { ...options, state: 'idle' }), false)
    assert.equal(state.visible({ HideOutsideCombat: true }, options), true)
    assert.equal(state.visible({ HideIfLevel: true, HideIfLevelOp: 2, HideIfLevelValue: 100 }, { ...options, level: 90 }), false)
    assert.equal(state.visible({ ShowForJobTypes: 10 }, { ...options, jobId: 16 }), true)
    assert.equal(state.visible({ ShowForJobTypes: 11 }, { ...options, jobId: 16 }), false)
    assert.equal(state.visible({ Enabled: true, HideOutsideOfCombat: true, ShowInParty: true }, { ...options, state: 'idle' }, false), true)
    assert.equal(state.visible({ HideWhenSheathed: true }, { ...options, state: 'idle' }), false)
})

test('trigger chains preserve AND, OR and XOR and first active source', () => {
    const active = trigger('CooldownTrigger', { Cooldown: true, CooldownOp: 3, CooldownValue: 10 })
    const inactive = trigger('CooldownTrigger', { Cooldown: true, CooldownOp: 2, CooldownValue: 10 })
    assert.equal(state.evaluate({ TriggerOptions: [active, { ...inactive, Condition: 0 }] }, options).active, false)
    assert.equal(state.evaluate({ TriggerOptions: [inactive, { ...active, Condition: 1 }] }, options).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [active, { ...active, Condition: 2 }] }, options).active, false)
    assert.equal(state.evaluate({ TriggerOptions: [active, { ...inactive, Condition: 2 }] }, options).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [] }, options).active, false)
})

test('status presence, source actor absence and character percent conditions change visibility', () => {
    const status = trigger('StatusTrigger', { Duration: true, DurationOp: 3, DurationValue: 10 })
    const character = trigger('CharacterStateTrigger', { Hp: true, HpPercent: true, HpOp: 2, HpValue: 80, TriggerSource: 1 })
    assert.equal(state.evaluate({ TriggerOptions: [status] }, options).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [status] }, { ...options, showStatuses: false }).active, false)
    assert.equal(state.evaluate({ TriggerOptions: [{ ...status, TriggerCondition: 1 }] }, { ...options, showStatuses: false }).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [character] }, options).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [character] }, { ...options, hasTarget: false }).active, false)
    assert.equal(state.evaluate({ TriggerOptions: [character] }, { ...options, hpPercent: 90 }).active, false)
})

test('all 21 job samples preserve data source fields, maxima, and distinct timers', () => {
    assert.equal(state.jobs.length, 21)
    for (const [JobIndex, meta] of state.jobs.entries()) {
        const source = state.data(trigger('JobGaugeTrigger', { JobIndex }), options)
        meta.progress.forEach((field, i) => {
            const maximum = source.maxima[i]
            assert.ok(maximum > 0, `${meta.name} ${field} maximum`)
            const expected = meta.fields[field] === 'int' ? Math.floor(maximum * .5) : maximum * .5
            assert.equal(source.fields[field], expected, `${meta.name} ${field}`)
        })
        meta.conditions.filter(field => typeof field === 'string').forEach(field => assert.ok(Object.hasOwn(source.fields, field), `${meta.name} ${field}`))
    }
    const blackMage = state.data(trigger('JobGaugeTrigger', { JobIndex: 2 }), options)
    assert.equal(blackMage.fields.Enochian, true)
    assert.equal(blackMage.fields.Enochian_Timer, 15)
    assert.equal(blackMage.fields.Max_Polyglot_Stacks, 3)
    assert.equal(blackMage.fields.Element, 'Astral Fire')
    const paladin = trigger('JobGaugeTrigger', { JobIndex: 10, RawData: '1|50|5' })
    assert.equal(state.evaluate({ TriggerOptions: [paladin] }, options).active, true)
    assert.equal(state.evaluate({ TriggerOptions: [paladin] }, { ...options, gauge: 20 }).active, false)
})

function jobCheck(name, index, expected, gauge = 50) {
    const JobIndex = state.jobs.findIndex(meta => meta.name === name), meta = state.jobs[JobIndex]
    const enabled = meta.tests.map((_, i) => Number(i === index)), values = meta.tests.map((_, i) => i === index ? expected : 0)
    const raw = `${enabled.join(',')}|${values.join(',')}|${meta.tests.map(() => 0).join(',')}`
    return state.evaluate({ TriggerOptions: [trigger('JobGaugeTrigger', { JobIndex, RawData: raw })] },
        { ...options, jobId: meta.jobId, gauge })
}

test('Bard song and coda checks agree with displayed song names and stack capacity', () => {
    const bard = jobCheck('Bard', 0, 3)
    assert.equal(bard.active, true)
    assert.equal(state.text('[active_song] [last_active_song]', bard.sources), "The Wanderer's Minute Mage's Ballad")
    assert.equal(bard.source.fields.Max_Repertoire_Stacks, 3)
    assert.equal(jobCheck('Bard', 0, 1).active, false)
    assert.equal(jobCheck('Bard', 1, 1).active, true)
    assert.equal(jobCheck('Bard', 1, 3).active, false)
    assert.equal(jobCheck('Bard', 5, 3).active, true)
    assert.equal(jobCheck('Bard', 5, 1).active, false)
    assert.equal(jobCheck('Bard', 0, 0, 0).active, true)
    assert.equal(state.progress({ ProgressDataSourceFieldIndex: 1 }, jobCheck('Bard', 0, 0, 0).sources, options), 0)
})

test('AST, BLM and PCT enum checks agree with their text labels and inactive state', () => {
    for (const [name, index, expected, field, text] of [
        ['Astrologian', 0, 1, 'card1', 'Balance'], ['Astrologian', 1, 1, 'card2', 'Arrow'],
        ['Astrologian', 2, 1, 'card3', 'Spire'], ['Astrologian', 3, 1, 'crown_card', 'Lord of Crowns'],
        ['BlackMage', 3, 2, 'element', 'Astral Fire'],
        ['Pictomancer', 5, 1, 'creature_motif', 'Pom'], ['Pictomancer', 6, 1, 'creature_canvas', 'Pom'],
        ['Pictomancer', 7, 1, 'creature_portrait', 'Moogle']
    ]) {
        const result = jobCheck(name, index, expected)
        assert.equal(result.active, true, `${name} condition ${index}`)
        assert.equal(state.text(`[${field}]`, result.sources), text)
        assert.equal(jobCheck(name, index, expected + 1).active, false)
        const inactive = jobCheck(name, index, 0, 0)
        assert.equal(inactive.active, true)
        assert.equal(state.text(`[${field}]`, inactive.sources), 'None')
    }
})

test('Dancer step checks follow each distinct step and the completed step count', () => {
    for (const [index, expected] of [[3, 3], [4, 1], [5, 2], [6, 3], [7, 4]]) {
        assert.equal(jobCheck('Dancer', index, expected).active, true)
        assert.equal(jobCheck('Dancer', index, expected === 4 ? 1 : expected + 1).active, false)
        assert.equal(jobCheck('Dancer', index, 0, 0).active, true)
    }
    assert.equal(jobCheck('Dancer', 3, 1, 10).active, true)
    assert.equal(jobCheck('Dancer', 3, 0, 100).active, true)
    assert.equal(jobCheck('Dancer', 3, 3, 100).active, false)
})

test('Red Mage mana comparison reflects equal sampled mana instead of an unrelated active flag', () => {
    const result = jobCheck('RedMage', 3, 0)
    assert.equal(result.source.fields.White_Mana, result.source.fields.Black_Mana)
    assert.equal(result.active, true)
    assert.equal(jobCheck('RedMage', 3, 1).active, false)
    assert.equal(jobCheck('RedMage', 3, 2).active, false)
    assert.equal(jobCheck('RedMage', 3, 0, 0).active, true)
})

test('Summoner summon, attunement and hidden readiness checks use their own values', () => {
    for (const [index, expected, field, text] of [[1, 2, 'next_summon', 'Phoenix'],
        [2, 2, 'active_summon', 'Phoenix'], [7, 1, 'active_attunement', 'Ifrit']]) {
        const result = jobCheck('Summoner', index, expected)
        assert.equal(result.active, true)
        assert.equal(state.text(`[${field}]`, result.sources), text)
        assert.equal(jobCheck('Summoner', index, expected + 1).active, false)
    }
    assert.equal(jobCheck('Summoner', 7, 1).source.fields.Max_Attunement_Stacks, 2)
    for (const [index, expected] of [[4, 0], [5, 1], [6, 1]]) {
        assert.equal(jobCheck('Summoner', index, expected).active, true)
        assert.equal(jobCheck('Summoner', index, 1 - expected).active, false)
        assert.equal(jobCheck('Summoner', index, 0, 0).active, true)
    }
    const inactive = jobCheck('Summoner', 1, 1, 0)
    assert.equal(inactive.active, true)
    assert.equal(state.text('[next_summon] [active_summon] [active_attunement]', inactive.sources), 'Bahamut None None')
    assert.equal(state.progress({ ProgressDataSourceFieldIndex: 3 }, inactive.sources, options), 0)
})

test('every directly exposed job boolean condition tracks its own sampled field', () => {
    for (const meta of state.jobs) {
        meta.types.forEach((kind, index) => {
            if (kind !== 'Boolean' || !meta.tests[index]) return
            assert.equal(jobCheck(meta.name, index, 1).active, true, `${meta.name} ${meta.tests[index]} active`)
            assert.equal(jobCheck(meta.name, index, 0).active, false)
            assert.equal(jobCheck(meta.name, index, 0, 0).active, true)
            assert.equal(jobCheck(meta.name, index, 1, 0).active, false)
        })
    }
})

test('CD lowercase labels use the selected data type and source rounding rules', () => {
    const character = state.data(trigger('CharacterStateTrigger'), options)
    const cooldown = state.data(trigger('CooldownTrigger'), options)
    const item = state.data(trigger('ItemCooldownTrigger'), options)
    assert.equal(state.text('[hp:k.1] [name_first] [level:k] [level.0]', [character]), '72.0K Alex 100 ')
    assert.equal(state.text('[cooldown_timer:t] [cooldown_stacks] [keybind]', [cooldown]), '12 3 1')
    assert.equal(state.text('[item_keybind] [value]', [item]), '1 0')
    assert.equal(state.text('[cooldown_timer.0]', [state.data(trigger('CooldownTrigger'), { ...options, cooldown: 2.5 })], 2), '2')
    assert.equal(state.text('[cooldown_timer:t]', [state.data(trigger('CooldownTrigger'), { ...options, cooldown: 3661 })]), '1:01:01')
})

test('automatic styles and dynamic layout respond to dummy triggers without changing configs', () => {
    const icon = name => ({ $type: 'DelvCD.UIElements.Icon', Name: name, IconStyleConfig: { Position: { X: 0, Y: 0 }, Size: { X: 40, Y: 40 } },
        TriggerConfig: { TriggerOptions: [trigger('CooldownTrigger', { Cooldown: true, CooldownOp: 3, CooldownValue: 10 })] },
        StyleConditions: { Conditions: [{ TriggerDataSourceIndex: 0, Source: 0, Op: 3, Value: 10, Style: { Position: { X: 5, Y: -5 }, Size: { X: 60, Y: 60 } } }] } })
    const second = icon('Second')
    second.TriggerConfig.TriggerOptions[0].CooldownValue = 100
    const profile = { kind: 'DelvCD', configs: [{ $type: 'DelvCD.UIElements.Group', GroupConfig: { Position: { X: 0, Y: 0 }, IsDynamic: true, DynamicOffset: { X: 50, Y: 50 }, DynamicMaxPerRow: 3 },
        ElementList: { UIElements: [icon('First'), second, icon('Third')] } }] }
    const before = structuredClone(profile)
    const scene = model.build(profile, 1920, 1080, { ...options, conditionIndex: -2 })
    const icons = scene.elements.filter(e => e.kind === 'icon')
    assert.equal(icons.length, 2)
    assert.equal(icons[0].width, 60)
    assert.equal(icons[1].x - icons[0].x, 50)
    assert.ok(icons[0].editPath.includes('StyleConditions'))
    assert.equal(model.build(profile, 1920, 1080, { ...options, cooldown: 0 }).elements.length, 0)
    assert.deepEqual(profile, before)
})

test('font registry and references scale once through the actual export codec', () => {
    const profile = { kind: 'DelvUI', configs: [
        { $type: 'DelvUI.Interface.GeneralElements.FontsConfig', Fonts: { Expressway_24: { Name: 'Expressway', Size: 24 }, Custom_16: { Name: 'Custom', Size: 16 } } },
        { $type: 'DelvUI.Interface.GeneralElements.LabelConfig', FontID: 'Custom_16', Position: { X: 3, Y: 4 } },
        { $type: 'DelvUI.Interface.GeneralElements.DefaultFontLabelConfig', FontScale: 1.5 } ] }
    const scaled = codec.scaled(profile, 2)
    assert.equal(scaled.configs[0].Fonts.Expressway_24.Size, 48)
    assert.equal(scaled.configs[0].Fonts.Custom_32.Size, 32)
    assert.equal(scaled.configs[1].FontID, 'Custom_32')
    assert.equal(scaled.configs[2].FontScale, 3)
    assert.equal(fonts.audit(profile, 2, scaled).problems, 0)
    assert.equal(profile.configs[0].Fonts.Custom_16.Size, 16)
})

test('mouse anchored GCD uses pointer coordinates without the global HUD shift', () => {
    const profile = { kind: 'DelvUI', configs: [
        { $type: 'DelvUI.Interface.GeneralElements.HUDOptionsConfig', UseGlobalHudShift: true, HudOffset: { X: 100, Y: 100 } },
        { $type: 'DelvUI.Interface.GeneralElements.GCDIndicatorConfig', AnchorToMouse: true, Anchor: 4, Position: { X: 10, Y: 20 }, Bar: { Size: { X: 80, Y: 10 } } } ] }
    const element = model.build(profile, 1920, 1080, { mousePosition: { x: 200, y: 300 } }).elements[0]
    assert.equal(element.x, 210)
    assert.equal(element.y, 320)
})
