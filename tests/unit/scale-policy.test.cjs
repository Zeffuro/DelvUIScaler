const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const codec = require('../../src/profile/codec.js');
const policy = require('../../src/profile/scale-policy.js');
const schema = require('../../src/profile/scale-schema.js');
const fixtures = require('../fixtures/scale-profiles.cjs');
const factors = [1, .75, 1080 / 1440, 1440 / 1080, 1600 / 1440, 2160 / 1440, 2, .05];
const float = (value, factor) => Math.round(value * factor * 100) / 100;
const typed = (type, fields) => ({ $type: type, ...fields });
const serialized = value => JSON.parse(JSON.stringify(value));
function numericPaths(value, path = '', result = new Map()) {
    for (const [key, child] of Object.entries(value)) {
        const childPath = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
        if (typeof child === 'number') result.set(childPath, child);
        else if (child && typeof child === 'object') numericPaths(child, childPath, result);
    }
    return result;
}

test('current DelvUI export scales pixels and preserves range, timing, percentages and unknown fields', () => {
    const original = structuredClone(fixtures.delvui);
    for (const factor of factors) {
        const changed = codec.scaled(fixtures.delvui, factor);
        const [player, target, mage, nameplate, gcd] = changed.configs;
        assert.deepEqual(player.RangeConfig, original.configs[0].RangeConfig);
        assert.deepEqual(player.SmoothHealthConfig, original.configs[0].SmoothHealthConfig);
        assert.deepEqual(player.ShieldConfig, original.configs[0].ShieldConfig);
        assert.equal(target.ShieldConfig.Height, Math.round(11 * factor));
        assert.equal(mage.ManaBar.ThresholdConfig.MarkerSize, Math.round(3 * factor));
        assert.equal(mage.ManaBar.ThresholdConfig.Value, 7500);
        assert.equal(mage.ManaBar.ThresholdConfig.ThresholdType, 1);
        assert.equal(player.BorderThickness, Math.round(3 * factor));
        assert.equal(player.Position.X, float(-225, factor));
        assert.equal(player.Position.Y, float(176.25, factor));
        assert.equal(player.LeftLabelConfig.Position.Y, float(-.25, factor));
        assert.equal(nameplate.BarConfig.TargetedBorderThickness, Math.round(3 * factor));
        assert.equal(nameplate.BarConfig.SizeWhenTargeted.X, float(175, factor));
        assert.deepEqual(nameplate.RangeConfig, original.configs[3].RangeConfig);
        assert.equal(gcd.CircleRadius, Math.round(22 * factor));
        assert.equal(gcd.CircleStartAngle, 92);
        assert.equal(gcd.GCDThreshold, 1.7);
        assert.equal(player.FutureWidth, 43);
        assert.deepEqual(player.Future, original.configs[0].Future);
        assert.deepEqual(codec.decode(codec.encode(changed)), serialized(changed));
        assert.equal(Object.keys(changed.configs[5].Fonts)[0], '$type');
    }
    assert.deepEqual(fixtures.delvui, original);
});

test('shield percentages default to invariant without HeightInPixels and explicit types override nested inference', () => {
    const profile = { kind: 'DelvUI', piped: true, configs: [typed('DelvUI.Interface.GeneralElements.UnitFrameConfig', {
        ShieldConfig: { Height: 28 }, SmoothHealthConfig: { Velocity: 23 },
        ThresholdConfig: typed('DelvUI.Interface.Jobs.BlackMakeManaBarThresholdConfig', { MarkerSize: 3 }),
        FutureConfig: typed('Future.Config.ShieldConfig', { Height: 28, HeightInPixels: true, MarkerSize: 5 }),
        RangeConfig: { Range: 37, AdditionalRange: 19 }
    })] };
    const changed = codec.scaled(profile, 1.5).configs[0];
    assert.equal(changed.ShieldConfig.Height, 28);
    assert.equal(changed.SmoothHealthConfig.Velocity, 23);
    assert.equal(changed.ThresholdConfig.MarkerSize, 5);
    assert.equal(changed.FutureConfig.Height, 28);
    assert.equal(changed.FutureConfig.MarkerSize, 5);
    assert.deepEqual(changed.RangeConfig, profile.configs[0].RangeConfig);
});

test('DelvCD collection wrappers and generic conditional styles retain owners and scalar units', () => {
    for (const factor of factors) {
        const changed = codec.scaled(fixtures.delvcd, factor);
        const root = changed.configs[0], [icon, bar] = root.ElementList.UIElements.$values;
        assert.equal(root.GroupConfig.DynamicMaxPerRow, 7);
        assert.equal(root.GroupConfig.DynamicGrowthDir, 3);
        assert.equal(root.GroupConfig.DynamicOffset.X, float(57, factor));
        assert.equal(icon.IconStyleConfig.BorderThickness, Math.round(3 * factor));
        assert.equal(icon.IconStyleConfig.ProgressLineThickness, Math.round(5 * factor));
        assert.equal(icon.IconStyleConfig.GlowThickness, Math.round(7 * factor));
        for (const key of ['GlowSegments', 'GlowSpeed', 'Opacity', 'ProgressSwipeOpacity', 'IconOption', 'CustomIcon']) {
            assert.equal(icon.IconStyleConfig[key], fixtures.delvcd.configs[0].ElementList.UIElements.$values[0].IconStyleConfig[key]);
        }
        assert.deepEqual(icon.IconStyleConfig.IconColor, fixtures.delvcd.configs[0].ElementList.UIElements.$values[0].IconStyleConfig.IconColor);
        assert.equal(icon.StyleConditions.Conditions[0].Style.BorderThickness, Math.round(5 * factor));
        assert.equal(icon.StyleConditions.Conditions[0].Value, 17);
        assert.equal(icon.TriggerConfig.TriggerOptions[0].RangeValue, 35);
        assert.equal(icon.TriggerConfig.TriggerOptions[0].CooldownValue, 4.5);
        assert.equal(bar.BarStyleConfig.Radius, float(1, factor));
        assert.equal(bar.BarStyleConfig.ChunkCount, 7);
        assert.equal(bar.BarStyleConfig.NgonSides, 9);
        assert.equal(bar.StyleConditions.Conditions[0].Style.Radius, float(.75, factor));
        assert.equal(bar.StyleConditions.Conditions[0].Style.BorderThickness, Math.round(3 * factor));
        assert.deepEqual(codec.decode(codec.encode(changed)), serialized(changed));
        assert.deepEqual(policy.inspect(fixtures.delvcd).unknownNumeric, []);
    }
});

test('legacy aliases retain original metadata, topology, and untyped vector geometry', () => {
    const changed = codec.scaled(fixtures.legacy, 1.5);
    const root = changed.configs[0], group = root.AuraList.Auras[0], icon = group.AuraList.Auras[0];
    assert.equal(root.$type, 'XIVAuras.Config.XIVAurasConfig, XIVAuras');
    assert.equal(icon.$type, 'XIVAuras.UIElements.AuraIcon, XIVAuras');
    assert.equal(icon.IconStyleConfig.BorderThickness, 5);
    assert.deepEqual(icon.IconStyleConfig.Size, { X: 52.5, Y: 55.5 });
    assert.equal(root.GroupConfig.DynamicMaxPerRow, 6);
    assert.equal(icon.IconStyleConfig.GlowSegments, 9);
    assert.deepEqual(policy.inspect(fixtures.legacy).unknownNumeric, []);
    assert.deepEqual(codec.decode(codec.encode(changed)), serialized(changed));
    const drag = { X: 7, Y: -9, metadata: 'retained' };
    codec.scaleRecursive(drag, 1.333333);
    assert.deepEqual(drag, { X: 9.33, Y: -12, metadata: 'retained' });
});

test('audit is nonmutating, complete for known numeric collections, and agrees with scaling traversal', () => {
    const profile = structuredClone(fixtures.delvui), snapshot = structuredClone(profile);
    profile.configs.push(typed('DelvUI.Interface.StatusEffects.StatusEffectsBlacklistConfig', { List: { Example: 991 },
        FutureList: [2, 3], FutureVector: { X: 1, Y: 2, Z: 3 }, FutureData: { X: 1, Y: 2 },
        Color: { X: .1, Y: .2, Z: .3, W: .4 } }));
    const original = structuredClone(profile), audit = policy.inspect(profile, 1.5);
    assert.deepEqual(profile, original);
    const actual = { scaled: [], preserved: [], unknownNumeric: [] };
    codec.scaled(profile, 1.5, actual);
    assert.deepEqual(actual, audit);
    assert.ok(audit.preserved.includes('configs[6].List.Example'));
    assert.ok(audit.unknownNumeric.includes('configs[6].FutureList[0]'));
    assert.ok(audit.unknownNumeric.includes('configs[6].FutureVector.X'));
    assert.ok(audit.unknownNumeric.includes('configs[6].FutureData.X'));
    assert.equal(codec.scaled(profile, 1.5).configs[6].FutureData.X, 1);
    assert.ok(audit.unknownNumeric.includes('configs[0].Future.Width'));
    assert.ok(audit.preserved.includes('configs[0].ShieldConfig.Height'));
    assert.ok(audit.scaled.includes('configs[1].ShieldConfig.Height'));
    assert.deepEqual(snapshot, fixtures.delvui);
});

test('unknown type and field names matching JavaScript prototypes remain untouched and audited', () => {
    const item = JSON.parse('{"$type":"constructor","Width":7,"constructor":11,"__proto__":{"Height":13}}');
    const profile = { configs: [item], kind: 'Unknown', piped: false };
    const audit = policy.inspect(profile);
    assert.deepEqual(codec.scaled(profile, 1.5), profile);
    assert.deepEqual(audit.unknownNumeric, ['configs[0].Width', 'configs[0].constructor', 'configs[0].__proto__.Height']);
});

test('generic style owners do not classify future nested payloads as known styles', () => {
    const profile = { kind: 'DelvCD', piped: false, configs: [typed('DelvCD.UIElements.Icon', {
        StyleConditions: { Conditions: [{ Style: { BorderThickness: 3 }, Future: { Style: { BorderThickness: 7 } } }] }
    })] };
    const changed = codec.scaled(profile, 1.5).configs[0].StyleConditions.Conditions[0];
    assert.equal(changed.Style.BorderThickness, 5);
    assert.equal(changed.Future.Style.BorderThickness, 7);
    assert.ok(policy.inspect(profile).unknownNumeric.includes('configs[0].StyleConditions.Conditions[0].Future.Style.BorderThickness'));
});

test('pixel scalar ledger covers each verified declaration and inherited values keep native int semantics', () => {
    const ledger = [
        ['DelvUI.Helpers.TooltipBorderConfig', 'Thickness'],
        ['DelvUI.Interface.Bars.BarConfig', 'BorderThickness'],
        ['DelvUI.Interface.Bars.BarGlowConfig', 'Size'],
        ['DelvUI.Interface.Bars.ChunkedBarConfig', 'Padding'],
        ['DelvUI.Interface.Bars.ThresholdConfig', 'MarkerSize'],
        ['DelvUI.Interface.EnemyList.EnemyListConfig', 'VerticalPadding'],
        ['DelvUI.Interface.EnemyList.EnemyListHealthBarColorsConfig', 'TargetBorderThickness'],
        ['DelvUI.Interface.GeneralElements.GCDIndicatorConfig', 'CircleRadius', 'CircleThickness'],
        ['DelvUI.Interface.GeneralElements.GridConfig', 'GridDivisionsDistance'],
        ['DelvUI.Interface.GeneralElements.NameplateBarConfig', 'TargetedBorderThickness'],
        ['DelvUI.Interface.GeneralElements.ShadowConfig', 'Thickness', 'Offset'],
        ['DelvUI.Interface.GeneralElements.TankStanceIndicatorConfig', 'Thickess'],
        ['DelvUI.Interface.Party.PartyFramesColorsConfig', 'InactiveBorderThickness', 'ActiveBorderThickness'],
        ['DelvUI.Interface.Party.PartyFramesCooldownListConfig', 'BorderThickness', 'IconActiveBorderThickness'],
        ['DelvUI.Interface.Party.PartyFramesWhosTalkingConfig', 'BorderThickness'],
        ['DelvUI.Interface.PartyCooldowns.PartyCooldownsBarConfig', 'IconActiveBorderThickness'],
        ['DelvUI.Interface.StatusEffects.StatusEffectIconBorderConfig', 'Thickness'],
        ['DelvCD.Config.IconStyleConfig', 'BorderThickness', 'ProgressLineThickness', 'GlowThickness'],
        ['DelvCD.Config.BarStyleConfig', 'BorderThickness', 'ChunkPadding', 'GlowThickness']
    ];
    for (const [type, ...keys] of ledger) for (const key of keys) {
        const item = typed(type, { [key]: 3 });
        codec.scaleRecursive(item, 1.25);
        assert.equal(item[key], 4, `${type}.${key}`);
    }
    const radius = typed('DelvCD.Config.BarStyleConfig', { Radius: 3 });
    codec.scaleRecursive(radius, 1.25);
    assert.equal(radius.Radius, 3.75);
});

test('all current declared vector geometry scales without requiring serialized metadata', () => {
    let covered = 0;
    for (const [type, [, fields]] of Object.entries(schema.types)) for (const [key, declared] of Object.entries(fields)) {
        if (declared !== 'Vector2') continue;
        const item = typed(type, { [key]: { X: 7, Y: -3.25 } });
        codec.scaleRecursive(item, 1.5);
        assert.deepEqual(item[key], { X: 10.5, Y: -4.87 }, `${type}.${key}`);
        covered++;
    }
    assert.ok(covered >= 25);
    assert.equal(Object.keys(schema.types).length, 288);
});

test('optional real DelvUI corpus classifies and round trips every source section', { skip: !process.env.DELVUI_SAMPLE }, () => {
    const original = codec.decode(fs.readFileSync(process.env.DELVUI_SAMPLE, 'utf8'));
    const audit = policy.inspect(original, 1.5);
    assert.deepEqual(audit.unknownNumeric, []);
    assert.ok(audit.scaled.length > 2000);
    for (const factor of factors) {
        const changed = codec.scaled(original, factor);
        assert.equal(changed.configs.length, original.configs.length);
        const before = numericPaths(original), after = numericPaths(changed);
        for (const path of audit.preserved) assert.equal(after.get(path), before.get(path), path);
        for (const path of audit.scaled) {
            const value = after.get(path), exact = before.get(path) * factor;
            assert.ok(Math.abs(value - exact) <= .50000001, `${path}: ${value} vs ${exact}`);
        }
        assert.deepEqual(codec.decode(codec.encode(changed)), serialized(changed));
    }
});

test('isolated position scaling follows its full owner context including partial and future styles', () => {
    for (const type of ['DelvCD.Config.BarStyleConfig', 'Future.CustomBarStyleConfig']) {
        const profile = { kind: 'DelvCD', configs: [typed('DelvCD.UIElements.Bar', {
            BarStyleConfig: typed(type, { Position: { X: 10 } })
        })] }
        const path = ['configs', 0, 'BarStyleConfig', 'Position']
        const isolated = structuredClone(profile.configs[0].BarStyleConfig.Position)
        codec.scaleRecursive(isolated, 2, null, policy.contextAt(profile, path))
        assert.deepEqual(isolated, codec.scaled(profile, 2).configs[0].BarStyleConfig.Position)
        assert.equal(isolated.X, type.startsWith('Future.') ? 10 : 20)
    }
    for (const profile of Object.values(fixtures)) {
        const full = codec.scaled(profile, 1.5)
        function walk(value, path = []) {
            if (!value || typeof value !== 'object') return
            for (const [key, item] of Object.entries(value)) {
                const next = [...path, Array.isArray(value) ? Number(key) : key]
                if (key === 'Position') {
                    const isolated = structuredClone(item)
                    codec.scaleRecursive(isolated, 1.5, null, policy.contextAt(profile, next))
                    assert.deepEqual(isolated, next.reduce((value, key) => value[key], full))
                }
                walk(item, next)
            }
        }
        walk(profile)
    }
})
