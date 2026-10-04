class PreviewInteractions {
    constructor(preview) {
        this.preview = preview
        this.scroll = document.getElementById('screenScroll')
        this.frame = document.getElementById('screenFrame')
        this.svg = preview.svg
        this.drag = null
        this.pan = null
        this.spaceHeld = false
        this.hovered = false
        this.scroll.addEventListener('pointerenter', () => { this.hovered = true })
        this.scroll.addEventListener('pointerleave', () => { this.hovered = false })
        this.scroll.addEventListener('wheel', event => this.wheel(event), { passive: false })
        this.scroll.addEventListener('pointerdown', event => this.start(event))
        this.scroll.addEventListener('pointermove', event => { this.move(event); this.mouse(event) })
        this.scroll.addEventListener('pointerup', () => this.end())
        this.scroll.addEventListener('pointercancel', () => this.end())
        this.scroll.addEventListener('lostpointercapture', () => this.end())
        document.addEventListener('keydown', event => {
            if (this.nudge(event)) return
            if (event.code !== 'Space' || event.target.closest('input, textarea, select, button, [contenteditable]') ||
                !this.hovered && !this.scroll.contains(event.target)) return
            event.preventDefault()
            this.spaceHeld = true
            this.scroll.classList.add('pan-ready')
        })
        document.addEventListener('keyup', event => {
            if (event.code === 'Space') this.releaseSpace()
        })
        window.addEventListener('blur', () => { this.releaseSpace(); this.end() })
        document.getElementById('previewZoom').addEventListener('input', () => this.setZoom(Number(document.getElementById('previewZoom').value)))
        document.getElementById('fitZoom').addEventListener('click', () => this.setZoom(100))
        document.getElementById('editPositions').addEventListener('change', () => { this.end(); preview.render() })
        document.getElementById('moveAxis').addEventListener('change', () => preview.updateInspector())
        document.getElementById('snapSelected').addEventListener('click', () => this.snapSelected())
        for (const id of ['positionX', 'positionY']) document.getElementById(id).addEventListener('change', () => this.enterPosition(id))
        document.getElementById('resetPosition').addEventListener('click', () => {
            if (preview.editor?.reset(preview.selected()?.editPath)) preview.edited()
        })
        document.getElementById('resetAllPositions').addEventListener('click', () => {
            if (preview.editor?.resetAll()) preview.edited()
        })
    }
    setZoom(value, clientX = null, clientY = null) {
        const slider = document.getElementById('previewZoom')
        const next = Math.round(Math.max(Number(slider.min), Math.min(Number(slider.max), value)))
        const rect = this.frame.getBoundingClientRect(), viewport = this.scroll.getBoundingClientRect()
        const x = clientX ?? viewport.left + viewport.width / 2
        const y = clientY ?? viewport.top + viewport.height / 2
        const ratioX = (x - rect.left) / rect.width, ratioY = (y - rect.top) / rect.height
        slider.value = String(next)
        this.frame.style.width = `${next}%`
        document.getElementById('zoomValue').textContent = `${Math.round(next)}%`
        const updated = this.frame.getBoundingClientRect()
        this.scroll.scrollLeft += updated.left + ratioX * updated.width - x
        this.scroll.scrollTop += updated.top + ratioY * updated.height - y
        if (next === 100) { this.scroll.scrollLeft = 0; this.scroll.scrollTop = 0 }
        document.dispatchEvent(new Event('previewzoom'))
    }
    focusSelected() {
        const selected = this.preview.selected()
        if (!selected) return
        this.end()
        const rect = PreviewAlignment.bounds(selected), box = this.svg.viewBox.baseVal
        const current = Number(document.getElementById('previewZoom').value)
        const baseWidth = this.frame.getBoundingClientRect().width * 100 / current
        const unit = baseWidth / box.width
        const zoom = 100 * Math.min((this.scroll.clientWidth - 80) / Math.max(1, rect.width * unit),
            (this.scroll.clientHeight - 80) / Math.max(1, rect.height * unit))
        this.setZoom(zoom)
        this.scroll.scrollLeft = (rect.x + rect.width / 2 - box.x) / box.width * this.frame.clientWidth - this.scroll.clientWidth / 2
        this.scroll.scrollTop = (rect.y + rect.height / 2 - box.y) / box.height * this.frame.clientHeight - this.scroll.clientHeight / 2
        this.scroll.scrollIntoView({ block: 'center' })
        this.scroll.focus({ preventScroll: true })
    }
    wheel(event) {
        event.preventDefault()
        if (this.drag || this.pan) return
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.scroll.clientHeight : 1
        const current = Number(document.getElementById('previewZoom').value)
        this.setZoom(current * Math.exp(-event.deltaY * scale * .0015), event.clientX, event.clientY)
    }
    point(event) {
        const rect = this.svg.getBoundingClientRect(), box = this.svg.viewBox.baseVal
        return { x: box.x + (event.clientX - rect.left) * box.width / rect.width, y: box.y + (event.clientY - rect.top) * box.height / rect.height }
    }
    mouse(event) {
        const preview = this.preview
        if (this.drag || this.pan || this.spaceHeld || !preview.profile?.configs.some(config => PreviewModel.typeName(config) === 'GCDIndicatorConfig' && config.AnchorToMouse)) return
        const point = this.point(event), factor = preview.factor()
        preview.mousePosition = { x: point.x / factor, y: point.y / factor }
        if (this.mouseFrame) return
        this.mouseFrame = requestAnimationFrame(() => {
            this.mouseFrame = null
            if (!preview.motion) preview.beginMotion()
            preview.renderMotion()
        })
    }
    start(event) {
        if (this.mouseFrame) cancelAnimationFrame(this.mouseFrame)
        this.mouseFrame = null
        this.scroll.focus({ preventScroll: true })
        if (event.button === 1 || event.button === 0 && this.spaceHeld) {
            event.preventDefault()
            this.pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
                left: this.scroll.scrollLeft, top: this.scroll.scrollTop }
            this.scroll.setPointerCapture(event.pointerId)
            this.scroll.classList.add('panning')
            return
        }
        if (event.button !== 0) return
        const id = event.target.closest('[data-element]')?.getAttribute('data-element')
        if (!id) return
        const preview = this.preview
        preview.picker.value = id
        const element = preview.selected()
        if (document.getElementById('editPositions').checked && element?.editPath && preview.editor) {
            event.preventDefault()
            preview.beginMotion()
            this.drag = { pointer: event.pointerId, start: this.point(event), path: element.editPath,
                position: preview.editor.position(element.editPath), displayed: preview.positionInView(element.editPath),
                factor: preview.factor(), element: element.snapPoint || { x: element.x, y: element.y }, rect: PreviewAlignment.bounds(element),
                targets: document.getElementById('smartGuides').checked ? preview.alignment.targets(element) : [] }
            preview.editor.beginTransaction()
            this.svg.setPointerCapture(event.pointerId)
            preview.renderMotion()
            preview.updateInspector()
            return
        }
        preview.render()
    }
    move(event) {
        if (this.pan?.pointer === event.pointerId) {
            this.scroll.scrollLeft = this.pan.left + this.pan.x - event.clientX
            this.scroll.scrollTop = this.pan.top + this.pan.y - event.clientY
            return
        }
        const drag = this.drag
        if (!drag || drag.pointer !== event.pointerId) return
        this.pendingMove = { clientX: event.clientX, clientY: event.clientY }
        if (!this.dragFrame) this.dragFrame = requestAnimationFrame(() => this.flushMove())
    }
    flushMove() {
        if (this.dragFrame) cancelAnimationFrame(this.dragFrame)
        this.dragFrame = null
        const event = this.pendingMove, drag = this.drag
        this.pendingMove = null
        if (!event || !drag) return
        const point = this.point(event)
        const axis = document.getElementById('moveAxis').value
        const x = drag.position.X + (point.x - drag.start.x) / drag.factor
        const y = drag.position.Y + (point.y - drag.start.y) / drag.factor
        let position = { X: Math.round(x * 100) / 100, Y: Math.round(y * 100) / 100 }
        if (document.getElementById('snapGrid').checked) {
            position = this.snap({ X: x, Y: y }, { x: drag.element.x + point.x - drag.start.x, y: drag.element.y + point.y - drag.start.y }, axis,
                { X: drag.displayed.X + point.x - drag.start.x, Y: drag.displayed.Y + point.y - drag.start.y })
        }
        position = this.preview.alignment.drag(drag, { x: point.x - drag.start.x, y: point.y - drag.start.y }, position, axis,
            document.getElementById('snapGrid').checked)
        const changed = this.preview.editor.setPosition(drag.path, position.X, position.Y, axis)
        this.preview.renderMotion(drag.path)
        if (changed) document.dispatchEvent(new Event('profileedit'))
    }
    end() {
        if (this.pan) {
            if (this.scroll.hasPointerCapture(this.pan.pointer)) this.scroll.releasePointerCapture(this.pan.pointer)
            this.pan = null
            this.scroll.classList.remove('panning')
        }
        if (!this.drag) return
        this.flushMove()
        const pointer = this.drag.pointer
        this.drag = null
        if (this.svg.hasPointerCapture(pointer)) this.svg.releasePointerCapture(pointer)
        this.preview.editor?.endTransaction()
        this.preview.alignment.guides = []
        this.preview.motion = null
        this.preview.render()
    }
    releaseSpace() {
        this.spaceHeld = false
        this.scroll.classList.remove('pan-ready')
    }
    nudge(event) {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
        const preview = this.preview, element = preview.selected()
        if (!direction || event.ctrlKey || event.metaKey || event.altKey || this.drag || this.pan ||
            !this.scroll.contains(document.activeElement) || !document.getElementById('editPositions').checked || !element?.editPath) return false
        event.preventDefault()
        const axis = document.getElementById('moveAxis').value
        if (axis === 'x' && direction[1] || axis === 'y' && direction[0]) return true
        const multiplier = event.shiftKey ? 10 : 1, factor = preview.factor()
        const grid = document.getElementById('snapGrid').checked ? preview.grid() : { x: 1, y: 1 }
        const current = preview.editor.position(element.editPath), displayed = preview.positionInView(element.editPath)
        const x = direction[0] ? (displayed.X + direction[0] * grid.x * multiplier) / factor : current.X
        const y = direction[1] ? (displayed.Y + direction[1] * grid.y * multiplier) / factor : current.Y
        const changedAxis = axis === 'free' ? direction[0] ? 'x' : 'y' : axis
        const corner = element.snapPoint || element
        const dx = direction[0] * grid.x * multiplier, dy = direction[1] * grid.y * multiplier
        const position = document.getElementById('snapGrid').checked ? this.snap({ X: x, Y: y },
            { x: corner.x + dx, y: corner.y + dy }, changedAxis, { X: displayed.X + dx, Y: displayed.Y + dy }) : { X: x, Y: y }
        if (preview.editor.setPosition(element.editPath, position.X, position.Y, changedAxis)) preview.edited()
        return true
    }
    enterPosition(id) {
        const preview = this.preview, element = preview.selected()
        if (!document.getElementById('editPositions').checked || !element?.editPath) return
        const xInput = document.getElementById('positionX'), yInput = document.getElementById('positionY')
        if (!xInput.value.trim() || !yInput.value.trim()) { preview.updateInspector(); return }
        const factor = preview.factor(), axis = document.getElementById('moveAxis').value
        const current = preview.editor.position(element.editPath)
        const displayed = preview.positionInView(element.editPath)
        const x = id === 'positionX' ? Number(xInput.value) / factor : current.X
        const y = id === 'positionY' ? Number(yInput.value) / factor : current.Y
        const changedAxis = axis === 'free' ? id === 'positionX' ? 'x' : 'y' : axis
        const corner = element.snapPoint || element
        const nextDisplayed = { X: id === 'positionX' ? Number(xInput.value) : displayed.X, Y: id === 'positionY' ? Number(yInput.value) : displayed.Y }
        const point = { x: corner.x + nextDisplayed.X - displayed.X, y: corner.y + nextDisplayed.Y - displayed.Y }
        const position = document.getElementById('snapGrid').checked ? this.snap({ X: x, Y: y }, point, changedAxis, nextDisplayed) : { X: x, Y: y }
        if (preview.editor.setPosition(element.editPath, position.X, position.Y, changedAxis)) preview.edited()
        else preview.updateInspector()
    }
    snap(position, point, axis, displayedPosition) {
        const box = this.svg.viewBox.baseVal
        return PreviewGrid.snap(position, point, this.preview.grid(), { x: box.x + box.width / 2, y: box.y + box.height / 2 }, this.preview.factor(), axis, displayedPosition)
    }
    snapSelected() {
        const preview = this.preview, element = preview.selected()
        if (!document.getElementById('editPositions').checked || !element?.editPath) return
        const axis = document.getElementById('moveAxis').value
        const position = this.snap(preview.editor.position(element.editPath), element.snapPoint || element, axis, preview.positionInView(element.editPath))
        if (preview.editor.setPosition(element.editPath, position.X, position.Y, axis)) preview.edited()
    }
}
