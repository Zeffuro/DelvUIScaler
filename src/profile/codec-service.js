(function (root) {
    const limits = typeof module !== 'undefined' ? require('./limits.js') : root.ProfileLimits
    const scriptUrl = typeof document !== 'undefined' ? document.currentScript?.src : null
    const defaultUrl = scriptUrl ? new URL('codec-worker.js', scriptUrl).href : 'src/profile/codec-worker.js'
    function failure(code, message) {
        return Object.assign(new Error(message), { code, name: code === 'CANCELLED' ? 'AbortError' : 'Error' })
    }
    class ProfileCodecService {
        constructor({ workerFactory = url => new Worker(url), workerUrl = defaultUrl, timeoutMs = limits.timeoutMs } = {}) {
            this.workerFactory = workerFactory
            this.workerUrl = workerUrl
            this.timeoutMs = timeoutMs
            this.worker = null
            this.pending = new Map()
            this.sequence = 0
        }
        start() {
            if (this.worker) return this.worker
            const worker = this.workerFactory(this.workerUrl)
            this.worker = worker
            worker.onmessage = event => {
                if (this.worker !== worker) return
                const message = event.data, request = this.pending.get(message?.id)
                if (!request) return
                clearTimeout(request.timer)
                this.pending.delete(message.id)
                if (message.ok) request.resolve(message.result)
                else request.reject(Object.assign(failure(message.error?.code || 'CODEC_ERROR', message.error?.message || 'Could not process this profile.'),
                    { section: message.error?.section, sections: message.error?.sections }))
            }
            worker.onerror = event => {
                if (this.worker !== worker) return
                event.preventDefault?.()
                this.reset(failure('WORKER_FAILED', 'The profile worker could not load. Reload this page.'))
            }
            worker.onmessageerror = () => {
                if (this.worker === worker) this.reset(failure('WORKER_FAILED', 'Could not read the profile worker response.'))
            }
            return worker
        }
        reset(error, timedOutId) {
            this.worker?.terminate()
            this.worker = null
            for (const [id, request] of this.pending) {
                clearTimeout(request.timer)
                request.reject(timedOutId !== undefined && id !== timedOutId ? failure('CANCELLED', 'Profile processing was cancelled.') : error)
            }
            this.pending.clear()
        }
        cancel() { this.reset(failure('CANCELLED', 'Profile processing was cancelled.')) }
        request(operation, payload) {
            return new Promise((resolve, reject) => {
                let worker
                try { worker = this.start() }
                catch { reject(failure('WORKER_FAILED', 'The profile worker could not load. Reload this page.')); return }
                const id = ++this.sequence
                const timer = setTimeout(() => {
                    if (this.pending.has(id)) this.reset(failure('TIMEOUT', 'Profile processing took too long. Try a smaller profile.'), id)
                }, this.timeoutMs)
                this.pending.set(id, { resolve, reject, timer })
                try { worker.postMessage({ id, operation, ...payload }) }
                catch { clearTimeout(timer); this.pending.delete(id); reject(failure('INVALID_INPUT', 'Could not send this profile for processing.')) }
            })
        }
        decode(text) {
            if (typeof text !== 'string') return Promise.reject(failure('INVALID_INPUT', 'Expected profile text.'))
            if (text.length > limits.sourceBytes || new TextEncoder().encode(text).byteLength > limits.sourceBytes) {
                return Promise.reject(failure('INPUT_TOO_LARGE', 'Profile exceeds the 8 MiB input limit.'))
            }
            return this.request('decode', { text })
        }
        encode(profile, factor) { return this.request('encode', { profile, factor }) }
    }
    if (typeof module !== 'undefined') module.exports = ProfileCodecService
    else root.ProfileCodecService = ProfileCodecService
})(globalThis)
