importScripts('../../assets/vendor/pako-2.1.0.min.js', 'limits.js', '../preview/fonts.js', 'scale-schema.js', 'scale-policy.js', 'codec.js')

self.onmessage = event => {
    const { id, operation, text, profile, factor } = event.data || {}
    try {
        let result
        if (operation === 'decode') result = ConfigCodec.decode(text)
        else if (operation === 'encode') {
            if (factor !== undefined) {
                if (!Number.isFinite(factor) || factor <= 0) throw Object.assign(new Error('Enter a multiplier greater than zero.'), { code: 'INVALID_FACTOR' })
                profile.configs.forEach((config, index) => ProfileScalePolicy.scaleRecursive(config, factor, undefined, { path: `configs[${index}]` }))
                PreviewFonts.scaleProfileFonts(profile, factor)
            }
            result = ConfigCodec.encode(profile)
        } else throw Object.assign(new Error('Unknown profile operation.'), { code: 'INVALID_OPERATION' })
        self.postMessage({ id, ok: true, result })
    } catch (error) {
        self.postMessage({ id, ok: false, error: { code: error.code || 'CODEC_ERROR', message: error.message || 'Could not process this profile.',
            section: error.section, sections: error.sections } })
    }
}
