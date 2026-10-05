const vector = (X, Y) => ({ $type: 'System.Numerics.Vector2, System.Private.CoreLib', X, Y });
const color = () => ({ $type: 'System.Numerics.Vector4, System.Private.CoreLib', X: .2, Y: .4, Z: .6, W: .8 });
const config = (name, fields) => ({ $type: `${name}, ${name.split('.')[0]}`, ...fields });
const ui = (name, fields) => config(`DelvUI.Interface.GeneralElements.${name}`, fields);
const delvui = { kind: 'DelvUI', piped: true, configs: [
    ui('PlayerUnitFrameConfig', { Position: vector(-225, 176.25), Size: vector(205, 31), BorderThickness: 3,
        ShieldConfig: { Height: 27, HeightInPixels: false }, SmoothHealthConfig: { Velocity: 24.5 },
        RangeConfig: { Range: 32, AdditionalRange: 17, Alpha: 34, AdditionalAlpha: 62 },
        LeftLabelConfig: { Position: { X: 3, Y: -.25 }, FontID: 'Example_19' },
        FutureWidth: 43, Future: { Width: 47, Range: 53 } }),
    ui('TargetUnitFrameConfig', { Position: vector(210, 176), Size: vector(205, 31),
        ShieldConfig: { Height: 11, HeightInPixels: true } }),
    config('DelvUI.Interface.Jobs.BlackMageConfig', { Position: vector(0, 240),
        ManaBar: { Position: vector(-25, 8), Size: vector(220, 19), BorderThickness: 2,
            ThresholdConfig: { MarkerSize: 3, Value: 7500, ThresholdType: 1, ShowOnlyDuringAstralFire: true } } }),
    ui('EnemyNameplateConfig', { Position: vector(2, -3), BarConfig: { Position: vector(1, 4), Size: vector(140, 16),
        SizeWhenTargeted: vector(175, 21), TargetedBorderThickness: 3 }, RangeConfig: { StartRange: 45, EndRange: 66 } }),
    ui('GCDIndicatorConfig', { Position: vector(4, 5), Size: vector(45, 7), CircleRadius: 22,
        CircleThickness: 5, CircleStartAngle: 92, GCDThreshold: 1.7 }),
    ui('FontsConfig', { Fonts: { $type: 'System.Collections.Generic.SortedList`2, System.Private.CoreLib',
        Example_19: { $type: 'DelvUI.Interface.GeneralElements.FontData, DelvUI', Name: 'Example', Size: 19, Chinese: false, Korean: true } } })
] };
const style = () => ({ Position: vector(25, -.5), Size: vector(43, 43), BorderThickness: 3,
    ProgressLineThickness: 5, GlowThickness: 7, GlowSegments: 9, GlowSpeed: 1.2,
    Opacity: .75, ProgressSwipeOpacity: .6, IconOption: 2, CustomIcon: 321, IconColor: { Vector: color() } });
const delvcd = { kind: 'DelvCD', piped: false, configs: [config('DelvCD.Config.DelvCDConfig', {
    GroupConfig: { Position: { X: -4, Y: 3 }, DynamicOffset: vector(57, 61), DynamicMaxPerRow: 7, DynamicGrowthDir: 3 },
    ElementList: { $type: 'DelvCD.Config.ElementListConfig, DelvCD', UIElements: {
        $type: 'System.Collections.Generic.List`1[[DelvCD.UIElements.UIElement, DelvCD]], System.Private.CoreLib', $values: [
            config('DelvCD.UIElements.Icon', { IconStyleConfig: style(),
                StyleConditions: { Conditions: [{ TriggerDataSourceIndex: 1, Source: 2, Op: 3, Value: 17,
                    Style: { ...style(), Position: vector(-7, 9), BorderThickness: 5 } }] },
                TriggerConfig: { TriggerOptions: [config('DelvCD.Config.CooldownTrigger', { RangeValue: 35, CooldownValue: 4.5 })] } }),
            config('DelvCD.UIElements.Bar', { BarStyleConfig: { Position: vector(6, 7), Size: vector(210, 21),
                BorderThickness: 3, ChunkPadding: 5, GlowThickness: 7, Radius: 1, ChunkCount: 7, NgonSides: 9, GlowSpeed: 2.5 },
                StyleConditions: { $type: 'DelvCD.Config.StyleConditions`1[[DelvCD.Config.BarStyleConfig, DelvCD]], DelvCD',
                    Conditions: [{ $type: 'DelvCD.Config.StyleCondition`1[[DelvCD.Config.BarStyleConfig, DelvCD]], DelvCD',
                        Value: 5, Style: { BorderThickness: 3, Radius: .75, Position: vector(9, 8), Size: vector(190, 17) } }] } })
        ]
    } }
})] };
const legacy = { kind: 'DelvCD', piped: false, configs: [{ $type: 'XIVAuras.Config.XIVAurasConfig, XIVAuras',
    GroupConfig: { Position: { X: -8, Y: 4 }, DynamicOffset: { X: 54, Y: 56 }, DynamicMaxPerRow: 6 },
    AuraList: { Auras: [{ $type: 'XIVAuras.UIElements.AuraGroup, XIVAuras',
        GroupConfig: { Position: { X: 12, Y: 15 } }, AuraList: { Auras: [{ $type: 'XIVAuras.UIElements.AuraIcon, XIVAuras',
            IconStyleConfig: { Position: { X: 7, Y: 8 }, Size: { X: 35, Y: 37 }, BorderThickness: 3, GlowSegments: 9 } }] } }] } }] };
module.exports = { delvui, delvcd, legacy };
