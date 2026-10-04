(function (root) {
    const sizes = [
        { height: 1080, name: '1080p', color: '#69dbb8' },
        { height: 1440, name: '1440p', color: '#f4cb88' },
        { height: 2160, name: '2160p / 4K', color: '#ba9cff' }
    ]
    function layout(width, height, aspect) {
        const screens = sizes.map(size => {
            const screenWidth = Math.round(size.height * aspect)
            return { ...size, width: screenWidth, x: (width - screenWidth) / 2, y: (height - size.height) / 2 }
        })
        const viewportWidth = Math.max(width, ...screens.map(screen => screen.width))
        const viewportHeight = Math.max(height, ...screens.map(screen => screen.height))
        return { screens, viewport: { x: (width - viewportWidth) / 2, y: (height - viewportHeight) / 2,
            width: viewportWidth, height: viewportHeight } }
    }
    function outside(elements, screen) {
        return elements.filter(element => element.kind !== 'group' &&
            (element.x < screen.x - .01 || element.y < screen.y - .01 ||
                element.x + element.width > screen.x + screen.width + .01 ||
                element.y + element.height > screen.y + screen.height + .01)).length
    }
    class ResolutionBounds {
        constructor(preview) {
            this.preview = preview
            document.getElementById('showResolutions').addEventListener('change', () => {
                preview.interactions.end()
                preview.render()
                preview.interactions.setZoom(100)
            })
        }
        viewport(width, height, aspect) {
            this.active = document.getElementById('showResolutions').checked
            this.height = height
            this.layout = layout(width, height, aspect)
            return this.active ? this.layout.viewport : { x: 0, y: 0, width, height }
        }
        draw() {
            const preview = this.preview, get = id => document.getElementById(id)
            get('resolutionLegend').hidden = !this.active
            if (!this.active) return
            get('resolutionCaption').textContent = (preview.view === 'original' ? 'Source' : 'Scaled') + ' layout · centered screen bounds'
            const legend = get('resolutionSizes')
            legend.replaceChildren()
            const unit = this.layout.viewport.width / Math.max(1, preview.svg.getBoundingClientRect().width)
            const drawing = preview.drawing
            for (const screen of this.layout.screens) {
                const active = this.height === screen.height
                const box = drawing.node('g', { 'pointer-events': 'none', 'data-resolution': screen.height })
                drawing.node('rect', { x: screen.x, y: screen.y, width: screen.width, height: screen.height,
                    fill: 'none', stroke: screen.color, 'stroke-width': active ? 2 : 1,
                    'stroke-dasharray': active ? 'none' : '7 4', 'vector-effect': 'non-scaling-stroke' }, null, box)
                drawing.text(screen.name, screen.x + 8 * unit, screen.y + 17 * unit, 11 * unit, box,
                    { fill: screen.color, stroke: '#090f17', 'stroke-width': 3 * unit })
                const item = document.createElement('span')
                item.style.setProperty('--resolution-color', screen.color)
                const clipped = outside(preview.model.elements, screen)
                item.textContent = `${screen.name} · ${screen.width} × ${screen.height}${clipped ? ` · ${clipped} outside` : ''}`
                item.classList.toggle('resolution-current', active)
                legend.append(item)
            }
        }
    }
    if (typeof module !== 'undefined') module.exports = { layout, outside }
    else root.ResolutionBounds = ResolutionBounds
})(globalThis)
