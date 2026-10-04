(function (root) {
    const jobs = typeof module !== 'undefined' ? require('./job-data.js') : root.PreviewJobData
    const jobGroups = [[19, 21, 32, 37, 1, 3], [25, 27, 35, 36, 42, 7, 26],
        [20, 22, 30, 34, 39, 41, 2, 4, 29], [23, 31, 38, 5], [24, 28, 33, 40, 6]]
    const jobEnums = {
        Astrologian: { 0: [1, 'Card1', 'Balance'], 1: [1, 'Card2', 'Arrow'],
            2: [1, 'Card3', 'Spire'], 3: [1, 'Crown_Card', 'Lord of Crowns'] },
        Bard: { 0: [3, 'Active_Song', "The Wanderer's Minute"], 1: [1, 'Last_Active_Song', "Mage's Ballad"], 5: [3] },
        BlackMage: { 3: [2, 'Element', 'Astral Fire'] },
        Dancer: { 3: [3], 4: [1], 5: [2], 6: [3], 7: [4] },
        Pictomancer: { 5: [1, 'Creature_Motif', 'Pom'], 6: [1, 'Creature_Canvas', 'Pom'], 7: [1, 'Creature_Portrait', 'Moogle'] },
        RedMage: { 3: [0] },
        Summoner: { 1: [2, 'Next_Summon', 'Phoenix'], 2: [2, 'Active_Summon', 'Phoenix'],
            4: [0], 5: [1], 6: [1], 7: [1, 'Active_Attunement', 'Ifrit'] }
    }
    function compare(value, op, expected) {
        return [value === expected, value !== expected, value < expected, value > expected, value <= expected, value >= expected][op ?? 3] || false
    }
    function state(options) {
        const mode = options.state || 'layout'
        return { mode, combat: mode === 'combat' || mode === 'pvp', pvp: mode === 'pvp',
            duty: ['combat', 'pvp'].includes(mode), drawn: ['combat', 'pvp'].includes(mode),
            island: mode === 'island', saucer: mode === 'saucer', performing: mode === 'performing',
            crafting: mode === 'crafting', gathering: mode === 'gathering', target: options.hasTarget !== false }
    }
    function visible(config, options, cd = true) {
        const s = state(options), c = config || {}
        if (c.AlwaysHide) return false
        if (s.mode === 'layout') return true
        if (!cd) {
            if (c.Enabled === false) return true
            if (c.ShowInDuty && s.duty || c.ShowOnWeaponDrawn && s.drawn || c.ShowWhileCrafting && s.crafting ||
                c.ShowWhileGathering && s.gathering || c.ShowInParty && options.partyCount > 1 ||
                c.ShowInIslandSanctuary && s.island || c.ShowInPvP && s.pvp || c.ShowWhileTargetExists && s.target) return true
            return !(c.HideOutsideOfCombat && !s.combat || c.HideInCombat && s.combat || c.HideInGoldSaucer && s.saucer ||
                c.HideOnFullHP && options.hpPercent === 100 || c.HideInDuty && s.duty ||
                c.HideInIslandSanctuary && s.island || c.HideInPvP && s.pvp)
        }
        if (c.HideInPvP && s.pvp || c.HideOutsidePvP && !s.pvp || c.HideInCombat && s.combat ||
            c.HideOutsideCombat && !s.combat || c.HideOutsideDuty && !s.duty || c.HideWhilePerforming && s.performing ||
            c.HideInGoldenSaucer && s.saucer || c.HideWhenSheathed && !s.drawn &&
            !(c.IgnoreInCombat && s.combat || c.IgnoreInDuty && s.duty) ||
            c.HideIfLevel && compare(options.level ?? 100, c.HideIfLevelOp, c.HideIfLevelValue)) return false
        const job = Number(options.jobId ?? 19), group = Number(c.ShowForJobTypes || 0)
        if (group === 1) return (c.CustomJobList || String(c.CustomJobString || '').split(',')).some(j => j === job || j === jobs.find(j => j.jobId === job)?.name)
        if (group >= 2 && group <= 6) return jobGroups[group - 2].includes(job)
        if (group === 7) return [...jobGroups[0], ...jobGroups[2], ...jobGroups[3]].includes(job)
        if (group === 8) return [...jobGroups[1], ...jobGroups[4]].includes(job)
        if (group === 9) return jobGroups.flat().includes(job)
        if (group === 10) return job >= 8 && job <= 18
        if (group === 11) return job >= 8 && job <= 15
        if (group === 12) return job >= 16 && job <= 18
        return true
    }
    function data(trigger, options) {
        const type = String(trigger?.$type || '').split(',')[0].split('.').pop()
        const name = trigger.TriggerData?.find(item => item.Name)?.Name || options.dummyName
        const timer = Math.max(0, Number(options.cooldown ?? 12)), stacks = Math.max(0, Number(options.charges ?? 3))
        if (/CharacterState/.test(type)) {
            const hp = options.hpPercent ?? 72
            const fields = { Name: name, Name_First: String(name).split(' ')[0], Name_Last: String(name).split(' ').at(-1),
                Level: options.level ?? 100, Hp: hp * 1000, MaxHp: 100000, HpPercent: hp,
                Mp: 7200, MaxMp: 10000, Cp: 50, MaxCp: 100, Gp: 50, MaxGp: 100,
                Shield: 25000, MaxShield: 100000, ShieldPercent: 25, Distance: 10, HasPet: false, Value: 0 }
            return { type, fields, conditions: ['Hp', 'Mp', 'Cp', 'Gp', 'Level', 'Distance', 'Shield', 'ShieldPercent', 'HpPercent'],
                progress: ['Hp', 'Mp', 'Cp', 'Gp', 'Shield'], maxima: [100000, 10000, 100, 100, 100000], integer: ['Level'] }
        }
        if (/JobGauge/.test(type)) {
            const meta = jobs[trigger.JobIndex || 0] || jobs[0], ratio = Math.max(0, Math.min(1, (options.gauge ?? 50) / 100))
            const fields = { Name: meta.name, Value: 0 }
            const enums = {}
            for (const [key, kind] of Object.entries(meta.fields)) {
                fields[key] = kind === 'bool' ? ratio > 0 : kind === 'string' ? 'None' :
                    key.startsWith('Max_') ? /Chakra/.test(key) ? 10 : /Repertoire|Attunement/.test(key) ? 4 : /Anguine/.test(key) ? 5 : 3 : 0
            }
            for (const [index, [sample, field, name]] of Object.entries(jobEnums[meta.name] || {})) {
                enums[index] = ratio > 0 ? sample : 0
                if (field) fields[field] = ratio > 0 ? name : 'None'
            }
            if (meta.name === 'Bard') fields.Max_Repertoire_Stacks = ratio > 0 ? 3 : 0
            if (meta.name === 'Summoner') {
                fields.Max_Attunement_Stacks = ratio > 0 ? 2 : 0
                if (ratio === 0) { fields.Next_Summon = 'Bahamut'; enums[1] = 1 }
            }
            meta.progress.forEach((key, i) => {
                if (typeof key !== 'string') return
                const maximum = typeof meta.maxima[i] === 'number' ? meta.maxima[i] : fields[meta.maxima[i]] || 1
                fields[key] = meta.fields[key] === 'int' ? Math.floor(maximum * ratio) : maximum * ratio
            })
            if (meta.name === 'Dancer') enums[3] = fields.Dancing && fields.Completed_Steps < 4 ? enums[4 + fields.Completed_Steps] : 0
            if (meta.name === 'RedMage') enums[3] = fields.White_Mana === fields.Black_Mana ? 0 : fields.White_Mana > fields.Black_Mana ? 1 : 2
            const testValues = meta.tests.map((field, index) => field ? Number(fields[field]) || 0 : enums[index] ?? 0)
            return { type, fields, conditions: meta.conditions, progress: meta.progress,
                maxima: meta.maxima.map(value => typeof value === 'number' ? value : fields[value]), meta,
                integer: Object.keys(meta.fields).filter(key => meta.fields[key] === 'int'), testValues }
        }
        const status = /Status/.test(type), item = /ItemCooldown/.test(type)
        const prefix = status ? 'Status' : item ? 'Item_Cooldown' : 'Cooldown'
        const active = !status || options.showStatuses !== false && options.statusCount !== 0
        const maximum = item ? stacks : trigger.TriggerData?.[0]?.MaxStacks || 3
        const fields = { Name: name, Value: item ? 0 : active ? timer : 0 }
        if (item) { fields.Item_Keybind = '1'; fields.Item_Keybind_Formatted = '1' }
        else if (!status) { fields.Keybind = '1'; fields.Keybind_Formatted = '1' }
        fields[`${prefix}_Timer`] = active ? timer : 0
        fields[`Max_${prefix}_Timer`] = 30
        fields[`${prefix}_Stacks`] = active ? stacks : 0
        fields[`Max_${prefix}_Stacks`] = maximum
        return { type, fields, conditions: [`${prefix}_Timer`, `${prefix}_Stacks`, `Max_${prefix}_Stacks`],
            progress: [`${prefix}_Timer`, `${prefix}_Stacks`], maxima: [30, maximum], active,
            integer: [`${prefix}_Stacks`, `Max_${prefix}_Stacks`] }
    }
    const value = (source, field) => typeof field === 'number' ? field : Number(source?.fields[field]) || 0
    function triggered(trigger, source, options) {
        if ((options.state || 'layout') === 'layout') return true
        if (trigger.TriggerSource > 0 && options.hasTarget === false) return false
        if (/CharacterState/.test(source.type)) {
            for (const key of ['Hp', 'Mp', 'Cp', 'Gp', 'Shield', 'Level']) {
                if (!trigger[key]) continue
                const maximum = source.fields[`Max${key}`]
                const percentage = trigger[`${key}Percent`] && (!trigger[`Max${key}`] || key === 'Shield')
                const actual = percentage ? source.fields[key] / maximum * 100 : source.fields[key]
                if (!compare(actual, trigger[`${key}Op`], trigger[`Max${key}`] ? maximum : trigger[`${key}Value`])) return false
            }
            return !trigger.PetCheck || (trigger.PetValue === 0 ? source.fields.HasPet : !source.fields.HasPet)
        }
        if (/JobGauge/.test(source.type)) {
            if (Number(options.jobId ?? 19) !== source.meta.jobId) return false
            const arrays = String(trigger.RawData || '').split('|').map(part => part.split(',').map(Number))
            return source.meta.tests.every((field, i) => !arrays[0]?.[i] || compare(source.testValues[i],
                source.meta.types[i] === 'Numeric' ? arrays[2]?.[i] ?? 0 : 0, arrays[1]?.[i] ?? 0))
        }
        if (/Status/.test(source.type)) {
            if (trigger.TriggerCondition === 1) return !source.active
            if (!source.active) return false
            return (!trigger.Duration || compare(value(source, source.conditions[0]), trigger.DurationOp, trigger.DurationValue)) &&
                (!trigger.StackCount || compare(value(source, source.conditions[1]), trigger.StackCountOp, trigger.StackCountValue))
        }
        for (const key of ['Cooldown', 'ChargeCount']) {
            if (trigger[key] && !compare(value(source, source.conditions[key === 'Cooldown' ? 0 : 1]), trigger[`${key}Op`], trigger[`${key}Value`])) return false
        }
        for (const key of ['Combo', 'Usable', 'RangeCheck', 'LosCheck', 'HighlightCheck']) {
            const positive = key === 'Usable' || key === 'RangeCheck' || key === 'LosCheck'
            const property = key === 'RangeCheck' ? 'RangeValue' : key === 'LosCheck' ? 'LosValue' : key === 'HighlightCheck' ? 'HighlightValue' : key + 'Value'
            if (trigger[key] && (trigger[property] === 0) !== positive) return false
        }
        return trigger.CombatType === undefined || trigger.CombatType === (state(options).pvp ? 1 : 0)
    }
    function evaluate(config, options) {
        const triggers = config?.TriggerOptions || []
        const sources = triggers.map(trigger => data(trigger, options))
        const results = triggers.map((trigger, i) => triggered(trigger, sources[i], options))
        let active = results[0] ?? false
        for (let i = 1; i < results.length; i++) {
            active = triggers[i].Condition === 1 ? active || results[i] : triggers[i].Condition === 2 ? active !== results[i] : active && results[i]
        }
        return { active, sources, source: sources[Math.max(0, results.indexOf(true))] }
    }
    function condition(conditions, sources) {
        return (conditions || []).findIndex(c => {
            const source = sources[c.TriggerDataSourceIndex || 0]
            return source && compare(value(source, source.conditions[c.Source || 0] ?? 0), c.Op, c.Value)
        })
    }
    function progress(style, sources, options) {
        const source = sources[style.ProgressDataSourceIndex || 0], index = style.ProgressDataSourceFieldIndex || 0
        const maximum = source?.maxima[index]
        return maximum > 0 ? Math.max(0, Math.min(1, value(source, source.progress[index]) / maximum)) : source ? 0 : (options.hpPercent ?? 72) / 100
    }
    function text(format, sources, rounding = 0) {
        return String(format).replace(/\[(\w+)(?::(\w+))?(?:\.(\d+))?\]/g, (match, key, style, digits) => {
            const source = sources.find(source => Object.keys(source.fields).some(field => field.toLowerCase() === key))
            if (!source) return match
            const field = Object.keys(source.fields).find(field => field.toLowerCase() === key)
            let value = source.fields[field]
            if (typeof value !== 'number' || source.integer?.includes(field)) {
                value = String(value)
                if (style === 'upper') value = value.toUpperCase()
                if (style === 'lower') value = value.toLowerCase()
                return digits !== undefined ? value.slice(0, Number(digits)) : value
            }
            let suffix = ''
            if (style === 't' && value > 3600) return `${Math.floor(value / 3600)}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`
            if (style === 't' && value > 60) return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
            if (style === 'k') { const divisor = value >= 1000000 ? 1000000 : value >= 1000 ? 1000 : 1; suffix = divisor === 1000000 ? 'M' : divisor === 1000 ? 'K' : ''; value /= divisor }
            const precision = Math.min(6, Number(digits || 0)), factor = 10 ** precision
            const scaled = value * factor, floor = Math.floor(scaled)
            const nearest = scaled - floor === .5 ? floor % 2 === 0 ? floor : floor + 1 : Math.round(scaled)
            value = (rounding === 1 ? Math.ceil(scaled) : rounding === 2 ? nearest : Math.trunc(scaled)) / factor
            return value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision, useGrouping: style !== 't' }) + suffix
        })
    }
    const api = { jobs, compare, state, visible, data, triggered, evaluate, condition, progress, text }
    if (typeof module !== 'undefined') module.exports = api
    else root.PreviewState = api
})(globalThis)
