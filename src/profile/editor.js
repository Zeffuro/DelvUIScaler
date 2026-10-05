(function (root) {
    function getPath(object, path) {
        return path.reduce((value, key) => value?.[key], object)
    }

    function equal(a, b) {
        if (Object.is(a, b)) return true
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
        const keys = Object.keys(a)
        return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]))
    }

    function snapshot(object, path) {
        const owner = getPath(object, path.slice(0, -1)), key = path.at(-1)
        return { exists: Object.hasOwn(owner, key), value: structuredClone(owner[key]) }
    }

    class ProfileEditor {
        constructor(profile, settings = {}) {
            this.original = structuredClone(profile)
            this.working = structuredClone(profile)
            this.changed = new Map()
            this.settings = structuredClone(settings)
            this.undoStack = []
            this.redoStack = []
            this.transaction = null
            this.transactionDepth = 0
            this.revision = 0
        }
        get canUndo() { return this.undoStack.length > 0 }
        get canRedo() { return this.redoStack.length > 0 }
        beginTransaction() {
            if (!this.transactionDepth++) this.transaction = { positions: new Map(), settings: null }
        }
        endTransaction() {
            if (!this.transactionDepth || --this.transactionDepth) return false
            const command = this.transaction
            this.transaction = null
            return this.commit(command)
        }
        commit(command) {
            const positions = [...command.positions.values()].filter(patch => !equal(patch.before, patch.after))
            const settings = command.settings && !equal(command.settings.before, command.settings.after) ? command.settings : null
            if (!positions.length && !settings) return false
            this.undoStack.push({ positions, settings })
            if (this.undoStack.length > 100) this.undoStack.shift()
            this.redoStack.length = 0
            return true
        }
        record(path, before) {
            this.revision++
            const command = this.transaction || { positions: new Map(), settings: null }
            const id = JSON.stringify(path), existing = command.positions.get(id)
            command.positions.set(id, { path: [...path], before: existing?.before || before, after: snapshot(this.working, path) })
            if (!this.transaction) this.commit(command)
        }
        setSettings(next) {
            if (equal(this.settings, next)) return false
            const command = this.transaction || { positions: new Map(), settings: null }
            command.settings = { before: command.settings?.before || structuredClone(this.settings), after: structuredClone(next) }
            this.settings = structuredClone(next)
            if (!this.transaction) this.commit(command)
            return true
        }
        updateChanged(path) {
            const next = this.position(path), original = getPath(this.original, path)
            const id = JSON.stringify(path)
            if (next.X !== (Number(original?.X) || 0) || next.Y !== (Number(original?.Y) || 0)) this.changed.set(id, [...path])
            else this.changed.delete(id)
        }
        apply(command, direction) {
            if (command.positions.length) this.revision++
            const patches = direction === 'before' ? [...command.positions].reverse() : command.positions
            for (const patch of patches) {
                const owner = getPath(this.working, patch.path.slice(0, -1)), state = patch[direction]
                if (state.exists) owner[patch.path.at(-1)] = structuredClone(state.value)
                else delete owner[patch.path.at(-1)]
                this.updateChanged(patch.path)
            }
            if (command.settings) this.settings = structuredClone(command.settings[direction])
        }
        undo() {
            while (this.transactionDepth) this.endTransaction()
            if (!this.canUndo) return false
            const command = this.undoStack.pop()
            this.apply(command, 'before')
            this.redoStack.push(command)
            return true
        }
        redo() {
            while (this.transactionDepth) this.endTransaction()
            if (!this.canRedo) return false
            const command = this.redoStack.pop()
            this.apply(command, 'after')
            this.undoStack.push(command)
            return true
        }
        position(path) {
            const value = getPath(this.working, path)
            return { X: Number(value?.X) || 0, Y: Number(value?.Y) || 0 }
        }
        setPosition(path, x, y, axis = 'free') {
            if (!Array.isArray(path) || !path.length || !Number.isFinite(x) || !Number.isFinite(y)) return false
            const owner = getPath(this.working, path.slice(0, -1))
            if (!owner || typeof owner !== 'object') return false
            const key = path.at(-1)
            const current = this.position(path)
            const next = { ...(owner[key] || {}), X: axis === 'y' ? current.X : x, Y: axis === 'x' ? current.Y : y }
            if (current.X === next.X && current.Y === next.Y) return false
            const before = snapshot(this.working, path)
            owner[key] = next
            const original = getPath(this.original, path)
            const changed = next.X !== (Number(original?.X) || 0) || next.Y !== (Number(original?.Y) || 0)
            if (changed) this.changed.set(JSON.stringify(path), [...path])
            else {
                this.restore(path)
                this.changed.delete(JSON.stringify(path))
            }
            this.record(path, before)
            return true
        }
        restore(path) {
            const owner = getPath(this.working, path.slice(0, -1))
            if (!owner) return
            const original = snapshot(this.original, path)
            if (!original.exists) delete owner[path.at(-1)]
            else owner[path.at(-1)] = original.value
        }
        reset(path) {
            if (!path || !this.changed.has(JSON.stringify(path))) return false
            const before = snapshot(this.working, path)
            this.restore(path)
            this.changed.delete(JSON.stringify(path))
            this.record(path, before)
            return true
        }
        resetAll() {
            if (!this.changed.size) return false
            this.beginTransaction()
            for (const path of [...this.changed.values()]) this.reset(path)
            this.endTransaction()
            return true
        }
    }
    if (typeof module !== 'undefined') module.exports = { ProfileEditor, getPath }
    else root.ProfileEditor = ProfileEditor
})(globalThis)
