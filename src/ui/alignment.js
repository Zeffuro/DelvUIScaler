(function (root) {
    const model = typeof module !== 'undefined' ? require('../preview/model.js') : root.PreviewModel
    const keys = ['x', 'y', 'width', 'height']
    const prefix = (path, parent) => Array.isArray(path) && parent.every((key, i) => path[i] === key)
    function bounds(element) {
        const rect = element.alignmentRect || element
        return Object.fromEntries(keys.map(key => [key, rect[key]]))
    }
    function related(element, selected) {
        if (!selected) return false
        if (element.id === selected.id) return true
        const name = String(selected.name || '').replace(/ \(group\)$/, '')
        if (typeof element.name !== 'string' || !element.name.startsWith(name + ' /')) return false
        const path = selected.editPath
        if (!Array.isArray(path)) return true
        const owner = path.slice(0, path.at(-2) === 'GroupConfig' ? -2 : -1)
        return prefix(element.editPath, owner)
    }
    function drawable(element) {
        const rect = bounds(element)
        return !element.disabled && Array.isArray(element.editPath) && element.editPath.length > 0 &&
            ['bar', 'group', 'circle', 'area', 'icon'].includes(element.kind) && !element.status &&
            keys.every(key => Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0
    }
    function moved(before, after) {
        return !after || keys.some(key => Math.abs(bounds(before)[key] - bounds(after)[key]) >= .001)
    }
    function probe(profile, scene, selected, options) {
        if (!Array.isArray(selected?.editPath) || !selected.editPath.length) return null
        try {
            const results = []
            for (const axis of ['X', 'Y']) {
                const copy = JSON.parse(JSON.stringify(profile)), path = selected.editPath
                const owner = path.slice(0, -1).reduce((value, key) => value?.[key], copy)
                if (!owner || typeof owner !== 'object') return null
                const position = owner[path.at(-1)]
                if (position != null && typeof position !== 'object') return null
                const value = Number(position?.[axis] ?? 0)
                if (!Number.isFinite(value)) return null
                owner[path.at(-1)] = { ...position, [axis]: value + 1 }
                results.push(new Map(model.build(copy, scene.width, scene.height, options).elements.map(element => [element.id, element])))
            }
            return results
        } catch { return null }
    }
    function targets(profile, scene, selected, options = {}, reference = null) {
        const result = [{ x: 0, y: 0, width: scene.width, height: scene.height, id: 'screen', name: 'Screen' }]
        const path = selected?.editPath || [], owner = path.slice(0, path.at(-2) === 'GroupConfig' ? -2 : -1)
        const probes = probe(profile, scene, selected, options)
        const dependent = element => element.kind === 'group' && element.editPath?.at(-2) === 'GroupConfig' &&
            prefix(path, element.editPath.slice(0, -2)) || (probes ? probes.some(elements => moved(element, elements.get(element.id))) :
                owner.length && prefix(element.editPath, owner))
        if (reference) {
            return reference.id === selected?.id || dependent(reference) ? [] :
                [{ ...bounds(reference), id: reference.id, name: reference.name }]
        }
        for (const element of scene.elements) {
            if (!drawable(element) || related(element, selected)) continue
            if (path.length && element.editPath.length === path.length && prefix(element.editPath, path)) continue
            // Geometry probes include anchors and enclosing groups whose bounds follow a child.
            if (dependent(element)) continue
            result.push({ ...bounds(element), id: element.id, name: element.name })
        }
        return result
    }
    function snap(rect, references, tolerance, axis = 'free') {
        const result = { dx: 0, dy: 0, guides: [] }
        if (!Number.isFinite(tolerance) || tolerance < 0) return result
        for (const [coordinate, size, delta, lock] of [['x', 'width', 'dx', 'y'], ['y', 'height', 'dy', 'x']]) {
            if (axis === lock) continue
            let best = null
            for (const reference of references) {
                for (const source of [0, .5, 1]) for (const target of [0, .5, 1]) {
                    const position = reference[coordinate] + reference[size] * target
                    const movement = position - rect[coordinate] - rect[size] * source
                    const distance = Math.abs(movement), priority = source === .5 && target === .5 ? 0 : 1
                    if (distance <= tolerance && (!best || distance < best.distance || distance === best.distance && priority < best.priority)) {
                        best = { movement, distance, priority, position }
                    }
                }
            }
            if (best) {
                result[delta] = best.movement
                result.guides.push({ axis: coordinate, position: best.position })
            }
        }
        return result
    }
    function align(rect, reference, action) {
        const result = { dx: 0, dy: 0 }
        const actions = { left: ['x', 'width', 0], centerX: ['x', 'width', .5], right: ['x', 'width', 1],
            top: ['y', 'height', 0], centerY: ['y', 'height', .5], bottom: ['y', 'height', 1],
            mirrorX: ['x', 'width', .5], mirrorY: ['y', 'height', .5] }
        const values = actions[action]
        if (!values) return result
        const [coordinate, size, factor] = values
        const delta = reference[coordinate] + reference[size] * factor - rect[coordinate] - rect[size] * factor
        result[coordinate === 'x' ? 'dx' : 'dy'] = delta * (action.startsWith('mirror') ? 2 : 1)
        return result
    }
    const api = { bounds, related, targets, snap, align }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewAlignment = api
})(globalThis)
