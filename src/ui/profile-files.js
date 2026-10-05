class ProfileFiles {
    constructor({ begin, load, status, exported }) {
        this.begin = begin
        this.load = load
        this.status = status
        this.exported = exported
        this.name = ''
        this.pending = 0
        const input = document.getElementById('profileFile')
        input.addEventListener('change', () => { this.open(input.files[0]); input.value = '' })
        const drop = document.getElementById('profileDrop')
        drop.addEventListener('dragover', event => {
            if (!Array.from(event.dataTransfer.types).includes('Files')) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            drop.classList.add('drag-over')
        })
        drop.addEventListener('dragleave', event => {
            if (!drop.contains(event.relatedTarget)) drop.classList.remove('drag-over')
        })
        drop.addEventListener('drop', event => {
            if (!event.dataTransfer.files.length) return
            event.preventDefault()
            drop.classList.remove('drag-over')
            if (event.dataTransfer.files.length !== 1) { this.status('Open one profile at a time.', 'error'); return }
            this.open(event.dataTransfer.files[0])
        })
        document.getElementById('downloadBtn').addEventListener('click', () => this.download())
    }
    cancel() { this.pending++; this.name = '' }
    async open(file) {
        if (!file) return
        const request = ++this.pending
        this.name = ''
        this.begin()
        this.status(`Opening ${file.name}…`)
        try {
            if (file.size > ProfileLimits.sourceBytes) {
                this.status('Profile exceeds the 8 MiB input limit.', 'error')
                return
            }
            const text = await file.text()
            if (request !== this.pending) return
            const loaded = await this.load(text)
            if (request === this.pending && loaded) this.name = file.name
        } catch {
            if (request === this.pending) this.status('Could not read this file.', 'error')
        }
    }
    download() {
        const { text, kind } = this.exported()
        if (!text) return
        const stem = (this.name || kind || 'profile').replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        const extension = kind === 'DelvUI' ? 'delvui' : 'txt'
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `${stem}-scaled.${extension}`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        this.status('Downloaded.', 'success', 'outputStatus')
    }
}
