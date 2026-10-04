const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../../src/preview/adapters/delvui.js');

const anchors = [[.5, .5], [0, .5], [1, .5], [.5, 0], [0, 0], [1, 0], [.5, 1], [0, 1], [1, 1]];
const vector = (x, y) => ({ X: x, Y: y });
const config = (type, extra = {}) => ({ $type: `DelvUI.Interface.${type}, DelvUI`, Enabled: true, Position: vector(0, 0), ...extra });
const bar = (type, extra = {}) => config(type, { Size: vector(180, 40), Anchor: 0, FillColor: {}, ...extra });
const label = extra => ({ Position: vector(0, 0), Text: '[name]', Enabled: true, ...extra });

function sceneFor(configs, options = {}) {
    const profile = { kind: 'DelvUI', configs }, snapshot = JSON.stringify(profile);
    const scene = { center: { x: 500, y: 400 }, width: 1000, height: 800,
        options: { hpPercent: 76, dummyName: 'Test Player', dummyTarget: 'Test Enemy', ...options }, elements: [], skipped: [] };
    scene.util = {
        typeName: obj => String(obj?.$type || '').split(',')[0].split('.').pop(),
        friendly: name => name.replace(/Config$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
        vec: value => ({ x: Number(value?.X) || 0, y: Number(value?.Y) || 0 }),
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
        anchor: value => anchors[value] || anchors[0],
        topLeft: (point, size, value) => ({ x: point.x - size.x * (anchors[value] || anchors[0])[0], y: point.y - size.y * (anchors[value] || anchors[0])[1] })
    };
    scene.emit = (c, point, size, name, kind, disabled, editPath, extra = {}) => {
        if (disabled && !scene.options.showDisabled) return;
        const element = { ...point, width: size.x, height: size.y, name, kind, disabled, editPath, ...extra };
        scene.elements.push(element);
        return element;
    };
    scene.label = (c, rect, name, disabled, editPath, sampleName) => {
        if (c.Enabled === false && !scene.options.showDisabled) return;
        scene.elements.push({ name, kind: 'text', rect, text: c.Text, editPath, sampleName });
    };
    scene.statuses = (c, origin, name, disabled, editPath) => {
        if (disabled && !scene.options.showDisabled) return;
        scene.elements.push({ name, kind: 'area', origin, editPath, config: c });
    };
    adapter.build(profile, scene);
    assert.equal(JSON.stringify(profile), snapshot, 'building a preview must not mutate imported settings');
    return scene;
}

test('unit-frame anchored cast bars include global shift, frame anchor and icon label offset', () => {
    const scene = sceneFor([
        config('HUDOptionsConfig', { UseGlobalHudShift: true, HudOffset: vector(10, 20) }),
        bar('PlayerUnitFrameConfig', { Position: vector(-100, 100), Size: vector(200, 40), Anchor: 4 }),
        bar('PlayerCastbarConfig', { Position: vector(0, 5), Size: vector(100, 20), AnchorToUnitFrame: true,
            UnitFrameAnchor: 6, Anchor: 3, ShowIcon: true, CastNameLabel: label({ TextAnchor: 1 }), CastTimeLabel: label({ TextAnchor: 2 }) })
    ]);
    const cast = scene.elements.find(e => e.name === 'Player Castbar');
    assert.deepEqual([cast.x, cast.y], [460, 565]);
    assert.deepEqual(cast.editPath, ['configs', 2, 'Position']);
    assert.equal(scene.elements.find(e => e.name.endsWith('Cast Name Label')).rect.x, 480);
    assert.equal(scene.elements.find(e => e.name.endsWith('Cast Time Label')).rect.x, 460);
});

test('party frames align actual content inside configured space and use source one-pixel pitch', () => {
    const scene = sceneFor([
        config('PartyFramesConfig', { Position: vector(-300, -100), Rows: 4, Columns: 2, BarsAnchor: 8, FillRowsFirst: true }),
        bar('PartyFramesHealthBarsConfig', { Size: vector(100, 20), Padding: vector(4, 3), NameLabelConfig: label() }),
        bar('PartyFramesManaBarConfig', { Size: vector(100, 6), HealthBarAnchor: 6, Anchor: 6 })
    ], { partyCount: 3 });
    const members = scene.elements.filter(e => /^Party Frames \/ member \d+$/.test(e.name));
    assert.deepEqual(members.map(e => [e.x, e.y]), [[200, 346], [303, 346], [200, 368]]);
    assert.deepEqual(members[2].editPath, ['configs', 0, 'Position']);
    assert.equal(members[2].note, 'Moves all party frames');
    const mana = scene.elements.find(e => /member 3 \/ Party Frames Mana Bar/.test(e.name));
    assert.deepEqual([mana.x, mana.y], [200, 382]);
    assert.deepEqual(mana.editPath, ['configs', 2, 'Position']);
    assert.match(mana.note, /Shared by every party member/);
});

test('party column-first flow and enemy upward growth are distinct source layouts', () => {
    const party = sceneFor([
        config('PartyFramesConfig', { Rows: 2, Columns: 2, BarsAnchor: 4, FillRowsFirst: false }),
        bar('PartyFramesHealthBarsConfig', { Size: vector(100, 20), Padding: vector(0, 0) })
    ], { partyCount: 3 });
    assert.deepEqual(party.elements.map(e => [e.x, e.y]), [[500, 400], [500, 419], [599, 400]]);
    const enemies = sceneFor([
        config('EnemyListConfig', { GrowthDirection: 1, VerticalPadding: 7 }),
        bar('EnemyListHealthBarConfig', { Size: vector(100, 20), NameLabel: label() }),
        config('EnemyListBuffsConfig', { HealthBarAnchor: 5, Size: vector(80, 20) })
    ], { enemyCount: 3 });
    const frames = enemies.elements.filter(e => e.kind === 'bar');
    assert.deepEqual(frames.map(e => [e.x, e.y]), [[500, 400], [500, 373], [500, 346]]);
    assert.deepEqual(enemies.elements.find(e => /enemy 3 \/ Enemy List Buffs/.test(e.name)).origin, { x: 600, y: 346 });
});

test('GCD modes use parent Position and Anchor, with circular stroke bounds', () => {
    const circular = sceneFor([config('GCDIndicatorConfig', { Position: vector(30, 40), Anchor: 4,
        CircularMode: true, CircleRadius: 20, CircleThickness: 8, CircleStartAngle: 90 })]);
    assert.deepEqual([circular.elements[0].x, circular.elements[0].y, circular.elements[0].width], [526, 436, 48]);
    assert.equal(circular.elements[0].startAngle, 90);
    const regular = sceneFor([config('GCDIndicatorConfig', { Position: vector(30, 40), Anchor: 4, Bar:
        bar('GCDBarConfig', { Position: vector(999, 999), Anchor: 8, Size: vector(100, 10) }) })]);
    assert.deepEqual([regular.elements[0].x, regular.elements[0].y], [530, 440]);
    assert.deepEqual(regular.elements[0].editPath, ['configs', 0, 'Position']);
});

test('selected job child coordinates and chunks preserve each original child edit path', () => {
    const scene = sceneFor([
        config('Jobs.PaladinConfig', { Position: vector(0, 100), OathGauge:
            bar('Bars.ChunkedProgressBarConfig', { Position: vector(0, -50), Size: vector(200, 20), Padding: 4, Label: label({ Text: '' }) }) }),
        config('Jobs.WarriorConfig', { BeastGauge: bar('Bars.ChunkedProgressBarConfig') })
    ], { job: 'PaladinConfig' });
    const gauge = scene.elements.find(e => e.kind === 'bar');
    assert.deepEqual([gauge.x, gauge.y, gauge.chunks, gauge.chunkGap], [400, 440, 2, 4]);
    assert.deepEqual(gauge.editPath, ['configs', 0, 'OathGauge', 'Position']);
    assert.equal(scene.elements.filter(e => e.kind === 'bar').length, 1);
});

test('missing unit-frame parents and incomplete cooldown exports report missing settings', () => {
    const scene = sceneFor([
        bar('TargetCastbarConfig', { AnchorToUnitFrame: true }),
        config('PartyCooldownsConfig'),
        config('PartyFramesConfig')
    ]);
    assert.equal(scene.elements.length, 0);
    assert.equal(scene.skipped.length, 3);
    assert.match(scene.skipped.join('\n'), /unit frame anchor is missing/);
    assert.match(scene.skipped.join('\n'), /bar config is missing/);
    assert.match(scene.skipped.join('\n'), /health bar config is missing/);
});

test('disabled family settings hide all derived members until showDisabled is set', () => {
    const configs = [config('EnemyListConfig', { Enabled: false }), bar('EnemyListHealthBarConfig')];
    assert.equal(sceneFor(configs).elements.length, 0);
    const scene = sceneFor(configs, { showDisabled: true, enemyCount: 2 });
    assert.equal(scene.elements.length, 2);
    assert.ok(scene.elements.every(e => e.disabled));
});
