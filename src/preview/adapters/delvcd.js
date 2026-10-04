(function (root) {
    const state = typeof module !== 'undefined' ? require('../state.js') : root.PreviewState
    function build(profile, scene) {
        const { vec, add, typeName, friendly, color, clamp } = scene.util
        const { options, center, width, height, elements, skipped } = scene
        function styleFor(c, key, path, sources = []) {
            const condition = Number(options.conditionIndex ?? -1) === -2 ? state.condition(c.StyleConditions?.Conditions, sources) : Number(options.conditionIndex ?? -1)
            const variant = c.StyleConditions?.Conditions?.[condition]?.Style
            return variant ? { style: variant, path: [...path, 'StyleConditions', 'Conditions', condition, 'Style'] } : { style: c[key], path: [...path, key] }
        }
        function label(c, parent, name, disabled, path, sampleName, sources = []) {
            const key = c.LabelStyleConfig ? 'LabelStyleConfig' : 'AuraLabelStyleConfig'
            const result = styleFor(c, key, path, sources)
            const style = { ...result.style, TextFormat: state.text(result.style?.TextFormat || '', sources, result.style?.Rounding) }
            scene.label(style, parent, name, disabled || !state.visible(c.VisibilityConfig, options),
                [...result.path, 'Position'], sampleName, true)
        }
        function dynamicOffset(config, index) {
            const pitch = vec(config.DynamicOffset), max = Math.max(1, config.DynamicMaxPerRow || 1)
            const row = Math.floor(index / max), col = index % max, d = config.DynamicGrowthDir || 0
            const alternate = n => Math.ceil(n / 2) * (n % 2 === 0 ? 1 : -1)
            if (d === 4 || d === 5) return { x: alternate(col) * pitch.x, y: row * pitch.y * (d === 4 ? -1 : 1) }
            if (d === 6 || d === 7) return { x: col * pitch.x * (d === 6 ? -1 : 1), y: alternate(row) * pitch.y }
            return { x: col * pitch.x * (d >= 2 ? -1 : 1), y: row * pitch.y * (d % 2 ? -1 : 1) }
        }
        function visit(c, origin, namePath, path, inheritedDisabled = false, inheritedSources = []) {
            const type = typeName(c), name = c.Name || friendly(type), displayName = namePath ? `${namePath} / ${name}` : name
            const result = c.TriggerConfig ? state.evaluate(c.TriggerConfig, options) : { sources: inheritedSources, active: true }
            const disabled = inheritedDisabled || !state.visible(c.VisibilityConfig, options) ||
                (options.state && options.state !== 'layout' && !result.active)
            if (disabled && !options.showDisabled) return false
            const listKey = c.ElementList ? 'ElementList' : 'AuraList', list = c[listKey]
            if (c.UIElements || c.Auras) {
                const key = c.UIElements ? 'UIElements' : 'Auras'
                c[key].forEach((child, i) => visit(child, origin, namePath, [...path, key, i], disabled, result.sources))
                return true
            }
            if (c.GroupConfig && list) {
                const base = add(origin, vec(c.GroupConfig.Position)), start = elements.length
                const key = list.UIElements ? 'UIElements' : 'Auras'
                let index = 0
                for (const [i, child] of (list[key] || []).entries()) {
                    const offset = c.GroupConfig.IsDynamic && !['DelvCDConfig', 'XIVAurasConfig'].includes(type) ? dynamicOffset(c.GroupConfig, index) : vec(null)
                    if (visit(child, add(base, offset), displayName, [...path, listKey, key, i], disabled, result.sources)) index++
                }
                const children = elements.slice(start)
                if (children.length) {
                    const x = Math.min(...children.map(e => e.x)), y = Math.min(...children.map(e => e.y))
                    const size = { x: Math.max(...children.map(e => e.x + e.width)) - x, y: Math.max(...children.map(e => e.y + e.height)) - y }
                    const group = scene.emit({}, { x, y }, size, displayName + ' (group)', 'group', disabled, [...path, 'GroupConfig', 'Position'], { note: 'Moves this group and its children' })
                    elements.pop()
                    if (group) elements.splice(start, 0, group)
                }
                return index > 0
            }
            const key = ['BarStyleConfig', 'AuraBarStyleConfig', 'IconStyleConfig', 'AuraIconStyleConfig'].find(key => c[key])
            if (key) {
                const { style, path: stylePath } = styleFor(c, key, path, result.sources)
                const bar = key.includes('Bar'), point = add(origin, vec(style.Position)), size = vec(style.Size)
                const data = result.source?.fields || c.TriggerConfig?.TriggerOptions?.flatMap(option => option.TriggerData || []).find(data => data.Name)
                const sampleName = data?.Name || c.Name || options.dummyName
                const iconText = String(sampleName).split(/\s+/).slice(0, 2).map(word => word[0]).join('')
                const ratio = state.progress(style, result.sources, options)
                const source = result.sources[style.ProgressDataSourceIndex || 0]
                const maxStacks = source?.maxima[style.ProgressDataSourceFieldIndex || 0]
                scene.emit(style, point, size, displayName, bar ? 'bar' : 'icon', disabled, [...stylePath, 'Position'], {
                    symbol: iconText, fillRatio: style.InvertValues && (!bar || ratio > 0) ? 1 - ratio : ratio,
                    chunks: bar && style.Chunked ? clamp(style.ChunkedStacksFromTrigger && maxStacks > 0 ? maxStacks : style.ChunkCount || 5, 1, 50) : 1,
                    chunkGap: style.ChunkPadding || 0, chunkShape: style.ChunkStylesIndex || 0,
                    chunkDiameter: style.Radius || 0, polygonSides: style.NgonSides || 6,
                    incompleteFill: color(style.IncompleteChunkColor, '#69717c'),
                    swipe: !bar && style.ShowProgressSwipe !== false && style.IconOption !== 2,
                    swipeOpacity: style.ProgressSwipeOpacity ?? .6, invertSwipe: style.InvertSwipe,
                    glow: style.Glow ? color(style.GlowColor, '#e5a54d') : null,
                    glowWidth: style.GlowThickness || 2, desaturate: style.DesaturateIcon
                })
                for (const [i, child] of (c.LabelListConfig?.Labels || []).entries()) {
                    label(child, { x: point.x, y: point.y, width: size.x, height: size.y }, `${displayName} / label ${i + 1}`, disabled,
                        [...path, 'LabelListConfig', 'Labels', i], sampleName, result.sources)
                }
                return true
            }
            if (c.LabelStyleConfig || c.AuraLabelStyleConfig) {
                label(c, { x: 0, y: 0, width, height }, displayName, disabled, path, options.dummyName, result.sources)
                return true
            }
            skipped.push(`${displayName}: unsupported element`)
            return false
        }
        profile.configs.forEach((c, i) => visit(c, center, '', ['configs', i]))
    }
    if (typeof module !== 'undefined') module.exports = { build }
    else root.DelvCDPreview = { build }
})(globalThis)
