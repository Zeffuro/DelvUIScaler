document.addEventListener('DOMContentLoaded', () => {
    const get = id => document.getElementById(id)
    const preview = new ProfilePreview()
    new PreviewPreferences(preview)
    const files = new ProfileFiles({
        begin: clearPreview,
        load: text => { get('inputStr').value = text; return loadPreview() },
        status: (message, kind, id = 'inputStatus') => status(id, message, kind),
        exported: () => ({ text: get('outputStr').value, kind: preview.profile?.kind })
    })
    let loadedInput = '', loadTimer
    function status(id, message, kind = '') {
        get(id).textContent = message
        get(id).className = `status ${kind}`
    }
    function invalidateOutput() {
        get('outputStr').value = ''
        get('copyBtn').disabled = true
        get('downloadBtn').disabled = true
        status('outputStatus', '')
    }
    function clearPreview() {
        clearTimeout(loadTimer)
        get('inputStr').value = ''
        loadedInput = ''
        preview.setProfile(null)
        invalidateOutput()
    }
    function updateFactor() {
        get('manualScale').value = (Number(get('targetRes').value) / Number(get('baseRes').value)).toFixed(3)
        settingsChanged(true)
    }
    function settingsChanged(record = false) {
        preview.interactions.end()
        if (record) preview.editor?.setSettings(preview.scaleSettings())
        invalidateOutput()
        preview.render()
    }
    function loadPreview() {
        clearTimeout(loadTimer)
        invalidateOutput()
        const input = get('inputStr').value.trim()
        loadedInput = ''
        try {
            const profile = ConfigCodec.decode(input)
            preview.setProfile(profile)
            loadedInput = input
            status('inputStatus', `${profile.kind} · ${profile.configs.length} sections`, 'success')
            return profile
        } catch (error) {
            preview.setProfile(null)
            status('inputStatus', error.message, input ? 'error' : '')
            return null
        }
    }
    get('inputStr').addEventListener('input', () => {
        files.cancel()
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
        get(id).addEventListener('click', () => {
            files.cancel()
            try {
                get('inputStr').value = ConfigCodec.encode(DemoProfiles[kind])
                loadPreview()
                status('inputStatus', `${kind} example`, 'success')
            } catch (error) {
                status('inputStatus', 'The compression library could not load. Check your connection and reload.', 'error')
            }
        })
    }
    get('processBtn').addEventListener('click', () => {
        const profile = loadedInput === get('inputStr').value.trim() && preview.profile ? preview.profile : loadPreview()
        if (!profile) return
        try {
            const scaled = preview.exportProfile()
            const exportString = ConfigCodec.encode(scaled)
            get('outputStr').value = exportString
            get('copyBtn').disabled = false
            get('downloadBtn').disabled = false
            preview.view = 'scaled'
            preview.render()
            status('outputStatus', `Ready · ${profile.configs.length} sections`, 'success')
        } catch (error) {
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
    get('baseRes').addEventListener('change', updateFactor)
    get('targetRes').addEventListener('change', updateFactor)
    get('manualScale').addEventListener('input', () => settingsChanged())
    get('manualScale').addEventListener('change', () => settingsChanged(true))
    get('aspectRatio').addEventListener('change', () => preview.render())
    document.addEventListener('profileedit', invalidateOutput)
    function history(direction) {
        preview.interactions.end()
        preview.editor?.setSettings(preview.scaleSettings())
        if (!preview.editor?.[direction]()) return
        for (const [id, value] of Object.entries(preview.editor.settings)) get(id).value = value
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
