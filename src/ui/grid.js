(function (root) {
    function spacing(value) {
        const number = Number(value)
        return Number.isFinite(number) && number >= 1 && number <= 1000 ? number : 20
    }
    function settings(x, y) { return { x: spacing(x), y: spacing(y) } }
    function snap(position, point, grid, origin, factor = 1, axis = 'free', displayedPosition = null) {
        const result = { ...position }
        if (!Number.isFinite(factor) || factor <= 0) return result
        for (const [key, coordinate] of [['X', 'x'], ['Y', 'y']]) {
            if (axis === 'x' && key === 'Y' || axis === 'y' && key === 'X') continue
            const step = spacing(grid[coordinate])
            const target = origin[coordinate] + Math.round((point[coordinate] - origin[coordinate]) / step) * step
            result[key] = ((displayedPosition?.[key] ?? position[key] * factor) + target - point[coordinate]) / factor
        }
        return result
    }
    const api = { settings, snap }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewGrid = api
})(globalThis)
