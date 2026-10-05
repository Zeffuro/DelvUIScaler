(function (root) {
    const uiDefaults = new Set(['Expressway_24', 'Expressway_20', 'Expressway_16'])
    const gameFonts = new Set(['axis-ffxiv', 'jupiter-ffxiv', 'jupiter-numeric-ffxiv',
        'meidinger-ffxiv', 'meidinger-numberic-ffxiv', 'trumpgothic-ffxiv'])
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
    const fontData = value => value && typeof value === 'object' && typeof value.Name === 'string' && Number.isFinite(value.Size)
    const typeName = value => String(value?.$type || '').split(',')[0].split('.').pop()
    const isCD = (profile, cd) => cd ?? profile.kind === 'DelvCD'
    const roundSize = (size, factor) => Math.max(1, Math.round(size * factor))

    function parseKey(key) {
        if (typeof key !== 'string') return null
        const match = key.match(/^(.+)_(\d+)((?:_cnjp)?(?:_kr)?)$/)
        return match ? { family: match[1], size: Number(match[2]), suffix: match[3],
            chinese: match[3].includes('_cnjp'), korean: match[3].includes('_kr') } : null
    }
    function scaleKey(key, factor) {
        const parsed = parseKey(key)
        return parsed ? `${parsed.family}_${roundSize(parsed.size, factor)}${parsed.suffix}` : key
    }
    function runtimeKey(data) {
        return `${data.Name}_${data.Size}${data.Chinese ? '_cnjp' : ''}${data.Korean ? '_kr' : ''}`
    }
    function walk(value, path, visit, disabled = false, conditional = false) {
        if (!value || typeof value !== 'object') return
        disabled ||= value.Enabled === false || value.VisibilityConfig?.AlwaysHide === true
        conditional ||= path.includes('StyleConditions')
        visit(value, path, disabled, conditional)
        for (const [key, child] of Object.entries(value)) {
            if (child && typeof child === 'object') walk(child, [...path, Array.isArray(value) ? Number(key) : key], visit, disabled, conditional)
        }
    }
    function registries(profile) {
        const result = []
        walk(profile.configs || [], ['configs'], (value, path) => {
            if (!value.Fonts || typeof value.Fonts !== 'object' || Array.isArray(value.Fonts)) return
            if (/^Fonts?Config$/.test(typeName(value)) || /Fonts?Config$/.test(String(path.at(-1))) ||
                Object.values(value.Fonts).some(fontData)) result.push({ value, path })
        })
        return result
    }
    function registryEntries(profile, cd) {
        const result = []
        for (const registry of registries(profile)) {
            for (const [key, data] of Object.entries(registry.value.Fonts)) {
                if (!fontData(data)) continue
                result.push({ key, data, runtimeKey: isCD(profile, cd) ? runtimeKey(data) : key,
                    path: [...registry.path, 'Fonts', key] })
            }
        }
        return result
    }
    function specialFont(config, cd) {
        if (cd) return null
        const type = typeName(config)
        if (type.includes('IconLabel') || !type && own(config, 'IconId')) return 'icon'
        if (type.includes('DefaultFontLabel') || !type && own(config, 'FontScale')) return 'system'
        return null
    }
    function resolve(config, profile, cd, context) {
        cd = isCD(profile, cd)
        const key = cd ? config.FontKey ?? 'big-noodle-too_24' : config.FontID ?? null
        const special = specialFont(config, cd)
        const entries = context?.entries || registryEntries(profile, cd)
        const registryKnown = context?.registryKnown ?? registries(profile).length > 0
        const entry = special ? null : entries.find(item => item.runtimeKey === key)
        const parsed = parseKey(key)
        const missingRegistry = !special && !!key && key !== 'Dalamud Font' && registryKnown && !entry
        const defaultFallback = !!special || !key || key === 'Dalamud Font' || missingRegistry
        const fallback = !cd && !special ? entries.find(item => item.key === 'Expressway_24') : null
        const fontScale = special && Number.isFinite(config.FontScale) ? config.FontScale : 1
        const inferred = !entry && !defaultFallback
        const family = special === 'icon' ? 'Dalamud icons' : special || cd && defaultFallback ? 'Dalamud default' :
            entry?.data.Name || (defaultFallback ? fallback?.data.Name || 'Expressway' : parsed?.family || String(key))
        const size = entry?.data.Size ?? (defaultFallback ? fallback?.data.Size ?? (cd || special ? 16 : 24) : parsed?.size ?? 20)
        const approximate = inferred || defaultFallback && !fallback
        const warnings = []
        if (missingRegistry) warnings.push('Font reference is absent from the exported registry; runtime uses its current default font.')
        if (inferred) warnings.push('Font definition is not exported; size is inferred from the key and depends on installed fonts.')
        if (defaultFallback && !fallback) warnings.push('Default font metrics depend on Dalamud and local plugin settings; preview size is estimated.')
        if (entry && cd && entry.key !== entry.runtimeKey) warnings.push('Registry key differs from the key DelvCD builds from Name, Size and glyph flags.')
        if (gameFonts.has(family)) warnings.push('Game font appearance requires game assets; browser metrics are approximate.')
        if (cd && parsed?.family.includes('_') && !entry) warnings.push('DelvCD label import splits font names at underscores; automatic font creation may fail for this family.')
        if (!cd && !special && own(config, 'FontScale')) warnings.push('FontScale has no effect on ordinary DelvUI labels.')
        if (!(size > 0) || !(fontScale > 0)) warnings.push('Font size or scale is zero or negative.')
        return { key, family, size, fontScale, fontSize: size * fontScale, defaultFallback, missingRegistry,
            registryKnown, registryKey: entry?.key ?? null, runtimeKey: entry?.runtimeKey ?? key,
            gameFont: gameFonts.has(family), systemFont: special === 'system', iconFont: special === 'icon',
            inferred, approximate, warnings }
    }
    function createResolver(profile) {
        const contexts = new Map()
        const registryKnown = registries(profile).length > 0
        return (config, cd) => {
            cd = isCD(profile, cd)
            if (!contexts.has(cd)) contexts.set(cd, { entries: registryEntries(profile, cd), registryKnown })
            return resolve(config, profile, cd, contexts.get(cd))
        }
    }
    function references(profile) {
        const result = []
        walk(profile.configs || [], ['configs'], (config, path, disabled, conditional) => {
            if (Array.isArray(config) || fontData(config)) return
            const cd = profile.kind === 'DelvCD' || own(config, 'FontKey')
            const property = cd ? 'FontKey' : 'FontID'
            const hasReference = own(config, property) && (typeof config[property] === 'string' || config[property] === null)
            if (!hasReference && !/Label(?:Style)?Config/.test(typeName(config)) && !specialFont(config, cd)) return
            result.push({ config, path, refPath: [...path, property], property, cd, disabled, conditional })
        })
        return result
    }
    function getAt(value, path) { return path.reduce((object, key) => object?.[key], value) }
    function pathString(path) {
        return path.map((key, i) => typeof key === 'number' ? `[${key}]` : `${i ? '.' : ''}${key}`).join('')
    }
    function scaleProfileFonts(profile, factor) {
        if (!Number.isFinite(factor) || factor <= 0) throw new Error('Enter a multiplier greater than zero.')
        const cd = isCD(profile)
        const mapping = new Map()
        for (const registry of registries(profile)) {
            const replacements = Object.create(null)
            const entries = Object.entries(registry.value.Fonts)
            // Newtonsoft reads dictionary metadata only before its entries.
            if (!cd) entries.sort(([a], [b]) => Number(b.startsWith('$')) - Number(a.startsWith('$')) ||
                Number(uiDefaults.has(b)) - Number(uiDefaults.has(a)))
            for (const [oldKey, data] of entries) {
                if (!fontData(data)) { replacements[oldKey] = data; continue }
                const sourceKey = cd ? runtimeKey(data) : oldKey
                data.Size = roundSize(data.Size, factor)
                let newKey = cd ? runtimeKey(data) : uiDefaults.has(oldKey) ? oldKey : scaleKey(oldKey, factor)
                if (own(replacements, newKey) && !cd) {
                    newKey = oldKey
                    while (own(replacements, newKey)) newKey += '_scaled'
                }
                if (!own(replacements, newKey)) replacements[newKey] = data
                mapping.set(sourceKey, newKey)
            }
            registry.value.Fonts = replacements
        }
        for (const reference of references(profile)) {
            if (specialFont(reference.config, reference.cd)) {
                const scale = reference.config.FontScale ?? 1
                reference.config.FontScale = Math.round(scale * factor * 10000) / 10000
            } else if (typeof reference.config[reference.property] === 'string') {
                const key = reference.config[reference.property]
                reference.config[reference.property] = mapping.get(key) ?? scaleKey(key, factor)
            }
        }
        return profile
    }
    function audit(profile, factor, scaledProfile) {
        if (!Number.isFinite(factor) || factor <= 0) throw new Error('Enter a multiplier greater than zero.')
        const exported = scaledProfile || scaleProfileFonts(structuredClone(profile), factor)
        const sourceFont = createResolver(profile), exportedFont = createResolver(exported)
        const rows = references(profile).map(reference => {
            const source = sourceFont(reference.config, reference.cd)
            const scaledConfig = getAt(exported, reference.path)
            const actual = scaledConfig ? exportedFont(scaledConfig, reference.cd) : null
            const expectedSize = source.fontSize * factor
            const expectedExportSize = specialFont(reference.config, reference.cd) ?
                source.size * Math.round(source.fontScale * factor * 10000) / 10000 : roundSize(source.size, factor)
            const warnings = [...source.warnings]
            if (!actual) warnings.push('Label is missing from the scaled export.')
            else {
                for (const warning of actual.warnings) if (!warnings.includes(warning)) warnings.push(warning)
                if (actual.missingRegistry && !source.missingRegistry) warnings.push('Scaling broke the font registry mapping.')
                if (Math.abs(actual.fontSize - expectedExportSize) > .0001) warnings.push('Exported font size differs from the expected scaled size.')
                if (actual.family !== source.family) warnings.push('Scaling changed the resolved font family.')
            }
            const rounding = actual ? actual.fontSize - expectedSize : null
            return { path: reference.path, pathString: pathString(reference.path), refPath: reference.refPath,
                property: reference.property, disabled: reference.disabled, conditional: reference.conditional,
                source, actual, expectedSize, expectedExportSize, rounding, warnings,
                text: reference.config.Text ?? reference.config.TextFormat ?? '',
                problem: !actual || !!actual.missingRegistry || !!source.missingRegistry ||
                    Math.abs((actual?.fontSize ?? 0) - expectedExportSize) > .0001 || actual?.family !== source.family }
        })
        return { rows, total: rows.length, disabled: rows.filter(row => row.disabled).length,
            conditional: rows.filter(row => row.conditional).length, problems: rows.filter(row => row.problem).length,
            warnings: rows.filter(row => row.warnings.length).length, rounded: rows.filter(row => Math.abs(row.rounding || 0) > .0001).length }
    }
    const api = { parseKey, scaleKey, runtimeKey, fontData, registryEntries, resolve, createResolver, references, scaleProfileFonts, audit, pathString }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewFonts = api
})(globalThis)
