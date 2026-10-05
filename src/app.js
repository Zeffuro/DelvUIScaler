document.addEventListener('DOMContentLoaded', () => {
    const get = id => document.getElementById(id)
    const resolutions = new ScreenResolutions()
    const preview = new ProfilePreview()
    new PreviewPreferences(preview)
    const files = new ProfileFiles({
        begin: clearPreview,
        load: text => { get('inputStr').value = text; return loadPreview() },
        status: (message, kind, id = 'inputStatus') => status(id, message, kind),
        exported: () => ({ text: get('outputStr').value, kind: preview.profile?.kind })
    })
    const codec = new ProfileCodecService()
    let loadedInput = '', loadTimer, loadTicket = 0, exportTicket = 0, exporting = false
    function status(id, message, kind = '') {
        get(id).textContent = message
        get(id).className = `status ${kind}`
    }
    function invalidateOutput() {
        exportTicket++
        if (exporting) codec.cancel()
        exporting = false
        get('outputStr').value = ''
        get('copyBtn').disabled = true
        get('downloadBtn').disabled = true
        status('outputStatus', '')
    }
    function clearPreview() {
        clearTimeout(loadTimer)
        loadTicket++
        codec.cancel()
        get('inputStr').value = ''
        loadedInput = ''
        preview.setProfile(null)
        invalidateOutput()
    }
    function updateFactor(record = true) {
        const base = ScreenResolutions.read('baseRes'), target = ScreenResolutions.read('targetRes')
        const factor = ScreenResolutions.factor(base, target, get('scaleMode').value, get('manualScale').value)
        if (get('scaleMode').value !== 'manual') get('manualScale').value = factor ? factor.toFixed(factor < .001 ? 6 : 3) : ''
        settingsChanged(record)
    }
    function settingsChanged(record = false) {
        preview.interactions.end()
        resolutions.refresh()
        if (record) preview.editor?.setSettings(preview.scaleSettings())
        invalidateOutput()
        if (record) preview.render()
        else preview.scheduleRender()
    }
    async function loadPreview() {
        clearTimeout(loadTimer)
        invalidateOutput()
        const rawInput = get('inputStr').value, input = rawInput.trim()
        loadedInput = ''
        const ticket = ++loadTicket
        codec.cancel()
        if (!input) { preview.setProfile(null); status('inputStatus', 'Your profile stays in this browser.'); return null }
        status('inputStatus', 'Reading profile…')
        try {
            const profile = await codec.decode(rawInput)
            if (ticket !== loadTicket || input !== get('inputStr').value.trim()) return null
            preview.setProfile(profile)
            loadedInput = input
            status('inputStatus', `${profile.kind} · ${profile.configs.length} sections`, 'success')
            return profile
        } catch (error) {
            if (ticket !== loadTicket || error.code === 'CANCELLED') return null
            preview.setProfile(null)
            status('inputStatus', error.message, input ? 'error' : '')
            return null
        }
    }
    get('inputStr').addEventListener('input', () => {
        files.cancel()
        loadTicket++
        codec.cancel()
        invalidateOutput()
        loadedInput = ''
        preview.setProfile(null)
        status('inputStatus', 'Reading your profile…')
        clearTimeout(loadTimer)
        loadTimer = setTimeout(loadPreview, 300)
    })
    get('previewBtn').addEventListener('click', () => { files.cancel(); loadPreview() })
    get('clearBtn').addEventListener('click', () => {
        files.cancel()
        clearPreview()
        status('inputStatus', 'Your profile stays in this browser.')
    })
    for (const [id, kind] of [['demoUI', 'DelvUI'], ['demoCD', 'DelvCD']]) {
        get(id).addEventListener('click', async () => {
            files.cancel()
            try {
                get('inputStr').value = ConfigCodec.encode(DemoProfiles[kind])
                const profile = await loadPreview()
                if (profile) status('inputStatus', `${kind} example`, 'success')
            } catch (error) {
                status('inputStatus', 'Could not load the example. Reload this page.', 'error')
            }
        })
    }
    get('processBtn').addEventListener('click', async () => {
        const profile = loadedInput === get('inputStr').value.trim() && preview.profile ? preview.profile : await loadPreview()
        if (!profile) return
        invalidateOutput()
        const ticket = exportTicket, input = loadedInput, editor = preview.editor, revision = editor.revision
        const factor = Number(get('manualScale').value)
        try {
            if (!ScreenResolutions.read('baseRes') || !ScreenResolutions.read('targetRes')) throw new Error('Use whole-pixel sizes from 1 to 32768.')
            exporting = true
            status('outputStatus', 'Generating…')
            const exportString = await codec.encode(preview.profile, factor)
            if (ticket !== exportTicket || editor !== preview.editor || revision !== editor.revision || input !== get('inputStr').value.trim()) return
            exporting = false
            get('outputStr').value = exportString
            get('copyBtn').disabled = false
            get('downloadBtn').disabled = false
            preview.view = 'scaled'
            preview.render()
            status('outputStatus', `Ready · ${profile.configs.length} sections`, 'success')
        } catch (error) {
            if (ticket !== exportTicket || error.code === 'CANCELLED') return
            invalidateOutput()
            status('outputStatus', error.message, 'error')
        }
    })
    get('copyBtn').addEventListener('click', async () => {
        if (!get('outputStr').value) return
        try {
            await navigator.clipboard.writeText(get('outputStr').value)
            status('outputStatus', 'Copied to clipboard.', 'success')
        } catch {
            get('outputStr').focus()
            get('outputStr').select()
            const copied = document.execCommand('copy')
            status('outputStatus', copied ? 'Copied to clipboard.' : 'The export is selected. Press Ctrl+C (⌘C on Mac) to copy.', copied ? 'success' : '')
        }
    })
    for (const id of ['baseRes', 'targetRes']) get(id).addEventListener('change', () => {
        resolutions.select(id)
        updateFactor()
    })
    for (const id of ['baseWidth', 'baseHeight', 'targetWidth', 'targetHeight']) {
        get(id).addEventListener('input', () => updateFactor(false))
        get(id).addEventListener('change', () => updateFactor())
    }
    get('scaleMode').addEventListener('change', () => updateFactor())
    get('manualScale').addEventListener('input', () => { get('scaleMode').value = 'manual'; settingsChanged() })
    get('manualScale').addEventListener('change', () => settingsChanged(true))
    get('aspectRatio').addEventListener('change', () => updateFactor())
    document.addEventListener('profileedit', invalidateOutput)
    function history(direction) {
        preview.interactions.end()
        preview.editor?.setSettings(preview.scaleSettings())
        if (!preview.editor?.[direction]()) return
        for (const [id, value] of Object.entries(preview.editor.settings)) get(id).value = value
        resolutions.refresh()
        preview.edited()
    }
    get('undoEdit').addEventListener('click', () => history('undo'))
    get('redoEdit').addEventListener('click', () => history('redo'))
    document.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey ||
            event.target.closest('input, textarea, select, [contenteditable]')) return
        const key = event.key.toLowerCase()
        const direction = key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' ? 'redo' : null
        if (!direction || !preview.editor) return
        event.preventDefault()
        history(direction)
    })
    updateFactor()
})
