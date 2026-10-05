(function (root) {
    function dimensions(resolution, width, height, aspect) {
        const custom = resolution === 'custom'
        height = Number(custom ? height : resolution)
        width = custom ? Number(width) : Math.round(height * Number(aspect))
        if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= 32768)) return null
        return { width, height, aspect: width / height }
    }
    function ratio(width, height) {
        for (const [x, y] of [[16, 9], [16, 10], [21, 9], [32, 9], [4, 3]]) {
            if (width / height === x / y) return `${x}:${y}`
        }
        let a = width, b = height
        while (b) [a, b] = [b, a % b]
        return `${width / a}:${height / a}`
    }
    function scaleFactor(source, target, mode = 'height', manual = 1) {
        if (mode === 'manual') return Number(manual)
        if (!source || !target) return null
        const x = target.width / source.width, y = target.height / source.height
        return mode === 'width' ? x : mode === 'fit' ? Math.min(x, y) : mode === 'fill' ? Math.max(x, y) : y
    }
    class ScreenResolutions {
        static factor = scaleFactor
        static read(id) {
            const get = key => document.getElementById(key).value, prefix = id === 'baseRes' ? 'base' : 'target'
            return dimensions(get(id), get(prefix + 'Width'), get(prefix + 'Height'), get('aspectRatio'))
        }
        constructor() {
            this.previous = {}
            this.opened = new Set()
            this.refresh()
        }
        select(id) {
            const get = key => document.getElementById(key), prefix = id === 'baseRes' ? 'base' : 'target'
            if (get(id).value === 'custom' && !this.opened.has(id)) {
                const size = dimensions(this.previous[id], 0, 0, get('aspectRatio').value)
                get(prefix + 'Width').value = size.width
                get(prefix + 'Height').value = size.height
            }
        }
        refresh() {
            const get = key => document.getElementById(key)
            for (const [id, prefix] of [['baseRes', 'base'], ['targetRes', 'target']]) {
                const custom = get(id).value === 'custom', size = ScreenResolutions.read(id)
                get(prefix + 'Custom').hidden = !custom
                for (const axis of ['Width', 'Height']) get(prefix + axis).disabled = !custom
                get(prefix + 'Ratio').textContent = size ? ratio(size.width, size.height) : ''
                if (custom) this.opened.add(id)
                this.previous[id] = get(id).value
            }
            const valid = Boolean(ScreenResolutions.read('baseRes') && ScreenResolutions.read('targetRes'))
            get('resolutionStatus').textContent = valid ? '' : 'Use whole-pixel sizes from 1 to 32768.'
            get('resolutionStatus').hidden = valid
            get('processBtn').disabled = !valid
            get('aspectRatio').disabled = get('baseRes').value === 'custom' && get('targetRes').value === 'custom'
            const source = ScreenResolutions.read('baseRes'), target = ScreenResolutions.read('targetRes')
            get('aspectHint').hidden = !source || !target || Math.abs(source.aspect - target.aspect) < .001
        }
    }
    if (typeof module !== 'undefined') module.exports = { dimensions, ratio, scaleFactor }
    else root.ScreenResolutions = ScreenResolutions
})(globalThis)
