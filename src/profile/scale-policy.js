(function (root) {
    const schema = typeof module !== 'undefined' ? require('./scale-schema.js') : root.ProfileScaleSchema
    const fonts = typeof module !== 'undefined' ? require('../preview/fonts.js') : root.PreviewFonts
    const pixels = {
        'DelvUI.Helpers.TooltipBorderConfig': ['Thickness'],
        'DelvUI.Interface.Bars.BarConfig': ['BorderThickness'],
        'DelvUI.Interface.Bars.BarGlowConfig': ['Size'],
        'DelvUI.Interface.Bars.ChunkedBarConfig': ['Padding'],
        'DelvUI.Interface.Bars.ThresholdConfig': ['MarkerSize'],
        'DelvUI.Interface.EnemyList.EnemyListConfig': ['VerticalPadding'],
        'DelvUI.Interface.EnemyList.EnemyListHealthBarColorsConfig': ['TargetBorderThickness'],
        'DelvUI.Interface.GeneralElements.GCDIndicatorConfig': ['CircleRadius', 'CircleThickness'],
        'DelvUI.Interface.GeneralElements.GridConfig': ['GridDivisionsDistance'],
        'DelvUI.Interface.GeneralElements.ShadowConfig': ['Thickness', 'Offset'],
        'DelvUI.Interface.GeneralElements.TankStanceIndicatorConfig': ['Thickess'],
        'DelvUI.Interface.GeneralElements.NameplateBarConfig': ['TargetedBorderThickness'],
        'DelvUI.Interface.Party.PartyFramesColorsConfig': ['InactiveBorderThickness', 'ActiveBorderThickness'],
        'DelvUI.Interface.Party.PartyFramesCooldownListConfig': ['BorderThickness', 'IconActiveBorderThickness'],
        'DelvUI.Interface.Party.PartyFramesWhosTalkingConfig': ['BorderThickness'],
        'DelvUI.Interface.PartyCooldowns.PartyCooldownsBarConfig': ['IconActiveBorderThickness'],
        'DelvUI.Interface.StatusEffects.StatusEffectIconBorderConfig': ['Thickness'],
        'DelvCD.Config.BarStyleConfig': ['BorderThickness', 'ChunkPadding', 'Radius', 'GlowThickness'],
        'DelvCD.Config.IconStyleConfig': ['BorderThickness', 'ProgressLineThickness', 'GlowThickness']
    }
    const aliases = [['XIVAuras', 'DelvCD'], ['AuraList', 'ElementList'], ['AuraGroup', 'Group'],
        ['AuraBar', 'Bar'], ['AuraIcon', 'Icon'], ['AuraLabel', 'Label'], ['Auras', 'UIElements']]
    const cache = new Map()
    const legacyVectors = new Set(['Position', 'Size', 'Offset', 'Padding', 'IconPadding', 'DynamicOffset',
        'SizeWhenTargeted', 'CustomIconPosition', 'CustomIconSize', 'HudOffset', 'TopLeftOffset', 'BottomRightOffset', 'IconSize'])

    function normalize(type) {
        let value = String(type || '').split(',')[0].trim()
        for (const [from, to] of aliases) value = value.replaceAll(from, to)
        return value
    }

    function definition(type) {
        if (cache.has(type)) return cache.get(type)
        const row = Object.hasOwn(schema.types, type) ? schema.types[type] : null
        if (!row) return {}
        const fields = { ...definition(row[0]) }
        for (const [key, fieldType] of Object.entries(row[1])) {
            fields[key] = { type: fieldType, owner: type, pixel: pixels[type]?.includes(key) || false }
        }
        cache.set(type, fields)
        return fields
    }

    function generic(type, inherited) {
        const name = normalize(type)
        if (name.startsWith('DelvCD.Config.StyleConditions`') || name.startsWith('DelvCD.Config.StyleCondition`')) {
            const argument = String(type).match(/\[\[(DelvCD|XIVAuras)\.Config\.(\w+)/)
            return { type: name.split('`')[0], style: argument ? `DelvCD.Config.${argument[2]}` : inherited }
        }
        const match = name.match(/^(StyleConditions|StyleCondition)<(\w+)>$/)
        if (match) return { type: `DelvCD.Config.${match[1]}`, style: `DelvCD.Config.${match[2]}` }
        return { type: name, style: inherited }
    }

    function fieldFor(fields, key, style) {
        const normalized = aliases.reduce((name, [from, to]) => name.replaceAll(from, to), key)
        let field = Object.hasOwn(fields, normalized) ? fields[normalized] : undefined
        if (field && normalized === 'Conditions' && style) field = { type: 'list:DelvCD.Config.StyleCondition' }
        if (field && normalized === 'Style' && style) field = { type: style }
        return field
    }

    function record(audit, kind, path) {
        if (audit) (audit[kind] ||= []).push(path)
    }

    function visit(obj, factor, audit, context = {}, mutate = true) {
        if (typeof obj === 'number') {
            record(audit, context.type ? 'preserved' : 'unknownNumeric', context.path || '')
            return
        }
        if (!obj || typeof obj !== 'object') return
        const path = context.path || ''
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => visit(item, factor, audit,
                { ...context, type: String(context.type || '').replace(/^list:/, ''), path: `${path}[${index}]` }, mutate))
            return
        }
        let supplied = obj.$type || context.type
        // Collection metadata describes the wrapper; the declared field describes its members.
        if (String(obj.$type || '').startsWith('System.Collections.')) supplied = context.type
        const resolved = generic(supplied, context.style)
        const type = resolved.type
        const fields = definition(type)
        const isColor = type === 'System.Numerics.Vector4' || type === 'Vector4' ||
            (typeof obj.Z === 'number' && typeof obj.W === 'number')
        const isVector = type === 'System.Numerics.Vector2' || type === 'Vector2' ||
            (!obj.$type && (context.geometry || !context.path) && !('Z' in obj) && !('W' in obj) &&
                typeof obj.X === 'number' && typeof obj.Y === 'number')
        const mapped = String(context.type || '').startsWith('map:')
        for (const key of Object.keys(obj)) {
            const value = obj[key]
            const childPath = path ? `${path}.${key}` : key
            const field = fieldFor(fields, key, resolved.style)
            if (typeof value === 'number') {
                if (key === 'FontScale' || key === 'Size' && fonts.fontData(obj)) continue
                const shieldHeight = field?.owner === 'DelvUI.Interface.GeneralElements.ShieldConfig' && key === 'Height'
                const pixel = !isColor && (isVector && ['X', 'Y'].includes(key) || field?.pixel || shieldHeight && obj.HeightInPixels === true)
                const known = isColor || isVector && ['X', 'Y'].includes(key) || field || mapped || ['FontID', 'FontScale'].includes(key)
                record(audit, pixel ? 'scaled' : known ? 'preserved' : 'unknownNumeric', childPath)
                if (pixel && mutate) {
                    const scaled = value * factor
                    const integer = field && /^(?:s?byte|u?short|u?int|u?long)$/.test(field.type)
                    obj[key] = integer ? Math.round(scaled) : Math.round(scaled * 100) / 100
                }
            } else if (value && typeof value === 'object') {
                const childType = mapped ? String(context.type).slice(4) : key === '$values' ? context.type : field?.type
                visit(value, factor, audit, { type: childType, style: resolved.style, path: childPath,
                    geometry: legacyVectors.has(key) }, mutate)
            }
        }
    }

    function scaleRecursive(obj, factor, audit, context) { visit(obj, factor, audit, context) }

    function inspect(profile, factor = 1) {
        const audit = { scaled: [], preserved: [], unknownNumeric: [] }
        profile.configs.forEach((config, index) => visit(config, factor, audit, { path: `configs[${index}]` }, false))
        return audit
    }

    function contextAt(profile, path) {
        let value = profile, context = { path: '' }
        for (const key of path) {
            if (Array.isArray(value)) {
                context = { ...context, type: String(context.type || '').replace(/^list:/, ''), path: `${context.path}[${key}]` }
            } else {
                let supplied = value?.$type || context.type
                if (String(value?.$type || '').startsWith('System.Collections.')) supplied = context.type
                const resolved = generic(supplied, context.style), fields = definition(resolved.type)
                const field = fieldFor(fields, key, resolved.style), mapped = String(context.type || '').startsWith('map:')
                const type = mapped ? String(context.type).slice(4) : key === '$values' ? context.type : field?.type
                context = { type, style: resolved.style, path: context.path ? `${context.path}.${key}` : String(key), geometry: legacyVectors.has(key) }
            }
            value = value?.[key]
        }
        return context
    }

    const api = { scaleRecursive, inspect, audit: inspect, contextAt, pixels, definition, revisions: schema.revisions }
    if (typeof module !== 'undefined') module.exports = api
    else root.ProfileScalePolicy = api
})(globalThis)
