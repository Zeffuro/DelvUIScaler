(function (root) {
    const fonts = typeof module !== 'undefined' ? require('./fonts.js') : root.PreviewFonts
    const state = typeof module !== 'undefined' ? require('./state.js') : root.PreviewState
    const anchors = [[.5, .5], [0, .5], [1, .5], [.5, 0], [0, 0], [1, 0], [.5, 1], [0, 1], [1, 1]]
    const typeName = obj => String(obj?.$type || '').split(',')[0].split('.').pop()
    const friendly = name => String(name).replace(/Config$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
    const vec = value => ({ x: Number(value?.X) || 0, y: Number(value?.Y) || 0 })
    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
    const anchor = value => anchors[value] || anchors[0]
    const topLeft = (point, size, value) => ({ x: point.x - size.x * anchor(value)[0], y: point.y - size.y * anchor(value)[1] })
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
    function color(value, fallback) {
        const v = value?.Vector || value
        if (![v?.X, v?.Y, v?.Z, v?.W].every(Number.isFinite)) return fallback
        return `rgba(${[v.X, v.Y, v.Z].map(n => Math.round(clamp(n, 0, 1) * 255)).join(',')},${clamp(v.W, 0, 1)})`
    }
    function sampleText(format, options, sampleName, actorKind = 'player') {
        const name = sampleName || options.dummyName
        const words = String(name).split(/\s+/)
        const health = Math.round(options.hpPercent * 1000)
        const groups = String(format).replace(/\{(player|npc)=([^{}]*)\}/g, (_, kind, text) => kind === actorKind ? text : '')
        return groups.replace(/\[([^\]]+)\]/g, (match, tag) => {
            const [field, style = ''] = tag.toLowerCase().split(':')
            if (/^(name|player_name|npc_name)$/.test(field)) {
                if (field === 'player_name' && actorKind !== 'player' || field === 'npc_name' && actorKind !== 'npc') return ''
                if (style === 'first') return words[0]
                if (style === 'last') return words.at(-1)
                if (style === 'initials') return words.map(word => word[0] + '.').join(' ')
                if (style === 'abbreviate') return words[0] + ' ' + (words.at(-1)?.[0] || '') + '.'
                return name
            }
            if (field === 'health' || field === 'mana' || field === 'exp') {
                const current = field === 'health' ? health : field === 'mana' ? 7200 : 7200000
                const max = field === 'health' ? 100000 : field === 'mana' ? 10000 : 10000000
                let value = style.includes('max') || style.includes('required') ? max : style.includes('deficit') ? current - max : current
                if (style.includes('required-to-level')) value = max - current
                if (style.includes('rested')) value = 500000
                if (style.includes('percent-hidden') && (current === 0 || current === max)) return ''
                if (style.includes('percent') && !(style === 'current-percent-short' && current === max)) {
                    const percent = current / max * 100
                    return style.includes('decimal') ? percent.toFixed(1) : String(Math.round(percent))
                }
                if (style.includes('short') && Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'm'
                if (style.includes('short')) return (value / 1000).toFixed(1) + 'k'
                if (style.includes('formatted')) return value.toLocaleString('en-US')
                return String(value)
            }
            if (field === 'job') return friendly((options.job || 'Paladin').replace(/Config$/, ''))
            if (field === 'level') return String(options.level ?? 100)
            if (field === 'title') return actorKind === 'player' ? 'The Liberator' : ''
            if (field === 'value' || field === 'duration' || field.includes('time') || field.includes('cooldown')) return '12'
            if (field.includes('stack') || field.includes('charge')) return '3'
            if (field === 'max') return '30'
            if (field === 'current') return '12'
            if (field === 'percent') return String(options.hpPercent)
            return match
        })
    }
    function create(profile, width, height, inputOptions) {
        const options = { showStatuses: true, statusCount: 8, hpPercent: 72, partyCount: 8, enemyCount: 3,
            dummyName: 'Alex Rivers', dummyTarget: 'Training Dummy', ...inputOptions }
        const scene = { width, height, options, center: { x: width / 2, y: height / 2 }, elements: [], skipped: [] }
        const resolveFont = fonts.createResolver(profile)
        scene.util = { typeName, friendly, vec, add, anchor, topLeft, color, clamp, sampleText }
        scene.labelGeometry = (config, parent, cd = false, text = '') => {
            const font = resolveFont(config, cd), fontSize = Math.max(.1, font.fontSize)
            const family = options.fontFamily ? options.fontFamily(font.family) : font.family
            const textWidth = options.measureText ? options.measureText(text, fontSize, family) : text.length * fontSize * .6
            const parentAnchor = anchor(cd ? config.ParentAnchor : config.FrameAnchor)
            const position = add(add({ x: parent.x, y: parent.y }, vec(config.Position)), { x: parent.width * parentAnchor[0], y: parent.height * parentAnchor[1] })
            const size = { x: textWidth, y: fontSize }
            return { point: topLeft(position, size, cd ? config.TextAlign : config.TextAnchor), size, font, fontFamily: family }
        }
        const ids = new Map()
        scene.emit = (config, point, size, name, kind = 'bar', disabled = false, editPath = null, extra = {}) => {
            disabled ||= config.Enabled === false || !state.visible(config.VisibilityConfig, options, profile.kind === 'DelvCD')
            if (disabled && !options.showDisabled) return null
            if (size.x <= 0 || size.y <= 0 || ![point.x, point.y, size.x, size.y].every(Number.isFinite)) {
                scene.skipped.push(`${name}: no drawable size`)
                return null
            }
            const key = JSON.stringify(editPath || []) + ':' + (extra.idSuffix || name)
            const occurrence = ids.get(key) || 0
            ids.set(key, occurrence + 1)
            const element = { id: key + ':' + occurrence, name, kind, disabled, editPath,
                x: point.x, y: point.y, width: size.x, height: size.y,
                fill: color(config.FillColor || config.IconColor || config.Color, profile.kind === 'DelvCD' ? '#bd8aff' : '#58b7d5'),
                background: color(config.BackgroundColor, '#18232e'), border: color(config.BorderColor, '#080b10'),
                borderWidth: config.DrawBorder === false || config.ShowBorder === false ? 0 : config.BorderThickness ?? 1,
                direction: profile.kind === 'DelvCD' ? [1, 0, 2, 3][config.Direction ?? 0] : config.FillDirection ?? 1,
                opacity: config.Opacity ?? 1, solid: config.IconOption === 3, noIcon: config.IconOption === 2,
                fillRatio: options.hpPercent / 100, note: '', ...extra }
            scene.elements.push(element)
            return element
        }
        scene.label = (config, parent, name, disabled = false, editPath = null, sampleName = null, cd = false) => {
            if (!config) return null
            disabled ||= config.Enabled === false || config.VisibilityConfig?.AlwaysHide === true
            if (disabled && !options.showDisabled) return null
            const numeric = typeName(config).includes('NumericLabel')
            const format = cd ? config.TextFormat : config.Text ?? (numeric ? '12' : '')
            const actorKind = /^(Enemy List|Target|Focus Target)/.test(name) ? 'npc' : 'player'
            const text = sampleText(format || '', options, sampleName, actorKind)
            if (!text) return null
            const { point, size, font, fontFamily } = scene.labelGeometry(config, parent, cd, text)
            return scene.emit({ Color: cd ? config.TextColor : config.Color, DrawBorder: false },
                point, size, name, 'text', disabled, editPath,
                { text, fontSize: size.y, fontFamily, font, outline: config.ShowOutline ? color(config.OutlineColor, '#000') : null })
        }
        scene.statuses = (config, origin, name, disabled = false, editPath = null, labelPaths = {}) => {
            const size = vec(config.Size), point = add(origin, vec(config.Position)), d = config.Directions || 0
            const area = { ...point }
            if ([2, 3, 6].includes(d)) area.x -= size.x
            if ([1, 3, 4].includes(d)) area.y -= size.y
            if ([4, 5].includes(d)) area.x -= size.x / 2
            if ([6, 7].includes(d)) area.y -= size.y / 2
            scene.emit(config, area, size, name + ' (area)', 'area', disabled, editPath)
            if (!options.showStatuses || disabled && !options.showDisabled) return
            const icon = vec(config.IconConfig?.Size || { X: 32, Y: 32 }), padding = vec(config.IconPadding || { X: 2, Y: 2 })
            if (icon.x <= 0 || icon.y <= 0) return
            const count = Math.min(clamp(Math.floor(options.statusCount), 0, 30), config.Limit >= 0 ? config.Limit : 30)
            let fillRows = config.FillRowsFirst !== false
            if (d === 4 || d === 5) fillRows = true
            if (d === 6 || d === 7) fillRows = false
            let columns = Math.max(1, Math.floor((size.x + padding.x) / Math.max(1, icon.x + padding.x)))
            let rows = Math.max(1, Math.floor((size.y + padding.y) / Math.max(1, icon.y + padding.y)))
            if (size.x < icon.x) { columns = count || 1; rows = 1 }
            else if (size.y < icon.y) { rows = count || 1; columns = 1 }
            const samples = [['Regen', '+', '#3e9975'], ['Shield', '◆', '#547bc0'], ['Sprint', '↑', '#b7a055'], ['Damage up', '✦', '#925ab1'], ['Poison', '●', '#785d9f']]
            for (let i = 0; i < count; i++) {
                const row = fillRows ? Math.floor(i / columns) : i % rows
                const col = fillRows ? i % columns : Math.floor(i / rows)
                const dx = [2, 3, 6].includes(d) ? -1 : 1, dy = [1, 3, 4].includes(d) ? -1 : 1
                let x = point.x + col * (icon.x + padding.x) * dx + (dx === -1 ? -icon.x : 0)
                let y = point.y + row * (icon.y + padding.y) * dy + (dy === -1 ? -icon.y : 0)
                if (d === 4 || d === 5) {
                    const perRow = Math.max(1, Math.floor(size.x / Math.max(1, icon.x + padding.x)))
                    x = point.x - (icon.x + padding.x) * Math.min(perRow, count - perRow * row) / 2 + col * (icon.x + padding.x)
                }
                if (d === 6 || d === 7) {
                    const perCol = Math.max(1, Math.floor(size.y / Math.max(1, icon.y + padding.y)))
                    y = point.y - (icon.y + padding.y) * Math.min(perCol, count - perCol * col) / 2 + row * (icon.y + padding.y)
                }
                const sample = samples[i % samples.length]
                scene.emit(config.IconConfig || {}, { x, y }, icon, `${name} / ${sample[0]} ${i + 1}`, 'icon', disabled, editPath,
                    { fill: sample[2], symbol: sample[1], status: true, note: 'Moves this status list' })
                for (const key of ['DurationLabelConfig', 'StacksLabelConfig']) {
                    const label = config.IconConfig?.[key]
                    if (!label) continue
                    const path = labelPaths[key] || (editPath && [...editPath.slice(0, -1), 'IconConfig', key, 'Position'])
                    const text = key === 'DurationLabelConfig' ? String(Math.max(1, 18 - i)) : String(i % 3 + 1)
                    const drawn = scene.label({ ...label, Text: text }, { x, y, width: icon.x, height: icon.y },
                        `${name} / ${sample[0]} ${i + 1} / ${key === 'DurationLabelConfig' ? 'duration' : 'stacks'}`, disabled, path)
                    if (drawn) drawn.note = 'Shared by every icon in this status list'
                }
            }
        }
        return scene
    }
    const api = { create, typeName, friendly, vec, add, anchor, topLeft, color, sampleText }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewScene = api
})(globalThis)
