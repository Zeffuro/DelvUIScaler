class PreviewAlignmentPanel {
    constructor(preview) {
        this.preview = preview
        this.referenceId = ''
        this.guides = []
        const get = id => document.getElementById(id)
        preview.picker.addEventListener('change', () => { get('alignmentNote').textContent = '' })
        get('setReference').addEventListener('click', () => {
            this.referenceId = preview.selected()?.id || ''
            get('alignmentNote').textContent = ''
            preview.render()
        })
        get('clearReference').addEventListener('click', () => {
            this.referenceId = ''
            get('alignmentNote').textContent = ''
            preview.render()
        })
        get('focusView').addEventListener('click', () => preview.interactions.focusSelected())
        get('smartGuides').addEventListener('change', () => { this.guides = []; preview.render() })
        for (const button of document.querySelectorAll('[data-align]')) button.addEventListener('click', () => this.align(button.dataset.align))
    }
    reference() { return this.preview.model.elements.find(element => element.id === this.referenceId) || null }
    targetRect() {
        return this.reference() ? PreviewAlignment.bounds(this.reference()) : { x: 0, y: 0, width: this.preview.model.width, height: this.preview.model.height }
    }
    targets(selected) {
        return PreviewAlignment.targets(this.preview.renderedProfile, this.preview.model, selected, this.preview.options(), this.reference())
    }
    update() {
        const get = id => document.getElementById(id), selected = this.preview.selected(), reference = this.reference()
        if (!reference) this.referenceId = ''
        get('referenceName').textContent = `Reference: ${reference?.name || 'Screen'}`
        get('clearReference').disabled = !reference
        get('setReference').disabled = !selected
        get('focusView').disabled = !selected
        const editable = get('editPositions').checked && selected?.editPath && selected.id !== reference?.id
        const axis = get('moveAxis').value
        for (const button of document.querySelectorAll('[data-align]')) {
            const vertical = ['top', 'centerY', 'bottom', 'mirrorY'].includes(button.dataset.align)
            button.disabled = !editable || axis === 'x' && vertical || axis === 'y' && !vertical
        }
    }
    align(action) {
        const preview = this.preview, selected = preview.selected()
        if (!document.getElementById('editPositions').checked || !selected?.editPath) return
        if (this.reference() && !this.targets(selected).length) {
            document.getElementById('alignmentNote').textContent = 'Reference moves with this element.'
            return
        }
        const delta = PreviewAlignment.align(PreviewAlignment.bounds(selected), this.targetRect(), action)
        const axis = document.getElementById('moveAxis').value, position = preview.editor.position(selected.editPath)
        const displayed = preview.positionInView(selected.editPath), factor = preview.factor()
        const x = delta.dx ? (displayed.X + delta.dx) / factor : position.X
        const y = delta.dy ? (displayed.Y + delta.dy) / factor : position.Y
        document.getElementById('alignmentNote').textContent = ''
        if (preview.editor.setPosition(selected.editPath, x, y, axis)) preview.edited()
    }
    drag(drag, delta, position, axis, grid) {
        this.guides = []
        if (!document.getElementById('smartGuides').checked) return position
        const rect = { ...drag.rect, x: drag.rect.x + delta.x, y: drag.rect.y + delta.y }
        if (grid) {
            rect.x = drag.rect.x + position.X * drag.factor - drag.displayed.X
            rect.y = drag.rect.y + position.Y * drag.factor - drag.displayed.Y
        }
        const tolerance = grid ? .01 : 6 * this.preview.svg.viewBox.baseVal.width / this.preview.svg.getBoundingClientRect().width
        const result = PreviewAlignment.snap(rect, drag.targets, tolerance, axis)
        this.guides = result.guides
        if (!grid) {
            if (result.guides.some(guide => guide.axis === 'x')) position.X = (drag.displayed.X + delta.x + result.dx) / drag.factor
            if (result.guides.some(guide => guide.axis === 'y')) position.Y = (drag.displayed.Y + delta.y + result.dy) / drag.factor
        }
        return position
    }
    draw() {
        for (const node of this.preview.svg.querySelectorAll('[data-reference], [data-guide]')) node.remove()
        const drawing = this.preview.drawing, reference = this.reference(), box = this.preview.svg.viewBox.baseVal
        if (reference) drawing.node('rect', { ...PreviewAlignment.bounds(reference), fill: 'none', stroke: '#89baff',
            'stroke-dasharray': '5 4', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
            'pointer-events': 'none', 'data-reference': reference.id })
        for (const guide of this.guides) drawing.node('line', {
            x1: guide.axis === 'x' ? guide.position : box.x, x2: guide.axis === 'x' ? guide.position : box.x + box.width,
            y1: guide.axis === 'y' ? guide.position : box.y, y2: guide.axis === 'y' ? guide.position : box.y + box.height,
            stroke: '#f08bdf', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-guide': guide.axis
        })
    }
}
