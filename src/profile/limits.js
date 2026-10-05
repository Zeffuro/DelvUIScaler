(function (root) {
    const api = Object.freeze({ sourceBytes: 8 * 1024 * 1024, compressedBytes: 6 * 1024 * 1024,
        inflatedBytes: 64 * 1024 * 1024, fontBytes: 16 * 1024 * 1024, sections: 1024, timeoutMs: 30000 })
    if (typeof module !== 'undefined') module.exports = api
    else root.ProfileLimits = api
})(globalThis)
