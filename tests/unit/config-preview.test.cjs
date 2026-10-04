const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const codec = require('../../src/profile/codec.js');
const model = require('../../src/preview/model.js');
const demos = require('../../src/examples/profiles.js');
const compression = {
    inflate: bytes => zlib.inflateRawSync(bytes),
    deflate: text => zlib.deflateRawSync(text)
};

test('both export formats round trip every section, with UTF-8 names preserved', () => {
    for (const profile of Object.values(demos)) {
        const encoded = codec.encode(profile, compression);
        const decoded = codec.decode(encoded, compression);
        assert.deepEqual(decoded, profile);
        assert.equal(encoded.startsWith('|||'), profile.piped);
    }
});

test('a corrupt section rejects the entire DelvUI export', () => {
    const first = codec.encode({ ...demos.DelvUI, configs: demos.DelvUI.configs.slice(0, 1) }, compression);
    const corrupt = first.slice(0, -2) + '||not-base64!||';
    assert.throws(() => codec.decode(corrupt, compression), /section 2 of 2.*No sections were discarded/);
    assert.throws(() => codec.decode('|||bad||||bad||', compression), /section 1 of 2/);
    assert.throws(() => codec.decode('|||||||', compression), /no configuration sections/);
});

test('BOM, whitespace and standalone DelvUI elements are accepted', () => {
    const config = demos.DelvUI.configs[0];
    const encoded = zlib.deflateRawSync('\ufeff' + JSON.stringify(config)).toString('base64');
    const decoded = codec.decode(' \n' + encoded + '\r\n ', compression);
    assert.equal(decoded.kind, 'DelvUI');
    assert.equal(decoded.piped, false);
    assert.deepEqual(decoded.configs[0], config);
});

test('DelvUI separator variations and empty separators retain every nonempty config', () => {
    const parts = demos.DelvUI.configs.slice(0, 3).map(config => codec.encode({ configs: [config], piped: false }, compression));
    const decoded = codec.decode(`|||${parts[0]}|||${parts[1]}||||${parts[2]}||`, compression);
    assert.deepEqual(decoded.configs, demos.DelvUI.configs.slice(0, 3));
});

test('scaling preserves colors, enum values, conditional styles, and input objects', () => {
    const config = { $type: 'DelvCD.UIElements.Icon', IconStyleConfig: {
        Position: { X: -100, Y: 10.25 }, Size: { X: 40, Y: 40 },
        IconColor: { Vector: { X: .2, Y: .6, Z: .9, W: 1 } }, IconOption: 3,
        BorderThickness: 2, FontKey: 'Roboto_20', Direction: 1
    }, StyleConditions: { Conditions: [{ Style: { Position: { X: 80, Y: 20 }, Size: { X: 32, Y: 32 } } }] } };
    const profile = { configs: [config], kind: 'DelvCD', piped: false };
    const scaled = codec.scaled(profile, 1.5);
    const style = scaled.configs[0].IconStyleConfig;
    assert.deepEqual(style.Position, { X: -150, Y: 15.38 });
    assert.deepEqual(style.Size, { X: 60, Y: 60 });
    assert.deepEqual(style.IconColor, config.IconStyleConfig.IconColor);
    assert.equal(style.IconOption, 3);
    assert.equal(style.Direction, 1);
    assert.equal(style.FontKey, 'Roboto_30');
    assert.equal(style.BorderThickness, 3);
    assert.equal(scaled.configs[0].StyleConditions.Conditions[0].Style.Size.X, 48);
    assert.equal(config.IconStyleConfig.Size.X, 40);
    const decoded = codec.decode(codec.encode(scaled, compression), compression);
    assert.deepEqual(decoded.configs, scaled.configs);
});

test('invalid multipliers fail before changing configuration', () => {
    for (const factor of [0, -1, NaN, Infinity]) assert.throws(() => codec.scaled(demos.DelvUI, factor), /greater than zero/);
});

test('DelvUI unit-frame anchors attach mana bars to the parent, with HUD offset applied once', () => {
    const configs = structuredClone(demos.DelvUI.configs.slice(0, 3));
    configs.push({ $type: 'DelvUI.Interface.GeneralElements.HUDOptionsConfig', UseGlobalHudShift: true, HudOffset: { X: 50, Y: -30 } });
    const scene = model.build({ kind: 'DelvUI', configs }, 2560, 1440);
    const player = scene.elements.find(e => e.name === 'Player Unit Frame'), mana = scene.elements.find(e => e.name === 'Player Primary Resource');
    assert.equal(player.x, 820);
    assert.equal(player.y, 999);
    assert.equal(mana.x, player.x);
    assert.equal(mana.y, player.y + player.height + 4);
});

test('DelvUI draws only the chosen job, skips disabled ancestors and reports missing parents', () => {
    let scene = model.build(demos.DelvUI, 2560, 1440, { job: 'WhiteMageConfig' });
    assert.equal(scene.elements.filter(e => e.name.includes('White Mage')).length, 1);
    assert.equal(scene.elements.filter(e => e.name.includes('Paladin')).length, 0);
    const profile = structuredClone(demos.DelvUI);
    profile.configs.find(c => c.$type.includes('WhiteMage')).Enabled = false;
    scene = model.build(profile, 2560, 1440, { job: 'WhiteMageConfig' });
    assert.equal(scene.elements.filter(e => e.name.includes('White Mage')).length, 0);
    scene = model.build({ kind: 'DelvUI', configs: [demos.DelvUI.configs[2]] }, 2560, 1440);
    assert.equal(scene.elements.length, 0);
    assert.match(scene.skipped[0], /anchor is missing/);
});

test('DelvCD nested dynamic groups use pitch without adding icon dimensions', () => {
    const scene = model.build(demos.DelvCD, 2560, 1440);
    const icons = scene.elements.filter(e => e.kind === 'icon');
    assert.equal(icons.length, 6);
    assert.equal(icons[0].x, 1104);
    assert.equal(icons[0].y, 1060);
    assert.equal(icons[1].x - icons[0].x, 60);
    assert.equal(icons[0].width, 52);
    assert.equal(scene.elements.filter(e => e.kind === 'text').length, 6);
    assert.equal(model.build(demos.DelvCD, 2560, 1440, { showDisabled: true }).elements.filter(e => e.kind === 'icon').length, 7);
});

test('centered CD groups alternate offsets and root dynamics are ignored', () => {
    const profile = structuredClone(demos.DelvCD);
    const root = profile.configs[0];
    root.GroupConfig.IsDynamic = true;
    root.GroupConfig.DynamicOffset = { X: 900, Y: 900 };
    const group = root.ElementList.UIElements[0];
    group.GroupConfig.DynamicGrowthDir = 4;
    group.GroupConfig.DynamicMaxPerRow = 4;
    const scene = model.build(profile, 2560, 1440);
    const icons = scene.elements.filter(e => e.kind === 'icon');
    assert.deepEqual(icons.map(e => e.x), [1104, 1044, 1164, 984, 1104, 1044]);
    assert.equal(icons[4].y, 1000);
    assert.equal(scene.elements.find(e => e.kind === 'bar').x, 1104);
});

test('standalone CD labels anchor to the viewport rather than group origin', () => {
    const label = { $type: 'DelvCD.UIElements.Label', LabelStyleConfig: {
        TextFormat: 'Hello', FontKey: 'Default_20', Position: { X: 5, Y: 10 }, ParentAnchor: 0, TextAlign: 0
    } };
    const profile = { kind: 'DelvCD', configs: [{ $type: 'DelvCD.UIElements.Group', GroupConfig: { Position: { X: 700, Y: 400 } }, ElementList: { UIElements: [label] } }] };
    const text = model.build(profile, 1920, 1080, { measureText: () => 100 }).elements.find(e => e.kind === 'text');
    assert.equal(text.x, 915);
    assert.equal(text.y, 540);
});

test('DelvCD element-list tab exports and legacy icon-style fields render without mutating the export', () => {
    const icon = demos.DelvCD.configs[0].ElementList.UIElements[0].ElementList.UIElements[0];
    const profile = { kind: 'DelvCD', configs: [{ $type: 'DelvCD.Config.ElementListConfig', UIElements: [icon] }] };
    assert.equal(model.build(profile, 1920, 1080).elements.filter(e => e.kind === 'icon').length, 1);
    const legacy = structuredClone(icon);
    legacy.$type = 'XIVAuras.UIElements.AuraIcon';
    legacy.AuraIconStyleConfig = legacy.IconStyleConfig;
    delete legacy.IconStyleConfig;
    assert.equal(model.build({ kind: 'DelvCD', configs: [legacy] }, 1920, 1080).elements[0].width, 52);
    assert.ok(legacy.AuraIconStyleConfig);
});

test('scaled layouts account for pixel rounding and DelvUI one-pixel party pitch', () => {
    for (const profile of Object.values(demos)) {
        const opts = { job: 'PaladinConfig' };
        const before = model.build(profile, 2560, 1440, opts).elements;
        const after = model.build(codec.scaled(profile, 1.5), 3840, 2160, opts).elements;
        assert.equal(before.length, after.length);
        before.forEach((e, i) => {
            assert.ok(Math.abs(e.x * 1.5 - after[i].x) < 2, e.name + ' x');
            assert.ok(Math.abs(e.y * 1.5 - after[i].y) < 2, e.name + ' y');
            assert.ok(Math.abs(e.width * 1.5 - after[i].width) < 1, e.name + ' width');
        });
    }
});
