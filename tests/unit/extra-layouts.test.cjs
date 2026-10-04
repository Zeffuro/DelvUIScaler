const test = require('node:test');
const assert = require('node:assert/strict');
const sceneApi = require('../../src/preview/scene.js');
const extra = require('../../src/preview/adapters/delvui-extras.js');
const grid = require('../../src/ui/grid.js');
const v = (X, Y) => ({ X, Y });
const color = (X, Y, Z, W = 1) => ({ Vector: { X, Y, Z, W } });
const c = (type, values = {}) => ({ $type: `DelvUI.Interface.${type}, DelvUI`, Enabled: true, Position: v(0, 0), ...values });
const label = (Text, values = {}) => ({ Enabled: true, Position: v(0, 0), Text, FontID: 'Default_10', FrameAnchor: 4, TextAnchor: 4, ...values });
const bar = values => ({ Enabled: true, Position: v(0, 0), Size: v(100, 20), Anchor: 4, ...values });
function build(configs, options = {}) {
    const profile = { kind: 'DelvUI', configs }, before = JSON.stringify(profile);
    const scene = sceneApi.create(profile, 1000, 800, options);
    extra.build(profile, scene);
    assert.equal(JSON.stringify(profile), before, 'preview must preserve imported settings');
    return scene;
}
const element = (scene, name) => scene.elements.find(e => e.name === name);

test('all ten actor families draw labels with a selectable parent and actual nested paths', () => {
    const scene = build(extra.nameplateTypes.map(type => c(type, { NameLabelConfig: label('[name] Lv[level]'),
        TitleLabelConfig: label('<[title]>'), SwapLabelsWhenNeeded: false })));
    assert.equal(scene.elements.filter(e => e.kind === 'group').length, 10);
    assert.equal(scene.skipped.length, 0);
    for (let i = 0; i < extra.nameplateTypes.length; i++) {
        const name = sceneApi.friendly(extra.nameplateTypes[i]);
        assert.deepEqual(element(scene, name).editPath, ['configs', i, 'Position']);
        const child = element(scene, name + ' / Name Label');
        assert.deepEqual(child.editPath, ['configs', i, 'NameLabelConfig', 'Position']);
        assert.match(child.text, /Lv100$/);
    }
});

test('nameplate health and main labels include parent offset, player extras use original health anchor', () => {
    const configs = [c('HUDOptionsConfig', { UseGlobalHudShift: true, HudOffset: v(200, 300) }),
        c('PlayerNameplateConfig', { Position: v(30, 40), NameLabelConfig: label('[name]', { Position: v(5, -10) }),
            BarConfig: bar({ Position: v(10, -5) }),
            RoleIconConfig: bar({ Size: v(10, 10), Position: v(2, 3), FrameAnchor: 5, PrioritizeHealthBarAnchor: true }) })];
    const scene = build(configs);
    const health = element(scene, 'Player Nameplate / health');
    assert.deepEqual([health.x, health.y], [160, 219]);
    assert.deepEqual(health.editPath, ['configs', 1, 'BarConfig', 'Position']);
    assert.deepEqual([element(scene, 'Player Nameplate / Name Label').x,
        element(scene, 'Player Nameplate / Name Label').y], [165, 209]);
    const role = element(scene, 'Player Nameplate / Role Icon');
    assert.deepEqual([role.x, role.y], [232, 182]);
    const shifted = structuredClone(configs);
    shifted[1].Position.X += 12;
    const after = build(shifted);
    assert.equal(element(after, health.name).x, health.x + 12);
    assert.equal(element(after, role.name).x, role.x);
});

test('nameplate groups snap their movable health corner while actor-anchored casts stay fixed', () => {
    const config = c('EnemyNameplateConfig', { BarConfig: bar(), NameLabelConfig: label('[name]'),
        CastbarConfig: bar({ HealthBarAnchor: 7 }) });
    const before = build([config]);
    const group = element(before, 'Enemy Nameplate'), health = element(before, 'Enemy Nameplate / health');
    assert.deepEqual(group.snapPoint, { x: health.x, y: health.y });
    const cast = element(before, 'Enemy Nameplate / cast');
    config.Position = grid.snap(config.Position, group.snapPoint, { x: 20, y: 20 }, { x: 500, y: 400 });
    const after = build([config]), moved = element(after, 'Enemy Nameplate / health');
    assert.equal(Math.abs((moved.x - 500) % 20), 0);
    assert.equal(Math.abs((moved.y - 400) % 20), 0);
    assert.deepEqual([element(after, cast.name).x, element(after, cast.name).y], [cast.x, cast.y]);
});

test('target size, full/zero health conditions and label anchor fallback follow the runtime', () => {
    const config = c('PlayerNameplateConfig', { NameLabelConfig: label('[name]', { Position: v(3, 4) }),
        BarConfig: bar({ OnlyShowWhenNotFull: true, HideHealthAtZero: true, UseDifferentSizeWhenTargeted: true, SizeWhenTargeted: v(170, 30) }),
        RoleIconConfig: bar({ Size: v(10, 10), FrameAnchor: 5, PrioritizeHealthBarAnchor: true }) });
    const targeted = build([config], { nameplateTarget: 'PlayerNameplateConfig' });
    assert.equal(element(targeted, 'Player Nameplate / health').width, 170);
    for (const hpPercent of [0, 100]) {
        const scene = build([config], { hpPercent });
        assert.equal(element(scene, 'Player Nameplate / health'), undefined);
        const name = element(scene, 'Player Nameplate / Name Label');
        assert.equal(element(scene, 'Player Nameplate / Role Icon').x, name.x + name.width);
    }
});

test('general, child, targeted-only and always-hide flags work and showDisabled preserves inspection', () => {
    const family = c('ObjectsNameplateConfig', { OnlyShowWhenTargeted: true, NameLabelConfig: label('[name]') });
    assert.equal(build([family]).elements.length, 0);
    assert.ok(build([family], { showDisabled: true }).elements.every(e => e.disabled));
    assert.ok(build([family], { nameplateTarget: 'ObjectsNameplateConfig' }).elements.length);
    assert.equal(build([c('NameplatesGeneralConfig', { Enabled: false }), { ...family, OnlyShowWhenTargeted: false }]).elements.length, 0);
    assert.equal(build([{ ...family, OnlyShowWhenTargeted: false, VisibilityConfig: { AlwaysHide: true } }]).elements.length, 0);
    const noLabel = { ...family, OnlyShowWhenTargeted: false, NameLabelConfig: label('[name]', { Enabled: false }) };
    assert.equal(build([noLabel]).elements.length, 0);
});

test('title-prefix swapping and highest/lowest icon anchors use computed text rectangles', () => {
    const scene = build([c('PlayerNameplateConfig', { SwapLabelsWhenNeeded: true,
        NameLabelConfig: label('[name]', { Position: v(0, -30) }), TitleLabelConfig: label('<[title]>'),
        RoleIconConfig: bar({ Size: v(10, 10), NameplateLabelAnchor: 2, FrameAnchor: 4 }),
        StateIconConfig: bar({ Size: v(10, 10), NameplateLabelAnchor: 3, FrameAnchor: 4 }) })], { nameplateTitlePrefix: true });
    const name = element(scene, 'Player Nameplate / Name Label'), title = element(scene, 'Player Nameplate / Title Label');
    assert.equal(name.y, 184);
    assert.equal(title.y, 154);
    assert.equal(element(scene, 'Player Nameplate / Role Icon').y, title.y);
    assert.equal(element(scene, 'Player Nameplate / State Icon').y, name.y);
});

test('nameplate icon anchors use resolved registry metrics and browser family measurements', () => {
    const scene = build([c('FontsConfig', { Fonts: { Custom_10: { Name: 'Custom Family', Size: 30 } } }),
        c('PlayerNameplateConfig', { NameLabelConfig: { ...label('[name]'), $type: 'DelvUI.EditableLabelConfig', FontID: 'Custom_10', FontScale: 3 },
            RoleIconConfig: bar({ Size: v(10,10), FrameAnchor: 5 }) })],
        { measureText: (text, size, family) => family === 'Custom Family' ? size * 2 : size });
    const name = element(scene, 'Player Nameplate / Name Label');
    assert.equal(name.fontSize, 30);
    assert.equal(name.width, 60);
    assert.equal(element(scene, 'Player Nameplate / Role Icon').x, name.x + name.width);
});

test('parent nameplate visibility propagates to every child in combat and idle states', () => {
    const configs = [c('PlayerNameplateConfig', { VisibilityConfig: { HideInCombat: true }, BarConfig: bar(), NameLabelConfig: label('[name]'),
        RoleIconConfig: bar({ Size: v(10,10) }) })];
    assert.equal(build(configs, { state: 'combat' }).elements.length, 0);
    assert.ok(build(configs, { state: 'idle' }).elements.length);
});

test('enemy debuffs and matching castbar dimensions use actor bar bounds without parent offset', () => {
    const scene = build([c('EnemyNameplateConfig', { Position: v(30, 40), BarConfig: bar(),
        NameLabelConfig: label('[name]'),
        DebuffsConfig: { Enabled: true, Position: v(2, -20), Size: v(60, 20), Directions: 0, Limit: 1,
            HealthBarAnchor: 4, IconConfig: { Size: v(20, 20) } },
        CastbarConfig: bar({ Size: v(10, 5), Position: v(0, 6), HealthBarAnchor: 7, MatchWidth: true, MatchHeight: true,
            ShowIcon: true, SeparateIcon: true, CustomIconSize: v(12, 12), CustomIconPosition: v(-20, 3),
            CastNameLabel: label(''), CastTimeLabel: label('') }) })]);
    const health = element(scene, 'Enemy Nameplate / health'), cast = element(scene, 'Enemy Nameplate / cast');
    assert.deepEqual([health.x, health.y], [340, 224]);
    assert.deepEqual([cast.x, cast.y, cast.width, cast.height], [310, 210, 100, 20]);
    const area = element(scene, 'Enemy Nameplate / debuffs (area)');
    assert.deepEqual([area.x, area.y], [312, 164]);
    assert.deepEqual(element(scene, 'Enemy Nameplate / cast icon').editPath, ['configs', 0, 'CastbarConfig', 'CustomIconPosition']);
    assert.equal(element(scene, 'Enemy Nameplate / Cast Name Label').text, 'Ancient Flare');
});

test('range fade applies to bars, labels and extras', () => {
    const scene = build([c('PlayerNameplateConfig', { BarConfig: bar(), NameLabelConfig: label('[name]'),
        RangeConfig: { Enabled: true, StartRange: 20, EndRange: 40 },
        RoleIconConfig: bar({ Size: v(10, 10) }) })], { nameplateDistance: 30 });
    assert.equal(element(scene, 'Player Nameplate / health').fill, 'rgba(88,183,213,0.5)');
    assert.equal(element(scene, 'Player Nameplate / Role Icon').opacity, .5);
    assert.equal(element(scene, 'Player Nameplate / Name Label').opacity, 1);
    const lowAlpha = build([c('PlayerNameplateConfig', { NameLabelConfig: label('[name]', { Color: color(1,1,1,.2) }),
        RangeConfig: { Enabled: true, StartRange: 20, EndRange: 40 } })], { nameplateDistance: 30 });
    assert.equal(element(lowAlpha, 'Player Nameplate / Name Label').fill, 'rgba(255,255,255,0.2)');
    const outlined = c('PlayerNameplateConfig', { NameLabelConfig: label('[name]', { ShowOutline: true, Color: color(1,1,1) }),
        RangeConfig: { Enabled: true, StartRange: 20, EndRange: 40 } });
    assert.equal(element(build([outlined], { nameplateDistance: 30 }), 'Player Nameplate / Name Label').outline, 'rgba(0,0,0,0.5)');
    const distant = element(build([outlined], { nameplateDistance: 41 }), 'Player Nameplate / Name Label');
    assert.equal(distant.fill, 'rgba(255,255,255,0)');
    assert.equal(distant.outline, 'rgba(0,0,0,0)');
});

test('exported job and role palettes drive nameplate bars, backgrounds and labels', () => {
    const scene = build([c('HealersColorConfig', { WHMColor: color(.2,.4,.6) }),
        c('RolesColorConfig', { HealerRoleColor: color(.4,.6,.2) }),
        c('PlayerNameplateConfig', { BarConfig: bar({ UseJobColor: true, UseRoleColorAsBackgroundColor: true }),
            NameLabelConfig: label('[name]', { UseRoleColor: true }) })], { job: 'WhiteMageConfig' });
    const health = element(scene, 'Player Nameplate / health');
    assert.equal(health.fill, 'rgba(51,102,153,1)');
    assert.equal(health.background, 'rgba(102,153,51,1)');
    assert.equal(element(scene, 'Player Nameplate / Name Label').fill, 'rgba(102,153,51,1)');
});

function cooldownConfigs(direction = 0, data = undefined) {
    return [c('HUDOptionsConfig', { UseGlobalHudShift: true, HudOffset: v(10, 20) }),
        c('PartyCooldownsConfig', { Position: v(30, 40), Padding: v(4, 3), GrowthDirection: direction }),
        c('PartyCooldownsBarConfig', { Size: v(150, 24), ShowBar: true, ShowIcon: true,
            NameLabel: label('[name:initials]'), TimeLabel: label('', { ShowEffectDuration: true, ShowRemainingCooldown: true }) }),
        c('PartyCooldownsDataConfig', { Cooldowns: data || [
            { ActionId: 1, Role: 0, Column: 1, CooldownDuration: 120, EffectDuration: 15 },
            { ActionId: 2, JobId: 24, Column: 3, CooldownDuration: 120, EffectDuration: 15 }
        ] })];
}
test('standalone cooldowns use source section growth, one-pixel icon overlap and global HUD shift', () => {
    const expected = [ [[563,460],[563,487],[717,460]], [[563,460],[563,433],[717,460]],
        [[564,459],[718,459],[564,486]], [[564,459],[410,459],[564,486]] ];
    for (let direction = 0; direction < 4; direction++) {
        const scene = build(cooldownConfigs(direction), { partyCount: 3 });
        const bars = scene.elements.filter(e => e.kind === 'bar');
        assert.deepEqual(bars.map(e => [e.x,e.y]), expected[direction]);
        assert.ok(bars.every(e => e.width === 126 && e.height === 24));
        assert.deepEqual(bars[0].editPath, ['configs',1,'Position']);
        const icon = element(scene, bars[0].name + ' / icon');
        assert.equal(icon.x, bars[0].x - 23);
        assert.deepEqual(element(scene, bars[0].name + ' / NameLabel').editPath, ['configs',2,'NameLabel','Position']);
    }
});

test('cooldown tracked flags, role/job restrictions, level exclusions and priority determine actual coverage', () => {
    const data = [
        { ActionId: 8, JobIds: [19,21], ExcludedJobIds: [21], Column: 5, Priority: 3 },
        { ActionId: 4, Roles: [0], Column: 1, Priority: 1, EnabledV2: 2 },
        { ActionId: 3, JobId: 19, Column: 1, RequiredLevel: 101 },
        { ActionId: 2, JobId: 19, Column: 1, DisabledAfterLevel: 100 },
        { ActionId: 7, JobId: 19, Column: 5, Priority: 0, EnabledV2: 1 }
    ];
    const scene = build(cooldownConfigs(0, data), { partyCount: 2 });
    assert.deepEqual(scene.elements.filter(e => e.kind === 'bar').map(e => e.name.split('action ')[1]), ['7','8']);
    const configs = cooldownConfigs(); configs[2].ShowBar = false;
    assert.equal(build(configs).elements.filter(e => e.kind === 'bar').length, 0);
    assert.equal(build([c('PartyCooldownsConfig')]).skipped.length, 1);
});

test('cooldown ready/active/recharging states honor time visibility without changing geometry', () => {
    const configs = cooldownConfigs();
    const ready = build(configs, { cooldownState: 'ready' });
    assert.ok(ready.elements.filter(e => e.kind === 'bar').every(e => e.fillRatio === 0));
    assert.equal(ready.elements.filter(e => e.name.endsWith('/ TimeLabel')).length, 0);
    configs[2].TimeLabel.ShowEffectDuration = false;
    assert.equal(build(configs, { cooldownState: 'active' }).elements.filter(e => e.name.endsWith('/ TimeLabel')).length, 0);
    assert.ok(build(configs, { cooldownState: 'recharging' }).elements.some(e => e.name.endsWith('/ TimeLabel')));
});

test('cooldown job colors use source active/recharging alpha overrides', () => {
    const configs = cooldownConfigs(); configs[2].UseJobColors = true;
    configs.push(c('TanksColorConfig', { PLDColor: color(.2,.4,.6) }));
    const active = build(configs, { cooldownState: 'active' }).elements.find(e => e.kind === 'bar');
    assert.equal(active.fill, 'rgba(51,102,153,1)');
    assert.equal(active.background, 'rgba(51,102,153,0.4)');
    const recharge = build(configs, { cooldownState: 'recharging' }).elements.find(e => e.kind === 'bar');
    assert.equal(recharge.fill, 'rgba(51,102,153,0.25)');
    assert.equal(recharge.background, 'rgba(0,0,0,0.5333333333333333)');
});

const trackers = () => ({
    Raise: { Enabled: true, HideNameWhenRaised: true, ChangeBackgroundColorWhenRaised: true, BackgroundColor: color(.1,.2,.3),
        ChangeBorderColorWhenRaised: true, BorderColor: color(.4,.5,.6), Icon: bar({ Size: v(30,30), FrameAnchor: 5,
            NumericLabel: label('', { FrameAnchor: 8, Position: v(-4,-5) }) }) },
    Invuln: { Enabled: true, HideNameWhenInvuln: true, ChangeBackgroundColorWhenInvuln: true, BackgroundColor: color(.2,.3,.4),
        Icon: bar({ Size: v(20,20), FrameAnchor: 6, NumericLabel: label('') }) },
    Cleanse: { Enabled: true, CleanseJobsOnly: true, ChangeHealthBarCleanseColor: true, HealthBarColor: color(.8,.1,.4),
        ChangeBorderCleanseColor: true, BorderColor: color(.9,.2,.5) }
});
function trackerScene(partyState, job = 'WhiteMageConfig', member = 0, config = trackers()) {
    const profile = { kind: 'DelvUI', configs: [config] }, snapshot = JSON.stringify(profile);
    const scene = sceneApi.create(profile, 1000, 800, { partyState, job });
    const body = scene.emit({}, { x: 100, y: 200 }, { x: 100, y: 40 }, 'Member', 'bar');
    const result = extra.drawTrackers(scene, config, ['configs',0], body, 'Member', false, member, body);
    assert.equal(JSON.stringify(profile), snapshot);
    return { scene, body, result };
}
test('tracker icon anchors and duration anchors have independent actual owners', () => {
    const { scene, body, result } = trackerScene('raise');
    assert.equal(result.hideName, true);
    const icon = element(scene, 'Member / raise'), duration = element(scene, 'Member / raise / duration');
    assert.deepEqual([icon.x,icon.y], [200,200]);
    assert.deepEqual([duration.x,duration.y], [196,235]);
    assert.deepEqual(icon.editPath, ['configs',0,'Raise','Icon','Position']);
    assert.deepEqual(duration.editPath, ['configs',0,'Raise','Icon','NumericLabel','Position']);
    assert.equal(body.background, 'rgba(26,51,77,1)');
    assert.equal(body.border, 'rgba(102,128,153,1)');
});
test('tracker states include cleanse-job filtering, disabled tracker suppression and all-member distribution', () => {
    assert.equal(trackerScene('normal').scene.elements.length, 1);
    assert.equal(trackerScene('invuln').result.hideName, true);
    assert.equal(trackerScene('cleanse').body.fill, 'rgba(204,26,102,1)');
    assert.notEqual(trackerScene('cleanse','PaladinConfig').body.fill, 'rgba(204,26,102,1)');
    assert.equal(trackerScene('cleanse','BlueMageConfig').body.fill, 'rgba(204,26,102,1)');
    for (const [member,state] of [[0,'raise'],[1,'invuln']]) assert.ok(trackerScene('all','WhiteMageConfig',member).scene.elements.some(e => e.name.endsWith('/ '+state)));
    const disabled = trackers(); disabled.Raise.Enabled = false;
    assert.equal(trackerScene('raise','WhiteMageConfig',0,disabled).scene.elements.length, 1);
    assert.doesNotThrow(() => trackerScene('raise','WhiteMageConfig',0,{}));
});
