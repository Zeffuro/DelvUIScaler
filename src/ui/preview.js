class ProfilePreview {
    constructor() {
        this.editor = null
        this.view = 'original'
        this.model = { elements: [], skipped: [] }
        this.svg = document.getElementById('previewSvg')
        this.picker = document.getElementById('previewElement')
        this.job = document.getElementById('previewJob')
        this.measure = document.createElement('canvas').getContext('2d')
        this.fonts = new PreviewFontPanel(this)
        this.auditPanel = new ScaleAuditPanel()
        const jobs = document.getElementById('dummyJob')
        for (const job of PreviewState.jobs) jobs.add(new Option(PreviewModel.friendly(job.name), String(job.jobId)))
        jobs.value = '19'
        this.drawing = new PreviewDrawing(this.svg)
        this.alignment = new PreviewAlignmentPanel(this)
        this.interactions = new PreviewInteractions(this)
        this.resolutions = new ResolutionBounds(this)
        for (const id of ['showGrid', 'gridX', 'gridY', 'elementSearch', 'focusMode', 'showNames', 'showDisabled', 'previewJob', 'previewElement', 'showStatuses',
            'dummyName', 'dummyTarget', 'dummyHealth', 'dummyStatusCount', 'dummyPartyCount', 'dummyEnemyCount', 'previewStyle',
            'dummyState', 'dummyLevel', 'dummyCooldown', 'dummyCharges', 'dummyGauge', 'dummyPartyState', 'dummyJob', 'dummyHasTarget']) {
            const continuous = id.startsWith('dummy') || id.startsWith('grid') || id === 'elementSearch'
            document.getElementById(id).addEventListener(continuous ? 'input' : 'change', () => continuous ? this.scheduleRender() : this.render())
        }
        for (const view of ['original', 'scaled']) {
            document.getElementById(view === 'original' ? 'viewOriginal' : 'viewScaled').addEventListener('click', () => {
                this.interactions.end()
                this.view = view
                this.render()
            })
        }
        for (const [id, axis] of [['gridX', 'x'], ['gridY', 'y']]) {
            document.getElementById(id).addEventListener('change', event => {
                event.target.value = this.grid()[axis]
                this.render()
            })
        }
    }
    get profile() { return this.editor?.working || null }
    factor() {
        const value = this.view === 'original' ? 1 : Number(document.getElementById('manualScale').value)
        return Number.isFinite(value) && value > 0 ? value : 1
    }
    selected() { return this.model.elements.find(element => element.id === this.picker.value) }
    positionInView(path) {
        const value = path.reduce((object, key) => object?.[key], this.renderedProfile)
        return { X: Number(value?.X) || 0, Y: Number(value?.Y) || 0 }
    }
    grid() { return PreviewGrid.settings(document.getElementById('gridX').value, document.getElementById('gridY').value) }
    scaleSettings() {
        return Object.fromEntries(['baseRes', 'targetRes', 'baseWidth', 'baseHeight', 'targetWidth', 'targetHeight', 'manualScale', 'scaleMode'].map(id => [id, document.getElementById(id).value]))
    }
    scaledProfile() {
        const factor = Number(document.getElementById('manualScale').value)
        if (!this.profile || !Number.isFinite(factor) || factor <= 0) return null
        if (this.scaleCache?.editor !== this.editor || this.scaleCache.revision !== this.editor.revision || this.scaleCache.factor !== factor) {
            const audit = { scaled: [], preserved: [], unknownNumeric: [] }
            this.scaleCache = { editor: this.editor, revision: this.editor.revision, factor, profile: ConfigCodec.scaled(this.profile, factor, audit), audit }
        }
        return this.scaleCache.profile
    }
    scaleAudit() {
        if (!this.scaledProfile()) return null
        this.scaleCache.audit ||= ProfileScalePolicy.inspect(this.profile, this.scaleCache.factor)
        return this.scaleCache.audit
    }
    exportProfile() {
        if (!ScreenResolutions.read('baseRes') || !ScreenResolutions.read('targetRes')) throw new Error('Use whole-pixel sizes from 1 to 32768.')
        const profile = this.scaledProfile()
        if (!profile) throw new Error('Enter a positive multiplier.')
        return profile
    }
    edited() {
        this.render()
        document.dispatchEvent(new Event('profileedit'))
    }
    setProfile(profile) {
        this.interactions.end()
        this.editor = profile ? new ProfileEditor(profile, this.scaleSettings()) : null
        this.scaleCache = null
        this.picker.value = ''
        this.alignment.referenceId = ''
        this.alignment.guides = []
        document.getElementById('elementSearch').value = ''
        document.getElementById('alignmentNote').textContent = ''
        const selectedJob = this.job.value
        this.job.replaceChildren(new Option('No job bars', ''))
        for (const job of profile ? PreviewModel.jobs(profile) : []) this.job.add(new Option(PreviewModel.friendly(job), job))
        if (Array.from(this.job.options).some(option => option.value === selectedJob) && selectedJob) this.job.value = selectedJob
        else if (this.job.options.length > 1) this.job.selectedIndex = 1
        document.getElementById('jobGroup').hidden = this.job.options.length <= 1
        document.getElementById('profileKind').textContent = profile?.kind || 'No profile loaded'
        const styles = document.getElementById('previewStyle')
        styles.replaceChildren(new Option('Base', '-1'), new Option('From scene', '-2'))
        let maxConditions = 0
        function findConditions(value) {
            if (!value || typeof value !== 'object') return
            maxConditions = Math.max(maxConditions, value.StyleConditions?.Conditions?.length || 0)
            Object.values(value).forEach(findConditions)
        }
        if (profile?.kind === 'DelvCD') findConditions(profile.configs)
        for (let i = 0; i < maxConditions; i++) styles.add(new Option(`Condition ${i + 1}`, String(i)))
        document.getElementById('styleGroup').hidden = maxConditions === 0
        document.getElementById('dummyJobGroup').hidden = profile?.kind !== 'DelvCD'
        document.getElementById('partyStateGroup').hidden = profile?.kind === 'DelvCD'
        this.render()
    }
    options() {
        const get = id => document.getElementById(id)
        return { job: this.job.value, showDisabled: get('showDisabled').checked, showStatuses: get('showStatuses').checked,
            dummyName: get('dummyName').value || 'Alex Rivers', dummyTarget: get('dummyTarget').value || 'Training Dummy',
            hpPercent: Number(get('dummyHealth').value), statusCount: Number(get('dummyStatusCount').value),
            partyCount: Number(get('dummyPartyCount').value), enemyCount: Number(get('dummyEnemyCount').value),
            state: get('dummyState').value, level: Number(get('dummyLevel').value), cooldown: Number(get('dummyCooldown').value),
            charges: Number(get('dummyCharges').value), gauge: Number(get('dummyGauge').value), partyState: get('dummyPartyState').value,
            hasTarget: get('dummyHasTarget').checked, jobId: this.profile?.kind === 'DelvUI' ? PreviewState.jobs.find(job => job.name + 'Config' === this.job.value)?.jobId || 19 : Number(get('dummyJob').value),
            mousePosition: this.mousePosition && { x: this.mousePosition.x * this.factor(), y: this.mousePosition.y * this.factor() },
            conditionIndex: Number(get('previewStyle').value), resolveFont: this.motion?.resolveFont,
            fontFamily: name => this.fonts.family(name), measureText: (text, size, family) => {
                const key = JSON.stringify([text, size, family])
                if (this.motion?.widths.has(key)) return this.motion.widths.get(key)
                this.measure.font = `${size}px ${JSON.stringify(family || 'sans-serif')}, sans-serif`
                const width = this.measure.measureText(text).width
                this.motion?.widths.set(key, width)
                return width
            } }
    }
    beginMotion() {
        if (!this.renderedProfile) return
        this.motion = { resolveFont: PreviewFonts.createResolver(this.renderedProfile), widths: new Map() }
    }
    renderMotion(path = null) {
        if (!this.motion || !this.renderedProfile) return
        if (path && this.view === 'scaled') {
            const source = path.reduce((value, key) => value?.[key], this.profile)
            const owner = path.slice(0, -1).reduce((value, key) => value[key], this.renderedProfile)
            if (source === undefined) delete owner[path.at(-1)]
            else {
                owner[path.at(-1)] = structuredClone(source)
                ConfigCodec.scaleRecursive(owner[path.at(-1)], this.factor(), null, ProfileScalePolicy.contextAt(this.profile, path))
            }
            if (this.scaleCache?.profile === this.renderedProfile) {
                this.scaleCache.revision = this.editor.revision
                this.scaleCache.audit = null
            }
        }
        this.model = PreviewModel.build(this.renderedProfile, this.model.width, this.model.height, this.options())
        const selected = this.selected(), get = id => document.getElementById(id)
        const focus = selected ? get('focusMode').value : 'all', editing = get('editPositions').checked, names = get('showNames').checked
        const related = e => PreviewAlignment.related(e, selected)
        this.drawing.sync(this.model.elements.filter(e => focus !== 'only' || related(e)), selected?.id, e => ({
            editing, names, nameSize: this.model.width / 140,
            dim: focus === 'dim' && !related(e), interactive: focus === 'all' || e.id === selected?.id
        }))
        this.alignment.draw()
        this.resolutions.draw()
        this.updateDetails(Boolean(this.renderedProfile))
        this.updateInspector(true)
    }
    scheduleRender() {
        if (!this.renderFrame) this.renderFrame = requestAnimationFrame(() => this.render())
    }
    render() {
        if (this.renderFrame) cancelAnimationFrame(this.renderFrame)
        this.renderFrame = null
        this.motion = null
        const get = id => document.getElementById(id)
        const screen = ScreenResolutions.read(this.view === 'original' ? 'baseRes' : 'targetRes')
        this.screenSizes ||= {}
        const { width, height, aspect } = screen || this.screenSizes[this.view] || { width: 1920, height: 1080, aspect: 16 / 9 }
        if (screen) this.screenSizes[this.view] = screen
        const factor = Number(get('manualScale').value), validScale = Number.isFinite(factor) && factor > 0
        let profile = this.profile
        if (this.view === 'scaled') profile = profile && validScale ? this.scaledProfile() : null
        if (!screen) profile = null
        this.renderedProfile = profile
        for (const view of ['original', 'scaled']) {
            const button = get(view === 'original' ? 'viewOriginal' : 'viewScaled')
            button.classList.toggle('active', view === this.view)
            button.setAttribute('aria-pressed', String(view === this.view))
        }
        get('screenSize').textContent = screen ? `${width} × ${height} · ${this.view === 'original' ? 'source' : 'scaled'}` : 'Invalid resolution'
        const viewport = this.resolutions.viewport(width, height, aspect)
        get('screenFrame').style.aspectRatio = `${viewport.width} / ${viewport.height}`
        this.drawing.background(width, height, get('showGrid').checked, this.grid(), viewport)
        this.model = profile ? PreviewModel.build(profile, width, height, this.options()) : { elements: [], skipped: [] }
        const selected = this.picker.value
        this.picker.replaceChildren(new Option('Select an element', ''))
        const search = get('elementSearch').value.trim().toLowerCase().split(/\s+/)
        for (const element of this.model.elements) {
            if (element.id === selected || search.every(word => element.name.toLowerCase().includes(word))) this.picker.add(new Option(element.name, element.id))
        }
        this.picker.value = selected
        const selectedElement = this.selected()
        const focus = selectedElement ? get('focusMode').value : 'all'
        for (const e of this.model.elements) {
            const related = selectedElement && PreviewAlignment.related(e, selectedElement)
            if (focus === 'only' && !related) continue
            this.drawing.element(e, selectedElement?.id === e.id, { editing: get('editPositions').checked,
                names: get('showNames').checked, nameSize: width / 140, dim: focus === 'dim' && !related,
                interactive: focus === 'all' || e.id === selectedElement?.id })
        }
        this.alignment.draw()
        this.resolutions.draw()
        get('previewEmpty').hidden = Boolean(profile)
        this.updateDetails(Boolean(profile), screen ? undefined : 'Use whole-pixel sizes from 1 to 32768.')
        get('coverageSummary').textContent = `Missing settings (${this.model.skipped.length})`
        get('coverageNotes').hidden = !this.model.skipped.length
        const list = get('coverageList')
        list.replaceChildren()
        for (const note of this.model.skipped) { const item = document.createElement('li'); item.textContent = note; list.append(item) }
        get('dummyHealthValue').textContent = `${get('dummyHealth').value}%`
        this.fonts.render(this.profile)
        this.auditPanel.render(this)
        this.updateInspector()
        if (this.interactions.drag) this.beginMotion()
    }
    updateDetails(hasProfile, error = 'Enter a positive multiplier to preview scaling.') {
        const selected = this.selected(), get = id => document.getElementById(id)
        const details = selected ?
            `${selected.name} · ${this.round(selected.width)} × ${this.round(selected.height)} px${selected.font ? ` · ${selected.font.family} ${this.round(selected.fontSize)} px` : ''}${selected.offscreen ? ' · outside screen' : ''}` : 'Select an element.'
        const elements = this.model.elements.filter(e => e.kind !== 'group'), offscreen = elements.filter(e => e.offscreen).length
        const summary = this.profile && !hasProfile ? error : hasProfile ?
            `${elements.length} elements${offscreen ? ` · ${offscreen} outside screen` : ''}` : ''
        if (get('elementDetails').textContent !== details) get('elementDetails').textContent = details
        if (get('previewSummary').textContent !== summary) get('previewSummary').textContent = summary
    }
    updateInspector(moving = false) {
        const get = id => document.getElementById(id), element = this.selected(), path = element?.editPath
        const editing = get('editPositions').checked && Boolean(path)
        const position = path && this.editor ? this.positionInView(path) : null
        get('positionX').value = position ? String(this.round(position.X)) : ''
        get('positionY').value = position ? String(this.round(position.Y)) : ''
        get('positionX').disabled = !editing || get('moveAxis').value === 'y'
        get('snapSelected').disabled = !editing
        get('positionY').disabled = !editing || get('moveAxis').value === 'x'
        get('resetPosition').disabled = !this.editor?.changed.has(JSON.stringify(path))
        get('resetAllPositions').disabled = !this.editor?.changed.size
        const pendingScale = this.editor && Object.entries(this.editor.settings).some(([id, value]) => value !== get(id).value)
        get('undoEdit').disabled = !this.editor?.canUndo && !pendingScale
        get('redoEdit').disabled = !this.editor?.canRedo || Boolean(pendingScale)
        get('editStatus').textContent = this.editor?.changed.size ? `${this.editor.changed.size} edits` : ''
        get('positionNote').textContent = element?.note || (path ? 'Relative to its anchor.' : '')
        if (!moving) this.alignment.update()
    }
    round(number) { return Math.round(number * 100) / 100 }
}
