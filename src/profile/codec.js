(function (root) {
    const fonts = typeof module !== 'undefined' ? require('../preview/fonts.js') : root.PreviewFonts;
    const scaleKeys = new Set(['X', 'Y', 'Thickness', 'Thickess', 'Offset', 'Height',
        'Width', 'Range', 'AdditionalRange', 'Velocity', 'Size', 'BorderThickness',
        'ProgressLineThickness', 'GlowThickness', 'ChunkPadding', 'Padding', 'VerticalPadding',
        'Radius', 'CircleRadius', 'CircleThickness']);

    function scaleRecursive(obj, factor) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(item => scaleRecursive(item, factor));
            return;
        }
        const isColor = String(obj.$type || '').includes('Vector4') ||
            (typeof obj.Z === 'number' && typeof obj.W === 'number');
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (['FontID', 'FontKey', 'FontScale'].includes(key) || key === 'Size' && fonts.fontData(obj)) continue;
            if (scaleKeys.has(key) && typeof value === 'number' && !isColor) {
                const scaled = value * factor;
                // Vector coordinates are floats even when JSON writes whole numbers.
                obj[key] = Number.isInteger(value) && key !== 'X' && key !== 'Y' ? Math.round(scaled) : Math.round(scaled * 100) / 100;
            } else if (value && typeof value === 'object') {
                scaleRecursive(value, factor);
            }
        }
    }

    function decode(input, compression = root.pako) {
        if (!compression) throw new Error('The compression library could not load. Check your connection and reload.');
        const text = input.trim();
        if (!text) throw new Error('Paste a DelvUI or DelvCD export to get started.');
        const piped = text.startsWith('|||');
        const parts = (piped ? text.replace(/^\|+|\|+$/g, '').split('||') : [text])
            .map(part => part.replace(/[\s|]/g, '')).filter(Boolean);
        if (!parts.length) throw new Error('This export contains no configuration sections.');
        const configs = parts.map((part, index) => {
            try {
                const binary = atob(part);
                if (!binary.length) throw new Error('Empty section');
                const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
                const json = new TextDecoder('utf-8', { fatal: true }).decode(compression.inflate(bytes, { raw: true }));
                const config = JSON.parse(json);
                if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected a configuration object');
                return config;
            } catch (cause) {
                throw new Error(`Could not read section ${index + 1} of ${parts.length}. Check that you copied the complete export. No sections were discarded.`, { cause });
            }
        });
        const types = configs.map(config => String(config.$type || ''));
        const kind = piped || types.some(type => type.startsWith('DelvUI.')) ? 'DelvUI' :
            types.some(type => /DelvCD|XIVAuras/.test(type)) ? 'DelvCD' : 'Unknown';
        return { configs, piped, kind };
    }

    function scaled(profile, factor) {
        if (!Number.isFinite(factor) || factor <= 0) throw new Error('Enter a multiplier greater than zero.');
        const copy = structuredClone(profile);
        copy.configs.forEach(config => scaleRecursive(config, factor));
        fonts.scaleProfileFonts(copy, factor);
        return copy;
    }

    function encode(profile, compression = root.pako) {
        const parts = profile.configs.map(config => {
            const bytes = compression.deflate(JSON.stringify(config), { raw: true });
            let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            }
            return btoa(binary);
        });
        return profile.piped ? `|||${parts.join('||')}||` : parts[0];
    }

    const api = { decode, encode, scaled, scaleRecursive };
    if (typeof module !== 'undefined') module.exports = api;
    else root.ConfigCodec = api;
})(globalThis);
