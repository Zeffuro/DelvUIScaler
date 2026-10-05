const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const pako = require('../../assets/vendor/pako-2.1.0.min.js')
const codec = require('../../src/profile/codec.js')
const limits = require('../../src/profile/limits.js')
const Service = require('../../src/profile/codec-service.js')
const demo = require('../../src/examples/profiles.js').DelvUI

function encoded(text) { return Buffer.from(pako.deflate(text, { raw: true })).toString('base64') }
function bounds(overrides) { return { ...limits, ...overrides } }

test('streaming inflation stops before retaining output beyond the aggregate budget', () => {
    let generated = 0
    class ObservedInflate extends pako.Inflate {
        push(...args) {
            const receive = this.onData
            this.onData = chunk => { generated += chunk.length; receive(chunk) }
            return super.push(...args)
        }
    }
    const bomb = encoded(JSON.stringify({ text: 'x'.repeat(2 * 1024 * 1024) }))
    assert.throws(() => codec.decode(bomb, { Inflate: ObservedInflate }, bounds({ inflatedBytes: 32768 })), { code: 'DECOMPRESSED_LIMIT' })
    assert.equal(generated, 49152)
    const part = encoded(JSON.stringify({ text: 'x'.repeat(100) }))
    assert.throws(() => codec.decode(`|||${part}||${part}||`, pako, bounds({ inflatedBytes: 150 })), { code: 'DECOMPRESSED_LIMIT', section: 2, sections: 2 })
})

test('source, compressed and section budgets reject before expensive decode work', () => {
    const input = codec.encode(demo)
    assert.throws(() => codec.decode(input, pako, bounds({ sourceBytes: 20 })), { code: 'INPUT_TOO_LARGE' })
    assert.throws(() => codec.decode(input, pako, bounds({ compressedBytes: 1 })), { code: 'COMPRESSED_LIMIT', section: 1 })
    assert.throws(() => codec.decode(input, pako, bounds({ sections: 1 })), { code: 'SECTION_LIMIT' })
    assert.throws(() => codec.encode(demo, pako, bounds({ inflatedBytes: 1 })), { code: 'DECOMPRESSED_LIMIT' })
})

test('pinned raw-deflate codec rejects truncated data, trailing data and invalid UTF-8', () => {
    const bytes = pako.deflate(JSON.stringify({ $type: 'DelvUI.Test', text: 'héllo' }), { raw: true })
    assert.throws(() => codec.decode(Buffer.from(bytes.subarray(0, bytes.length - 1)).toString('base64')), { code: 'INVALID_DEFLATE' })
    assert.throws(() => codec.decode(Buffer.concat([bytes, Buffer.from([1])]).toString('base64')), { code: 'INVALID_DEFLATE' })
    assert.throws(() => codec.decode(encoded(new Uint8Array([123, 34, 88, 34, 58, 34, 255, 34, 125]))), { code: 'INVALID_UTF8' })
    assert.deepEqual(codec.decode(encoded('\ufeff{"$type":"DelvUI.Test","text":"héllo"}')).configs[0], { $type: 'DelvUI.Test', text: 'héllo' })
})

test('all 91 slots round trip without dropping unknown configuration values', () => {
    const profile = { piped: true, kind: 'DelvUI', configs: Array.from({ length: 91 }, (_, index) =>
        ({ $type: 'DelvUI.Future.Type', index, Nested: { Unknown: [index, 'é', null], $type: 'Future.Type' } })) }
    assert.deepEqual(codec.decode(codec.encode(profile)), profile)
})

function fakeWorker() {
    return { sent: [], terminated: false, postMessage(message) { this.sent.push(message) }, terminate() { this.terminated = true },
        reply(message) { this.onmessage({ data: message }) } }
}

test('worker client resolves concurrent requests by ID and returns structured section errors', async () => {
    const worker = fakeWorker(), service = new Service({ workerFactory: () => worker })
    const first = service.decode('one'), second = service.encode(demo, 1.5)
    const failure = assert.rejects(first, { code: 'INVALID_JSON', section: 2, sections: 91 })
    worker.reply({ id: 2, ok: true, result: 'encoded' })
    worker.reply({ id: 1, ok: false, error: { code: 'INVALID_JSON', message: 'section invalid', section: 2, sections: 91 } })
    assert.equal(await second, 'encoded')
    await failure
    assert.equal(service.pending.size, 0)
    service.cancel()
})

test('cancellation terminates work, rejects pending requests and ignores stale replies', async () => {
    const workers = [], service = new Service({ workerFactory: () => { const worker = fakeWorker(); workers.push(worker); return worker } })
    const pending = service.decode('one'), rejected = assert.rejects(pending, { code: 'CANCELLED', name: 'AbortError' })
    service.cancel()
    await rejected
    assert.equal(workers[0].terminated, true)
    const next = service.decode('two')
    workers[0].reply({ id: 2, ok: true, result: 'stale' })
    workers[1].reply({ id: 2, ok: true, result: 'fresh' })
    assert.equal(await next, 'fresh')
    service.cancel()
})

test('timeout and worker load failure settle every pending request', async () => {
    const worker = fakeWorker(), service = new Service({ workerFactory: () => worker, timeoutMs: 10 })
    const first = service.decode('one'), second = service.decode('two')
    await Promise.all([assert.rejects(first, { code: 'TIMEOUT' }), assert.rejects(second, { code: 'CANCELLED' })])
    assert.equal(worker.terminated, true)
    const broken = fakeWorker(), next = new Service({ workerFactory: () => broken })
    const promise = next.decode('one'), rejected = assert.rejects(promise, { code: 'WORKER_FAILED' })
    broken.onerror({ preventDefault() {} })
    await rejected
})

test('actual worker script uses local dependencies and scales its transferred copy', () => {
    const directory = path.resolve(__dirname, '../../src/profile'), replies = []
    const context = vm.createContext({ TextDecoder, TextEncoder, Uint8Array, atob, btoa, structuredClone, postMessage: message => replies.push(message) })
    context.self = context
    context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.resolve(directory, file), 'utf8'), context))
    vm.runInContext(fs.readFileSync(path.join(directory, 'codec-worker.js'), 'utf8'), context)
    const profile = structuredClone(demo), original = structuredClone(profile)
    context.onmessage({ data: { id: 1, operation: 'encode', profile, factor: 1.5 } })
    assert.equal(replies[0].ok, true)
    assert.deepEqual(codec.decode(replies[0].result), codec.scaled(original, 1.5))
    context.onmessage({ data: { id: 2, operation: 'decode', text: 'bad!' } })
    assert.equal(replies[1].ok, false)
    assert.equal(replies[1].error.code, 'INVALID_SECTION')
})
