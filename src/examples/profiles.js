(function (root) {
    const vector = (X, Y) => ({ $type: 'System.Numerics.Vector2, System.Private.CoreLib', X, Y });
    const color = (r, g, b) => ({ Vector: { $type: 'System.Numerics.Vector4, System.Private.CoreLib', X: r, Y: g, Z: b, W: 1 } });
    const label = (text, x = 0, y = 0, frame = 0, anchor = 0, font = 20) => ({
        Enabled: true, Text: text, Position: vector(x, y), FrameAnchor: frame, TextAnchor: anchor,
        FontID: `Default_${font}`, Color: color(1, 1, 1), ShowOutline: true
    });
    const statuses = () => ({ Size: vector(32, 32), DurationLabelConfig: label('', 0, 0, 6, 6, 14),
        StacksLabelConfig: label('', -2, 2, 5, 5, 12) });
    const uiBar = (name, x, y, w, h, fill, extras = {}) => ({
        $type: `DelvUI.Interface.GeneralElements.${name}Config, DelvUI`, Enabled: true,
        Position: vector(x, y), Size: vector(w, h), Anchor: 0, FillDirection: 1,
        FillColor: fill, BackgroundColor: color(.04, .06, .09), DrawBorder: true, ...extras
    });
    const ui = { kind: 'DelvUI', piped: true, configs: [
        uiBar('PlayerUnitFrame', -360, 330, 300, 42, color(.25, .62, .85), {
            LeftLabelConfig: label('[name]', 5, 0, 4, 7), RightLabelConfig: label('[health:current-short] | [health:percent]%', -5, 0, 5, 8) }),
        uiBar('TargetUnitFrame', 360, 330, 300, 42, color(.78, .28, .33), {
            LeftLabelConfig: label('[name]', 5, 0, 4, 7) }),
        uiBar('PlayerPrimaryResource', 0, 4, 300, 12, color(.32, .55, .92), { Anchor: 3, AnchorToUnitFrame: true, UnitFrameAnchor: 6 }),
        uiBar('PlayerCastbar', 0, 410, 300, 24, color(.9, .72, .32)),
        uiBar('TargetCastbar', 0, 6, 300, 24, color(.82, .5, .25), { Anchor: 3, AnchorToUnitFrame: true, UnitFrameAnchor: 6 }),
        uiBar('FocusTargetUnitFrame', -600, 260, 180, 26, color(.5, .42, .76)),
        uiBar('ExperienceBar', 0, 650, 800, 8, color(.45, .72, .48)),
        { $type: 'DelvUI.Interface.Jobs.PaladinConfig, DelvUI', Enabled: true, Position: vector(0, 290),
            OathGauge: uiBar('OathGauge', 0, 0, 300, 18, color(.45, .72, .88)) },
        { $type: 'DelvUI.Interface.Jobs.WhiteMageConfig, DelvUI', Enabled: true, Position: vector(0, 290),
            LilyBar: uiBar('LilyBar', 0, 0, 240, 18, color(.83, .8, .55)) },
        { $type: 'DelvUI.Interface.StatusEffects.PlayerBuffsListConfig, DelvUI', Enabled: true,
            Position: vector(1180, -630), Size: vector(500, 90), Directions: 2,
            IconConfig: statuses(), IconPadding: vector(2, 2), FillRowsFirst: true, Limit: 12 },
        { $type: 'DelvUI.Interface.Party.PartyFramesConfig, DelvUI', Enabled: true,
            Position: vector(-1100, -120), Rows: 4, Columns: 2, FillRowsFirst: false,
            BarsAnchor: 4 },
        uiBar('PartyFramesHealthBars', 0, 0, 200, 38, color(.35, .68, .72), {
            $type: 'DelvUI.Interface.Party.PartyFramesHealthBarsConfig, DelvUI',
            Padding: vector(4, 8),
            NameLabel: label('[name]', 5, 0, 1, 1, 16), HealthLabel: label('[health:percent]%', -5, 0, 2, 2, 16) }),
        { $type: 'DelvUI.Interface.EnemyList.EnemyListConfig, DelvUI', Enabled: true,
            Position: vector(880, -120), VerticalPadding: 14, GrowthDirection: 0 },
        uiBar('EnemyListHealthBar', 0, 0, 260, 34, color(.72, .32, .34), {
            NameLabel: label('[name]', 5, 0, 1, 1, 16), OrderLabel: label('', -8, 0, 1, 2, 16) })
    ] };
    const icon = (name, x, y, fill) => ({
        $type: 'DelvCD.UIElements.Icon', Name: name,
        IconStyleConfig: { Position: vector(x, y), Size: vector(52, 52), IconOption: 0,
            IconColor: fill, ShowBorder: true, BorderThickness: 2, Opacity: 1 },
        LabelListConfig: { Labels: [{ $type: 'DelvCD.UIElements.Label', LabelStyleConfig: {
            TextFormat: '[value]', Position: vector(0, 0), ParentAnchor: 0, TextAlign: 0,
            FontKey: 'Default_20', TextColor: color(1, 1, 1), ShowOutline: true
        } }] }
    });
    const cd = { kind: 'DelvCD', piped: false, configs: [{
        $type: 'DelvCD.Config.DelvCDConfig', GroupConfig: { Position: vector(0, 0) },
        ElementList: { UIElements: [
            { $type: 'DelvCD.UIElements.Group', Name: 'Cooldown row', GroupConfig: {
                Position: vector(-176, 340), IsDynamic: true, DynamicOffset: vector(60, 60), DynamicMaxPerRow: 6, DynamicGrowthDir: 0
            }, ElementList: { UIElements: ['Rampart', 'Reprisal', 'Sentinel', 'Intervention', 'Hallowed Ground', 'Arm’s Length'].map(name => icon(name, 0, 0, color(.48, .37, .7))) } },
            { $type: 'DelvCD.UIElements.Bar', Name: 'Buff duration', BarStyleConfig: {
                Position: vector(-176, 410), Size: vector(352, 22), Direction: 0,
                FillColor: color(.66, .45, .85), BackgroundColor: color(.12, .09, .18), ShowBorder: true
            } },
            { ...icon('Hidden example', 200, 340, color(.3, .6, .8)), VisibilityConfig: { AlwaysHide: true } }
        ] }
    }] };
    const firstIcon = cd.configs[0].ElementList.UIElements[0].ElementList.UIElements[0];
    firstIcon.StyleConditions = { Conditions: [{ Style: { ...structuredClone(firstIcon.IconStyleConfig),
        Size: vector(60, 60), Position: vector(0, -8), IconColor: color(.8, .4, .3), Glow: true } }] };
    Object.assign(cd.configs[0].ElementList.UIElements[1].BarStyleConfig, { Chunked: true, ChunkCount: 5, ChunkPadding: 4 });
    const profiles = { DelvUI: ui, DelvCD: cd };
    if (typeof module !== 'undefined') module.exports = profiles;
    else root.DemoProfiles = profiles;
})(globalThis);
