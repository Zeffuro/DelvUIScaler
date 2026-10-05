class PreviewFontPanel {
    constructor(preview) {
        this.preview = preview
        this.loaded = new Map()
        this.requests = new Map()
        this.errors = new Map()
        this.cache = null
        this.groups = []
        this.selected = -1
        this.nextFont = 0
        this.nextRequest = 0
        document.getElementById('fontFile').addEventListener('change', event => this.load(event.target))
        for (const id of ['fontFamily', 'fontIssuesOnly']) document.getElementById(id).addEventListener('change', () => this.render(preview.profile))
        document.getElementById('fontSampleText').addEventListener('input', () => this.compare())
        document.getElementById('clearFont').addEventListener('click', () => this.clear())
        document.getElementById('fontRows').addEventListener('click', event => {
            const row = event.target.closest('[data-font]')
            if (!row) return
            this.selected = Number(row.dataset.font)
            for (const item of document.getElementById('fontRows').children) {
                const selected = Number(item.dataset.font) === this.selected
                item.classList.toggle('font-selected', selected)
                item.querySelector('button').setAttribute('aria-pressed', String(selected))
            }
            this.compare()
        })
    }
    family(name) { return this.loaded.get(name)?.face.family || name }
    async load(input) {
        const file = input.files[0], name = this.groups[this.selected]?.row.source.family
        input.value = ''
        if (!file || !name) return
        const request = ++this.nextRequest
        this.requests.set(name, request)
        this.errors.delete(name)
        this.compare()
        try {
            if (file.size > ProfileLimits.fontBytes) throw new Error('Font exceeds the 16 MiB limit.')
            if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('Choose a TTF, OTF, WOFF or WOFF2 font.')
            const bytes = await file.arrayBuffer()
            if (this.requests.get(name) !== request) return
            const face = await new FontFace('PreviewFont' + this.nextFont++, bytes).load()
            if (this.requests.get(name) !== request) return
            const previous = this.loaded.get(name)
            if (previous) document.fonts.delete(previous.face)
            document.fonts.add(face)
            this.loaded.set(name, { face, file: file.name })
        } catch (error) {
            if (this.requests.get(name) === request) this.errors.set(name, error.message?.startsWith('Font exceeds') || error.message?.startsWith('Choose a ') ? error.message : 'Could not load that font.')
        }
        if (this.requests.get(name) === request) {
            this.requests.delete(name)
            this.preview.render()
        }
    }
    clear() {
        const name = this.groups[this.selected]?.row.source.family, font = this.loaded.get(name)
        if (!font && !this.requests.has(name) && !this.errors.has(name)) return
        if (font) document.fonts.delete(font.face)
        this.loaded.delete(name)
        this.errors.delete(name)
        this.requests.delete(name)
        this.preview.render()
    }
    render(profile) {
        const get = id => document.getElementById(id), factor = Number(get('manualScale').value)
        get('fontChecks').hidden = !profile
        if (!profile) return
        get('fontSummary').textContent = 'Font scaling'
        get('fontEmpty').hidden = true
        get('fontTools').hidden = false
        if (!Number.isFinite(factor) || factor <= 0) {
            get('fontWorkspace').hidden = true
            get('fontTools').hidden = true
            get('fontEmpty').textContent = 'Enter a positive multiplier.'
            get('fontEmpty').hidden = false
            return
        }
        if (this.cache?.profile !== profile || this.cache.factor !== factor) {
            const previousPath = this.groups[this.selected]?.row.pathString
            this.cache = { profile, factor, audit: PreviewFonts.audit(profile, factor, this.preview.scaledProfile()) }
            const groups = new Map()
            for (const row of this.cache.audit.rows) {
                const key = [row.source.key, row.source.family, row.source.fontSize, row.actual?.fontSize, row.problem, row.source.approximate].join('|')
                if (!groups.has(key)) groups.set(key, { row, count: 0 })
                groups.get(key).count++
            }
            this.groups = [...groups.values()]
            this.selected = this.groups.findIndex(group => group.row.pathString === previousPath)
            const current = get('fontFamily').value
            get('fontFamily').replaceChildren(new Option('All fonts', ''))
            for (const name of new Set(this.groups.map(group => group.row.source.family))) get('fontFamily').add(new Option(name, name))
            if ([...get('fontFamily').options].some(option => option.value === current)) get('fontFamily').value = current
        }
        const review = this.groups.filter(({ row }) => row.problem || row.warnings.length).length
        get('fontSummary').textContent = 'Font scaling · ' + this.groups.length + ' sizes' + (review ? ' · ' + review + ' need review' : '')
        const visible = this.groups.map((group, index) => ({ ...group, index })).filter(({ row }) =>
            (!get('fontFamily').value || row.source.family === get('fontFamily').value) &&
            (!get('fontIssuesOnly').checked || row.problem || row.warnings.length))
        if (!visible.some(group => group.index === this.selected)) this.selected = visible[0]?.index ?? -1
        get('fontWorkspace').hidden = !visible.length
        get('fontEmpty').hidden = Boolean(visible.length)
        get('fontEmpty').textContent = this.groups.length ? 'No fonts need review.' : 'No text labels in this profile.'
        get('fontTools').hidden = !this.groups.length
        const rows = get('fontRows')
        rows.replaceChildren()
        for (const { row, count, index } of visible) {
            const tr = document.createElement('tr')
            tr.dataset.font = index
            tr.classList.toggle('font-issue', row.problem)
            tr.classList.toggle('font-selected', index === this.selected)
            const font = document.createElement('td'), button = document.createElement('button')
            button.className = 'text-button'
            button.textContent = row.source.key || 'Default (' + row.source.family + ')'
            button.title = 'Compare ' + button.textContent
            button.setAttribute('aria-pressed', String(index === this.selected))
            font.append(button)
            tr.append(font)
            for (const text of [this.size(row.source.fontSize), this.size(row.actual?.fontSize), String(count), this.check(row)]) {
                const cell = document.createElement('td')
                cell.textContent = text
                tr.append(cell)
            }
            rows.append(tr)
        }
        this.compare()
    }
    check(row) {
        if (row.source.missingRegistry || row.actual?.missingRegistry) return 'Missing font'
        if (!row.actual) return 'Missing label'
        if (row.actual.family !== row.source.family) return 'Font changed'
        if (row.problem) return 'Size mismatch'
        if (row.source.approximate) return 'Estimated'
        if (row.warnings.length && !row.source.gameFont) return 'Review'
        return Math.abs(row.rounding) > .0001 ? 'Rounded' : 'Matches'
    }
    compare() {
        const group = this.groups[this.selected], get = id => document.getElementById(id)
        get('fontCompare').hidden = !group
        if (!group) return
        const row = group.row, name = row.source.family, uploaded = this.loaded.get(name)
        get('fontCompareName').textContent = name + ' · ' + group.count + ' labels'
        get('fontCheckResult').textContent = this.check(row)
        get('fontCheckResult').dataset.state = row.problem || row.source.approximate || row.warnings.length && !row.source.gameFont ? 'review' : 'match'
        const sample = get('fontSampleText').value || PreviewScene.sampleText(row.text || '[name] 72% 12', this.preview.options())
        get('fontSampleText').placeholder = sample
        for (const [id, font, sizeId] of [['fontSourceSample', row.source, 'fontSourceSize'], ['fontScaledSample', row.actual, 'fontScaledSize']]) {
            const label = get(id)
            label.textContent = sample
            label.style.fontSize = Math.max(0, font?.fontSize ?? 0) + 'px'
            label.style.fontFamily = JSON.stringify(this.family(font?.family || 'sans-serif')) + ', sans-serif'
            get(sizeId).textContent = this.size(font?.fontSize) + ' px'
        }
        const equals = Number(this.size(row.expectedSize)) === row.expectedSize ? ' = ' : ' ≈ '
        get('fontExpected').textContent = this.size(row.source.fontSize) + ' px × ' + this.cache.factor + equals + this.size(row.expectedSize) + ' px' +
            (!row.problem && Math.abs(row.rounding) > .0001 ? ' · rounded to ' + this.size(row.actual.fontSize) : '')
        get('fontLoadStatus').textContent = this.errors.has(name) ? this.errors.get(name) + ' Using ' + (uploaded?.file || 'browser fallback') + '.' :
            this.requests.has(name) ? 'Loading…' : uploaded?.file || 'Browser fallback'
        get('fontUploadLabel').title = 'Use a local font for ' + name
        get('fontFile').disabled = this.requests.has(name)
        get('clearFont').hidden = !uploaded && !this.requests.has(name) && !this.errors.has(name)
        const reason = row.source.missingRegistry || row.actual?.missingRegistry ? 'Font reference missing from the profile.' :
            !row.actual ? 'This label is missing from the export.' : row.actual.family !== name ? 'Export uses a different font.' :
            row.problem ? 'Expected ' + this.size(row.expectedExportSize) + ' px in the export.' : row.source.approximate ?
            row.source.inferred ? 'Size inferred from the font key.' : 'Size depends on the plugin’s default font.' :
            row.source.gameFont ? 'Game font appearance is approximate.' : row.warnings.length ? 'Check this font in game.' : ''
        get('fontReason').textContent = reason
        get('fontReason').title = row.warnings.join(' · ')
        get('fontReason').hidden = !reason
    }
    size(value) { return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '?' }
}
