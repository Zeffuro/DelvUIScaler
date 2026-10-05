const fs = require('node:fs')
const path = require('node:path')
const childProcess = require('node:child_process')
const { isDeepStrictEqual } = require('node:util')
const args = process.argv.slice(2)
const sourcePaths = args.filter(value => value !== '--write')
if (sourcePaths.length !== 2) {
    console.error('Usage: node scripts/scale-schema.cjs <DelvUI Git root> <DelvCD Git root> [--write]')
    process.exit(1)
}
const families = ['DelvUI', 'DelvCD']
const revisions = {}
const roots = sourcePaths.map((dir, index) => {
    const root = childProcess.execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
    const family = families[index]
    revisions[family] = childProcess.execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    return path.join(root, family)
})
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.cs') ? [path.join(dir, e.name)] : []); }
function strip(text) { return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|@?\$?"(?:""|\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, m => m.replace(/[^\n]/g, ' ')); }
const all = []
for (const dir of roots) for (const file of files(dir)) {
    const code = strip(fs.readFileSync(file, 'utf8'))
    const namespace = code.match(/namespace\s+([\w.]+)/)?.[1]
    if (!namespace) continue
    const classes = []
    for (const match of code.matchAll(/\b(?:class|struct)\s+(\w+)(?:<[^>{}]+>)?\s*(?::\s*([^\n{]+))?\s*\{/g)) {
        const open = match.index + match[0].length - 1
        let depth = 1, close = open + 1
        while (close < code.length && depth) { if (code[close] === '{') depth++; if (code[close] === '}') depth--; close++; }
        const owner = classes.find(c => c.open < open && c.close > close)
        const name = owner ? `${owner.name}+${match[1]}` : match[1]
        const body = code.slice(open + 1, close - 1)
        const fields = {}
        let localDepth = 0, cursor = 0
        for (const field of body.matchAll(/\bpublic\s+(?:(?:override|new|virtual|readonly)\s+)*([\w.]+(?:<[^;{}\n]+>)?(?:\[\])?\??)\s+(\w+)\s*(?=[=;{])/g)) {
            for (; cursor < field.index; cursor++) { if (body[cursor] === '{') localDepth++; if (body[cursor] === '}') localDepth--; }
            if (localDepth === 0) fields[field[2]] = field[1].replace(/\s+/g, '').replace(/\?$/, '')
        }
        const item = { name, full: `${namespace}.${name}`, base: match[2]?.split(',')[0].trim() || '', fields, file: file.replaceAll('\\', '/'), open, close }
        classes.push(item); all.push(item)
    }
}
const relevant = all.filter(c => c.full.startsWith('DelvUI.') ? c.name.endsWith('Config') || ['PluginConfigObject','MovablePluginConfigObject','AnchorablePluginConfigObject','PluginConfigColor','FontData','PartyFramesTitleLabel','ChakraBar','PerfectBalanceBar','MonkBeastChakraStacksBar','MastersGauge','DeathGauge','PartyCooldownData','PartyCooldown'].includes(c.name) : c.full.startsWith('DelvCD.Config.') || c.full.startsWith('DelvCD.UIElements.') || c.name === 'FontData')
for (let count = -1; count !== relevant.length;) {
    count = relevant.length
    const parentNames = new Set(relevant.flatMap(c => [c.full, c.name]))
    for (const c of all) if (!relevant.includes(c) && parentNames.has(c.base)) relevant.push(c)
}
const names = new Map(relevant.map(c => [`${c.full.split('.')[0]}.${c.name.split('+').pop()}`, c.full]))
function resolve(type, family) {
    if (type.startsWith(`${family}.`)) return type
    const collection = type.match(/^(List|Dictionary|SortedList|HashSet)<(.+)>$/)
    if (collection) {
        const member = collection[2].split(',').pop()
        return collection[1] === 'Dictionary' || collection[1] === 'SortedList' ? `map:${resolve(member, family)}` : `list:${resolve(member, family)}`
    }
    if (type.endsWith('[]')) return `list:${resolve(type.slice(0,-2), family)}`
    return names.get(`${family}.${type}`) || type
}
const schema = Object.fromEntries(relevant.sort((a,b) => a.full.localeCompare(b.full)).map(c => {
    const family = c.full.split('.')[0]
    return [c.full, [resolve(c.base, family), Object.fromEntries(Object.entries(c.fields).map(([k,v]) => [k, resolve(v, family)]))]]
}))
const destination = path.join(__dirname, '../src/profile/scale-schema.js')
if (args.includes('--write')) {
    const output = `(function (root) {\n    const types = {\n${Object.entries(schema).map(([key, value]) => `        ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n')}\n    }\n    const revisions = ${JSON.stringify(revisions)}\n    const api = { types, revisions }\n    if (typeof module !== 'undefined') module.exports = api\n    else root.ProfileScaleSchema = api\n})(globalThis)\n`
    fs.writeFileSync(destination, output)
    console.log('Updated declarations. Review scalar units in scale-policy.js before accepting new fields.')
} else {
    const current = require(destination)
    if (!isDeepStrictEqual(current.types, schema) || !isDeepStrictEqual(current.revisions, revisions)) {
        console.error('Schema declarations or upstream revisions differ. Use --write, review units, then run the corpus tests.')
        process.exit(1)
    }
}
console.log(`Verified ${Object.keys(schema).length} types at DelvUI ${revisions.DelvUI.slice(0, 7)} and DelvCD ${revisions.DelvCD.slice(0, 7)}.`)
