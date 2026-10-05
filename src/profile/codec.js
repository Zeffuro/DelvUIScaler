(function (root) {
    const fonts = typeof module !== 'undefined' ? require('../preview/fonts.js') : root.PreviewFonts
    const limits = typeof module !== 'undefined' ? require('./limits.js') : root.ProfileLimits
    const localCompression = typeof module !== 'undefined' ? require('../../assets/vendor/pako-2.1.0.min.js') : null
    const policy = typeof module !== 'undefined' ? require('./scale-policy.js') : root.ProfileScalePolicy

    function scaleRecursive(obj, factor, audit, context) {
        policy.scaleRecursive(obj, factor, audit, context)
    }

    function codecError(code, message, cause) {
        return Object.assign(new Error(message, cause ? { cause } : undefined), { code })
    }

    function inflateJson(bytes, compression, budget, bounds) {
        const Inflate = compression.Inflate || localCompression?.Inflate
        if (!Inflate) throw codecError('COMPRESSION_UNAVAILABLE', 'The local compression library could not load. Reload this page.')
        const inflater = new Inflate({ raw: true, chunkSize: 16384 })
        const decoder = new TextDecoder('utf-8', { fatal: true })
        const chunks = []
        inflater.onData = chunk => {
            if (chunk.byteLength > bounds.inflatedBytes - budget.inflated) {
                throw codecError('DECOMPRESSED_LIMIT', 'Profile exceeds the 64 MiB decompressed limit.')
            }
            budget.inflated += chunk.byteLength
            try { chunks.push(decoder.decode(chunk, { stream: true })); }
            catch (cause) { throw codecError('INVALID_UTF8', 'Invalid UTF-8 configuration text.', cause); }
        }
        inflater.onEnd = status => { inflater.err = status; }
        inflater.push(bytes, true)
        if (inflater.err || !inflater.ended || inflater.strm.avail_in) throw codecError('INVALID_DEFLATE', 'Invalid or incomplete compressed section.')
        try { chunks.push(decoder.decode()); }
        catch (cause) { throw codecError('INVALID_UTF8', 'Invalid UTF-8 configuration text.', cause); }
        try { return JSON.parse(chunks.join('')); }
        catch (cause) { throw codecError('INVALID_JSON', 'Invalid configuration JSON.', cause); }
    }

    function decode(input, compression = root.pako || localCompression, bounds = limits) {
        if (!compression) throw codecError('COMPRESSION_UNAVAILABLE', 'The local compression library could not load. Reload this page.')
        if (typeof input !== 'string') throw codecError('INVALID_INPUT', 'Expected profile text.')
        if (input.length > bounds.sourceBytes || new TextEncoder().encode(input).byteLength > bounds.sourceBytes) {
            throw codecError('INPUT_TOO_LARGE', 'Profile exceeds the 8 MiB input limit.')
        }
        const text = input.trim()
        if (!text) throw new Error('Paste a DelvUI or DelvCD export to get started.')
        const piped = text.startsWith('|||')
        const parts = (piped ? text.replace(/^\|+|\|+$/g, '').split('||') : [text])
            .map(part => part.replace(/[\s|]/g, '')).filter(Boolean)
        if (!parts.length) throw new Error('This export contains no configuration sections.')
        if (parts.length > bounds.sections) throw codecError('SECTION_LIMIT', 'Profile contains too many configuration sections.')
        const budget = { compressed: 0, inflated: 0 }
        const configs = parts.map((part, index) => {
            try {
                const length = Math.floor(part.length * 3 / 4) - (part.endsWith('==') ? 2 : part.endsWith('=') ? 1 : 0)
                if (length > bounds.compressedBytes - budget.compressed) throw codecError('COMPRESSED_LIMIT', 'Profile exceeds the 6 MiB compressed limit.')
                const binary = atob(part)
                if (!binary.length) throw new Error('Empty section')
                if (binary.length > bounds.compressedBytes - budget.compressed) throw codecError('COMPRESSED_LIMIT', 'Profile exceeds the 6 MiB compressed limit.')
                budget.compressed += binary.length
                const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
                const config = inflateJson(bytes, compression, budget, bounds)
                if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected a configuration object')
                return config
            } catch (cause) {
                const code = typeof cause.code === 'string' ? cause.code : 'INVALID_SECTION'
                throw Object.assign(codecError(code,
                    `Could not read section ${index + 1} of ${parts.length}. ${code.endsWith('LIMIT') ? cause.message : 'Check that you copied the complete export.'} No sections were discarded.`, cause),
                { section: index + 1, sections: parts.length })
            }
        })
        const types = configs.map(config => String(config.$type || ''))
        const kind = piped || types.some(type => type.startsWith('DelvUI.')) ? 'DelvUI' :
            types.some(type => /DelvCD|XIVAuras/.test(type)) ? 'DelvCD' : 'Unknown'
        return { configs, piped, kind }
    }

    function scaled(profile, factor, audit) {
        if (!Number.isFinite(factor) || factor <= 0) throw new Error('Enter a multiplier greater than zero.')
        const copy = structuredClone(profile)
        copy.configs.forEach((config, index) => scaleRecursive(config, factor, audit, { path: `configs[${index}]` }))
        fonts.scaleProfileFonts(copy, factor)
        return copy
    }

    function encode(profile, compression = root.pako || localCompression, bounds = limits) {
        if (!compression) throw codecError('COMPRESSION_UNAVAILABLE', 'The local compression library could not load. Reload this page.')
        if (!Array.isArray(profile?.configs) || !profile.configs.length) throw codecError('INVALID_INPUT', 'Expected configuration sections.')
        if (profile.configs.length > bounds.sections) throw codecError('SECTION_LIMIT', 'Profile contains too many configuration sections.')
        const budget = { compressed: 0, inflated: 0 }
        const parts = profile.configs.map(config => {
            const json = JSON.stringify(config), size = new TextEncoder().encode(json).byteLength
            if (size > bounds.inflatedBytes - budget.inflated) throw codecError('DECOMPRESSED_LIMIT', 'Profile exceeds the 64 MiB decompressed limit.')
            budget.inflated += size
            const bytes = compression.deflate(json, { raw: true })
            if (bytes.length > bounds.compressedBytes - budget.compressed) throw codecError('COMPRESSED_LIMIT', 'Profile exceeds the 6 MiB compressed limit.')
            budget.compressed += bytes.length
            let binary = ''
            for (let i = 0; i < bytes.length; i += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
            }
            return btoa(binary)
        })
        const text = profile.piped ? `|||${parts.join('||')}||` : parts[0]
        if (text.length > bounds.sourceBytes) throw codecError('INPUT_TOO_LARGE', 'Export exceeds the 8 MiB input limit.')
        return text
    }

    const api = { decode, encode, scaled, scaleRecursive }
    if (typeof module !== 'undefined') module.exports = api
    else root.ConfigCodec = api
})(globalThis)
