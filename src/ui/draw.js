class PreviewDrawing {
    constructor(svg) { this.svg = svg; this.elements = new Map() }
    node(tag, attrs = {}, text = null, parent = this.svg) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
        for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
        if (text !== null) element.textContent = text
        parent.append(element)
        return element
    }
    background(width, height, grid, spacing, viewport = { x: 0, y: 0, width, height }) {
        this.svg.setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`)
        this.svg.replaceChildren()
        this.elements.clear()
        const defs = this.node('defs')
        const pattern = this.node('pattern', { id: 'grid', x: width / 2, y: height / 2,
            width: spacing.x, height: spacing.y, patternUnits: 'userSpaceOnUse' }, null, defs)
        this.node('path', { d: `M ${spacing.x} 0 L 0 0 0 ${spacing.y}`, fill: 'none', stroke: '#203043', 'stroke-width': 1 }, null, pattern)
        if (grid) this.node('rect', { ...viewport, fill: 'url(#grid)' })
        this.node('path', { d: `M ${width / 2} ${viewport.y} V ${viewport.y + viewport.height} M ${viewport.x} ${height / 2} H ${viewport.x + viewport.width}`, stroke: '#385068', 'stroke-dasharray': '6 8', 'stroke-width': 1, fill: 'none' })
        this.layer = this.node('g', { 'data-scene': '' })
    }
    text(text, x, y, size, parent, attrs = {}) {
        return this.node('text', { x, y, 'font-size': size, 'font-family': 'sans-serif', fill: '#f0f5fb',
            stroke: '#0b1520', 'stroke-width': 2, 'paint-order': 'stroke', 'pointer-events': 'none', ...attrs }, text, parent)
    }
    shape(rect, e, attrs, parent) {
        if (!e.chunkShape) return this.node('rect', { ...rect, ...attrs }, null, parent)
        const diameter = e.chunkDiameter || Math.min(rect.width, rect.height)
        const radius = diameter / 2, cx = rect.x + radius, cy = rect.y + radius
        if (e.chunkShape === 1) return this.node('circle', { cx, cy, r: radius, ...attrs }, null, parent)
        const sides = Math.max(3, Math.min(20, e.polygonSides || 6))
        const points = Array.from({ length: sides }, (_, i) => {
            const angle = i * Math.PI * 2 / sides - Math.PI / 2
            return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
        }).join(' ')
        return this.node('polygon', { points, ...attrs }, null, parent)
    }
    bar(e, parent) {
        const count = Math.max(1, Math.min(50, e.chunks || 1)), horizontal = e.direction < 2
        const reversed = e.direction === 0 || e.direction === 2
        const gap = e.chunkGap || 0, length = horizontal ? e.width : e.height
        const step = Math.max(0, (length - (count - 1) * gap) / count)
        for (let i = 0; i < count; i++) {
            const rect = { x: e.x + (horizontal ? i * (step + gap) : 0), y: e.y + (horizontal ? 0 : i * (step + gap)),
                width: horizontal ? step : e.width, height: horizontal ? e.height : step }
            const fillRatio = Math.max(0, Math.min(1, e.fillRatio * count - (reversed ? count - 1 - i : i)))
            this.shape(rect, e, { fill: e.background }, parent)
            const fill = { ...rect }
            if (horizontal) { fill.width *= fillRatio; if (reversed) fill.x += rect.width - fill.width }
            else { fill.height *= fillRatio; if (reversed) fill.y += rect.height - fill.height }
            const color = count > 1 && fillRatio < 1 && e.incompleteFill ? e.incompleteFill : e.fill
            this.shape(e.chunkShape ? rect : fill, e, { fill: e.chunkShape && fillRatio <= 0 ? e.incompleteFill || e.background : color }, parent)
            this.shape(rect, e, { fill: 'none', stroke: e.border, 'stroke-width': e.borderWidth }, parent)
        }
    }
    icon(e, parent) {
        if (e.noIcon) return
        const rect = { x: e.x, y: e.y, width: e.width, height: e.height }
        this.node('rect', { ...rect, fill: e.fill, rx: e.status ? 3 : 0 }, null, parent)
        if (!e.solid) this.text(e.symbol || e.text || '✦', e.x + e.width / 2, e.y + e.height / 2, Math.min(e.width, e.height) * .42, parent,
            { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'stroke-width': 1 })
        if (e.swipe) {
            const ratio = e.invertSwipe ? 1 - e.fillRatio : e.fillRatio
            this.node('rect', { x: e.x, y: e.y + e.height * (1 - ratio), width: e.width, height: e.height * ratio,
                fill: '#000', opacity: e.swipeOpacity ?? .6, 'pointer-events': 'none' }, null, parent)
        }
        this.node('rect', { ...rect, fill: 'none', stroke: e.border, 'stroke-width': e.borderWidth }, null, parent)
    }
    element(e, selected, options) {
        const group = this.node('g', { 'data-element': e.id, 'data-kind': e.kind, opacity: (e.disabled ? .35 : e.opacity ?? 1) * (options.dim ? .12 : 1),
            'pointer-events': options.interactive === false ? 'none' : 'auto',
            'data-blocked': String(options.interactive === false),
            cursor: options.editing && e.editPath ? 'move' : 'pointer', class: e.desaturate ? 'desaturated' : '' }, null, this.layer)
        this.node('title', {}, `${e.name}, ${Math.round(e.width)} × ${Math.round(e.height)} px`, group)
        const rect = { x: e.x, y: e.y, width: e.width, height: e.height }
        if (e.kind === 'text') {
            this.text(e.text, e.x, e.y, e.fontSize, group, { 'dominant-baseline': 'text-before-edge', fill: e.fill, stroke: e.outline || 'none',
                'font-family': `${JSON.stringify(e.fontFamily || 'sans-serif')}, sans-serif`,
                'stroke-width': e.outline ? 2 : 0, 'pointer-events': 'auto' })
        } else if (e.kind === 'group') {
            if (selected) this.node('rect', { ...rect, fill: '#9cc8ff', 'fill-opacity': .03 }, null, group)
        } else if (e.kind === 'area') {
            this.node('rect', { ...rect, fill: '#61b8ca', 'fill-opacity': .06, stroke: '#61b8ca', 'stroke-opacity': .35, 'stroke-dasharray': '8 5', 'stroke-width': 1 }, null, group)
        } else if (e.kind === 'circle') {
            const thickness = e.circleThickness || e.thickness || 6
            const radius = e.radius ?? (Math.min(e.width, e.height) - thickness) / 2
            const cx = e.x + e.width / 2, cy = e.y + e.height / 2
            this.node('circle', { cx, cy, r: radius, fill: 'none', stroke: e.background, 'stroke-width': thickness }, null, group)
            const circumference = 2 * Math.PI * radius
            this.node('circle', { cx, cy, r: radius, fill: 'none', stroke: e.fill, 'stroke-width': thickness,
                'stroke-dasharray': `${circumference * e.fillRatio} ${circumference}`,
                transform: `rotate(${-90 + (e.startAngle || 0)} ${cx} ${cy})${e.rotateCCW ? ` translate(0 ${cy * 2}) scale(1 -1)` : ''}` }, null, group)
        } else if (e.kind === 'bar') this.bar(e, group)
        else this.icon(e, group)
        if (e.glow) this.node('rect', { ...rect, fill: 'none', stroke: e.glow, 'stroke-width': e.glowWidth, 'stroke-dasharray': '5 3' }, null, group)
        if (selected) this.node('rect', { x: e.x - 3, y: e.y - 3, width: e.width + 6, height: e.height + 6, fill: 'none',
            stroke: '#ffd88c', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, null, group)
        if (selected && e.snapPoint) this.node('circle', { cx: e.snapPoint.x, cy: e.snapPoint.y, r: 4,
            fill: '#ffd88c', 'pointer-events': 'none' }, null, group)
        if (options.names && e.kind !== 'text' && e.kind !== 'group') {
            this.text(e.name, e.x, e.y - 6, options.nameSize, group)
        }
        this.elements.set(e.id, { group, x: e.x, y: e.y, signature: this.signature(e, selected, options) })
        return group
    }
    signature(e, selected, options) {
        const { x, y, offscreen, snapPoint, alignmentRect, ...appearance } = e
        return JSON.stringify([appearance, selected, options, snapPoint && { x: snapPoint.x - x, y: snapPoint.y - y }])
    }
    sync(elements, selected, options) {
        const present = new Set()
        let previous = null
        for (const e of elements) {
            present.add(e.id)
            const state = this.elements.get(e.id), settings = options(e)
            let group = state?.group
            if (!state || state.signature !== this.signature(e, e.id === selected, settings)) {
                group = this.element(e, e.id === selected, settings)
                if (state) state.group.replaceWith(group)
            } else {
                const dx = e.x - state.x, dy = e.y - state.y
                if (dx || dy) group.setAttribute('transform', `translate(${dx} ${dy})`)
                else group.removeAttribute('transform')
            }
            if (group.previousSibling !== previous) this.layer.insertBefore(group, previous ? previous.nextSibling : this.layer.firstChild)
            previous = group
        }
        for (const [id, state] of this.elements) {
            if (present.has(id)) continue
            state.group.remove()
            this.elements.delete(id)
        }
    }
}
