(function (root) {
    const sceneApi = typeof module !== 'undefined' ? require('./scene.js') : root.PreviewScene
    const ui = typeof module !== 'undefined' ? require('./adapters/delvui.js') : root.DelvUIPreview
    const cd = typeof module !== 'undefined' ? require('./adapters/delvcd.js') : root.DelvCDPreview
    function jobs(profile) {
        return profile.configs.filter(c => String(c.$type).includes('.Jobs.')).map(sceneApi.typeName)
    }
    function build(profile, width, height, options = {}) {
        const scene = sceneApi.create(profile, width, height, options)
        if (profile.kind === 'DelvUI') ui.build(profile, scene)
        else if (profile.kind === 'DelvCD') cd.build(profile, scene)
        else scene.skipped.push('This export can be scaled, but its layout format is not supported.')
        for (const e of scene.elements) {
            e.offscreen = e.x < 0 || e.y < 0 || e.x + e.width > width || e.y + e.height > height
        }
        return { elements: scene.elements, skipped: scene.skipped, width, height }
    }
    const api = { ...sceneApi, build, jobs }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewModel = api
})(globalThis)
