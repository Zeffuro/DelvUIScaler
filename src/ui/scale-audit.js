class ScaleAuditPanel {
    render(preview) {
        const get = id => document.getElementById(id)
        const audit = preview.scaleAudit()
        get('exportAudit').hidden = !audit
        if (!audit) { this.audit = null; return }
        get('exportAuditSummary').textContent = `${audit.scaled.length} scaled · ${audit.preserved.length} kept · ${audit.unknownNumeric.length} unknown`
        const notes = []
        if (audit.unknownNumeric.length) notes.push('Unknown values kept unchanged.')
        if (preview.model.skipped.length) notes.push(`${preview.model.skipped.length} preview settings missing.`)
        get('exportAuditNote').textContent = notes.join(' ')
        get('exportAuditNote').hidden = !notes.length
        if (this.audit === audit) return
        this.audit = audit
        const fragment = document.createDocumentFragment()
        for (const path of audit.unknownNumeric.slice(0, 50)) {
            const item = document.createElement('li')
            item.textContent = path
            fragment.append(item)
        }
        if (audit.unknownNumeric.length > 50) {
            const item = document.createElement('li')
            item.textContent = `… ${audit.unknownNumeric.length - 50} more`
            fragment.append(item)
        }
        get('exportAuditUnknown').replaceChildren(fragment)
    }
}
