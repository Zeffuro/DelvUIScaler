(function (root) {
    const defaults = { showGrid: true, showNames: false, showDisabled: false, snapGrid: false, smartGuides: true, showResolutions: false,
        gridX: 20, gridY: 20, previewZoom: 100, moveAxis: 'free', focusMode: 'all', aspectRatio: '1.7777777777777777' }
    function normalize(value) {
        const result = { ...defaults }
        if (!value || typeof value !== 'object') return result
        for (const key of ['showGrid', 'showNames', 'showDisabled', 'snapGrid', 'smartGuides', 'showResolutions']) {
            if (typeof value[key] === 'boolean') result[key] = value[key]
        }
        for (const key of ['gridX', 'gridY']) {
            const number = Number(value[key])
            if (Number.isFinite(number) && number >= 1 && number <= 1000) result[key] = number
        }
        const zoom = Number(value.previewZoom)
        if (Number.isFinite(zoom)) result.previewZoom = Math.round(Math.max(100, Math.min(800, zoom)))
        for (const [key, values] of [['moveAxis', ['free', 'x', 'y']], ['focusMode', ['all', 'dim', 'only']],
            ['aspectRatio', ['1.7777777777777777', '1.6', '2.3333333333333335', '3.5555555555555554']]]) {
            if (values.includes(value[key])) result[key] = value[key]
        }
        return result
    }
    class PreviewPreferences {
        constructor(preview) {
            this.key = 'delvuiscaler.preview.v1'
            let saved
            try { saved = JSON.parse(localStorage.getItem(this.key)) } catch {}
            for (const [id, value] of Object.entries(normalize(saved))) {
                const field = document.getElementById(id)
                if (field.type === 'checkbox') field.checked = value
                else field.value = String(value)
            }
            preview.interactions.setZoom(Number(document.getElementById('previewZoom').value))
            preview.render()
            const save = event => {
                if (event.type !== 'previewzoom' && !Object.hasOwn(defaults, event.target.id)) return
                const settings = {}
                for (const id of Object.keys(defaults)) {
                    const field = document.getElementById(id)
                    settings[id] = field.type === 'checkbox' ? field.checked : field.value
                }
                try { localStorage.setItem(this.key, JSON.stringify(normalize(settings))) } catch {}
            }
            document.addEventListener('input', save)
            document.addEventListener('change', save)
            document.addEventListener('previewzoom', save)
        }
    }
    if (typeof module !== 'undefined') module.exports = { normalize, PreviewPreferences }
    else root.PreviewPreferences = PreviewPreferences
})(globalThis)
