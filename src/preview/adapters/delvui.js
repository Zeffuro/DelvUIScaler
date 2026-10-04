(function (root) {
    const extra = typeof module !== 'undefined' ? require('./delvui-extras.js') : root.DelvUIExtra;
    const state = typeof module !== 'undefined' ? require('../state.js') : root.PreviewState;
    const jobChunks = {
        Paladin: { OathGauge: 2, RequiescatStacksBar: 4 },
        Warrior: { BeastGauge: 2, InnerReleaseBar: 3 },
        DarkKnight: { ManaBar: 3, BloodGauge: 2, BloodWeaponBar: 3, DeliriumBar: 3 },
        Gunbreaker: { PowderGauge: 3 },
        WhiteMage: { LilyBar: 3, BloodLilyBar: 3 },
        Scholar: { AetherflowBar: 3 }, Sage: { AddersgallBar: 3, AdderstingBar: 3 },
        Astrologian: { CardsBar: 4 },
        Monk: { ChakraBar: 5, MastersGauge: 5, StancesBar: 3, PerfectBalanceBar: 3 },
        Dragoon: { FirstmindsFocusBar: 2 }, Ninja: { MudraBar: 2, KazematoiBar: 5, NinkiBar: 2 },
        Samurai: { SenBar: 3, MeditationBar: 3 }, Reaper: { DeathsDesignBar: 2, SoulBar: 2, ShroudBar: 2, DeathGauge: 5 },
        Bard: { CodaBar: 3 }, Machinist: { HeatGauge: 2, OverheatChunkedGauge: 5 },
        Dancer: { EspritGauge: 2, FeatherGauge: 4, StepsBar: 4 },
        BlackMage: { StacksBar: 3, UmbralHeartBar: 3, AstralSoulBar: 6, TriplecastBar: 3, PolyglotBar: 3 },
        Summoner: { IfritBar: 1, TitanBar: 1, GarudaBar: 1, AetherflowBar: 2 },
        RedMage: { ManaStacksBar: 3 }, BlueMage: { SurpanakhaBar: 4 },
        Viper: { Vipersight: 4, RattlingCoilGauge: 3, AnguineTribute: 5, SerpentOfferings: 2 },
        Pictomancer: { PaletteBar: 2, PaintBar: 5, CreatureCanvasBar: 3, WeaponCanvasBar: 1,
            LandscapeCanvasBar: 1, HammerTimeBar: 3, HyperphantasiaBar: 5 }
    };

    function build(profile, scene) {
        const { options, emit, skipped, label, statuses } = scene;
        const { typeName, friendly, vec, add, anchor, topLeft, color } = scene.util;
        const byType = new Map(profile.configs.map((config, index) => [typeName(config), { config, path: ['configs', index] }]));
        const hud = byType.get('HUDOptionsConfig')?.config;
        const origin = add(scene.center, hud?.UseGlobalHudShift ? vec(hud.HudOffset) : vec(null));
        const hp = Math.max(0, Math.min(1, (options.hpPercent ?? 76) / 100));
        const disabledFor = (config, parent = false) => parent || config?.Enabled === false ||
            !state.visible(config?.VisibilityConfig, options, false);
        const visible = disabled => !disabled || options.showDisabled;
        const positionPath = path => [...path, 'Position'];
        const parentRect = (point, size) => ({ x: point.x, y: point.y, width: size.x, height: size.y });
        const framePoint = (rect, value) => ({ x: rect.x + rect.width * anchor(value)[0], y: rect.y + rect.height * anchor(value)[1] });
        function sharedNotes(first, bodyPath, family) {
            for (const element of scene.elements.slice(first)) {
                const body = JSON.stringify(element.editPath) === JSON.stringify(bodyPath);
                const note = body ? `Moves all ${family} frames` : `Shared by every ${family} member`;
                element.note = [element.note, note].filter(Boolean).join('. ');
            }
        }

        function parentPoint(config) {
            if (!config.AnchorToUnitFrame) return origin;
            const prefix = typeName(config).match(/^(TargetOfTarget|FocusTarget|Player|Target)/)?.[0];
            const parent = byType.get(`${prefix}UnitFrameConfig`)?.config;
            if (!parent) {
                skipped.push(`${friendly(typeName(config))}: unit frame anchor is missing from this export`);
                return null;
            }
            const size = vec(parent.Size);
            return framePoint(parentRect(topLeft(add(origin, vec(parent.Position)), size, parent.Anchor), size), config.UnitFrameAnchor);
        }

        function drawLabel(config, rect, name, disabled, path, sampleName, sampleText) {
            if (!config) return;
            const drawnConfig = sampleText === undefined ? config : { ...config, Text: sampleText };
            label(drawnConfig, rect, name, disabledFor(config, disabled), positionPath(path), sampleName);
        }

        function drawIcon(config, rect, name, disabled, path, frameAnchor = config?.FrameAnchor, text = '') {
            if (!config) return;
            disabled = disabledFor(config, disabled);
            if (!visible(disabled)) return;
            const size = vec(config.Size);
            const point = topLeft(add(framePoint(rect, frameAnchor), vec(config.Position)), size, config.Anchor);
            emit(config, point, size, name, 'icon', disabled, positionPath(path), { text, fillRatio: 1, note: 'Dummy icon' });
        }

        function attachedLabels(config, rect, name, disabled, path, sampleName, sampleOrder) {
            for (const [key, child] of Object.entries(config)) {
                if (!child || typeof child !== 'object' || !/Label|OrderNumber/.test(key) || !child.Position) continue;
                let sampleText;
                if (key === 'CastNameLabel') sampleText = 'Glare III';
                else if (key === 'CastTimeLabel') sampleText = config.ShowMaxCastTime ? '1.2 / 2.5' : '1.2';
                else if (/Order/.test(key)) sampleText = sampleOrder ?? String(sampleName?.match(/\d+$/)?.[0] || '1');
                else if (!child.Text && /NumericLabel/.test(typeName(child))) sampleText = '12';
                drawLabel(child, rect, `${name} / ${friendly(key)}`, disabled, [...path, key], sampleName, sampleText);
            }
        }

        function drawBar(config, base, name, disabled, path, extra = {}, sampleName = options.dummyName) {
            if (!config || !base) return;
            disabled = disabledFor(config, disabled);
            if (!visible(disabled)) return;
            const size = vec(config.Size), point = topLeft(add(base, vec(config.Position)), size, config.Anchor);
            const rect = parentRect(point, size);
            emit(config, point, size, name, 'bar', disabled, positionPath(path), { fillRatio: hp, ...extra });
            if (config.CastNameLabel || config.CastTimeLabel) {
                const iconSize = config.SeparateIcon ? vec(config.CustomIconSize) : { x: size.y, y: size.y };
                if (config.ShowIcon) {
                    const iconPos = config.SeparateIcon ? add(point, vec(config.CustomIconPosition)) : point;
                    emit(config, iconPos, iconSize, `${name} / cast icon`, 'icon', disabled, positionPath(path), { note: 'Dummy cast icon', text: '✦', fillRatio: 1 });
                }
                for (const key of ['CastNameLabel', 'CastTimeLabel']) {
                    const child = config[key];
                    if (!child) continue;
                    const offset = config.ShowIcon && !config.SeparateIcon && [1, 4, 7].includes(child.TextAnchor) ? iconSize.x : 0;
                    drawLabel(child, { ...rect, x: rect.x + offset }, `${name} / ${friendly(key)}`, disabled,
                        [...path, key], sampleName, key === 'CastNameLabel' ? 'Glare III' : config.ShowMaxCastTime ? '1.2 / 2.5' : '1.2');
                }
            } else {
                attachedLabels(config, rect, name, disabled, path, sampleName);
            }
            return rect;
        }

        function drawStatuses(config, base, name, disabled, path, labelPaths) {
            if (!config || !base) return;
            statuses(config, base, name, disabledFor(config, disabled), positionPath(path), labelPaths);
        }

        function jobBars(config, base, name, disabled, path, job, key = '') {
            if (!config || typeof config !== 'object') return;
            disabled = disabledFor(config, disabled);
            if (!visible(disabled)) return;
            if (config.Size && config.Position && (config.FillColor || /BarConfig|GaugeConfig/.test(typeName(config)))) {
                const chunks = jobChunks[job]?.[key];
                const useChunks = config.UseChunks !== false && chunks;
                const extra = { chunks: useChunks ? chunks : 1, chunkGap: Number(config.Padding) || 0 };
                if ((config.FillColor?.Vector || config.FillColor)?.W === 0 && color) {
                    const sampleColor = Object.entries(config).find(([name, value]) => /Color$/.test(name) &&
                        !/Background|Border|Empty|Partial/.test(name) && (value?.Vector || value)?.W > 0)?.[1];
                    extra.fill = color(sampleColor, '#6aa9d0');
                }
                drawBar(config, base, name, disabled, path, extra);
                return;
            }
            for (const [childKey, child] of Object.entries(config)) {
                if (child && typeof child === 'object' && !Array.isArray(child)) {
                    jobBars(child, base, `${name} / ${friendly(childKey)}`, disabled, [...path, childKey], job, childKey);
                }
            }
        }

        function drawParty() {
            const entry = byType.get('PartyFramesConfig'), healthEntry = byType.get('PartyFramesHealthBarsConfig');
            if (!entry || !healthEntry) {
                if (entry) skipped.push('Party Frames: health bar config is missing from this export');
                return;
            }
            const { config, path } = entry, health = healthEntry.config, disabled = disabledFor(config);
            if (!visible(disabled)) return;
            const size = vec(health.Size), padding = vec(health.Padding);
            if (size.x <= 0 || size.y <= 0) return;
            const rows = Math.max(1, Number(config.Rows) || 1), cols = Math.max(1, Number(config.Columns) || 1);
            const count = Math.max(1, Math.min(8, Number(options.partyCount) || 8));
            const fillRows = config.FillRowsFirst !== false;
            const realCols = fillRows ? Math.min(count, cols) : Math.ceil(count / rows);
            const realRows = fillRows ? Math.ceil(count / cols) : Math.min(count, rows);
            const space = { x: cols * size.x + (cols - 1) * padding.x, y: rows * size.y + (rows - 1) * padding.y };
            const content = { x: realCols * size.x + (realCols - 1) * padding.x, y: realRows * size.y + (realRows - 1) * padding.y };
            const alignment = anchor(config.BarsAnchor), base = add(origin, vec(config.Position));
            const start = add(base, { x: (space.x - content.x) * alignment[0], y: (space.y - content.y) * alignment[1] });
            const colors = health.ColorsConfig || {};
            const style = { ...health, BackgroundColor: colors.BackgroundColor || health.BackgroundColor,
                DrawBorder: colors.ShowBorder ?? health.DrawBorder, BorderColor: colors.BorderColor || health.BorderColor,
                BorderThickness: colors.InactiveBorderThickness || 1 };
            for (let i = 0; i < count; i++) {
                const first = scene.elements.length;
                const col = fillRows ? i % cols : Math.floor(i / rows), row = fillRows ? Math.floor(i / cols) : i % rows;
                // DelvUI subtracts one pixel from each party frame pitch.
                const point = add(start, { x: col * (size.x + padding.x - 1), y: row * (size.y + padding.y - 1) });
                const rect = parentRect(point, size), name = `Party Frames / member ${i + 1}`;
                const sampleName = i === 0 ? options.dummyName : `Party Member ${i + 1}`;
                const body = emit(style, point, size, name, 'bar', disabled, positionPath(path), { fillRatio: hp, fill: '#64b2bc' });
                const trackers = byType.get('PartyFramesTrackersConfig');
                const tracked = trackers && extra.drawTrackers(scene, trackers.config, trackers.path, rect, name, disabled, i, body);
                attachedLabels(tracked?.hideName ? { ...health, NameLabelConfig: null } : health, rect, name, disabled, healthEntry.path, sampleName);
                for (const type of ['PartyFramesManaBarConfig', 'PartyFramesCastbarConfig']) {
                    const child = byType.get(type);
                    if (child) drawBar(child.config, framePoint(rect, child.config.HealthBarAnchor), `${name} / ${friendly(type)}`,
                        disabled, child.path, { fillRatio: .65 }, sampleName);
                }
                for (const type of ['PartyFramesBuffsConfig', 'PartyFramesDebuffsConfig']) {
                    const child = byType.get(type);
                    if (child) drawStatuses(child.config, framePoint(rect, child.config.HealthBarAnchor), `${name} / ${friendly(type)}`, disabled, child.path);
                }
                const icons = byType.get('PartyFramesIconsConfig');
                if (icons) {
                    drawIcon(icons.config.Role, rect, `${name} / role icon`, disabled, [...icons.path, 'Role'], undefined, ['◆', '◆', '✦', '✦', '●'][i % 5]);
                    if (i === 0) drawIcon(icons.config.Leader, rect, `${name} / leader icon`, disabled, [...icons.path, 'Leader'], undefined, '★');
                    if (i === 1) drawIcon(icons.config.Sign, rect, `${name} / sign icon`, disabled, [...icons.path, 'Sign'], undefined, '1');
                }
                const cooldowns = byType.get('PartyFramesCooldownListConfig');
                if (cooldowns) {
                    const c = cooldowns.config;
                    drawStatuses({ ...c, IconConfig: { Size: c.IconSize, DurationLabelConfig: c.TimeLabel }, Limit: 4 },
                        framePoint(rect, c.HealthBarAnchor), `${name} / cooldowns`, disabled, cooldowns.path,
                        { DurationLabelConfig: [...cooldowns.path, 'TimeLabel', 'Position'] });
                }
                sharedNotes(first, positionPath(path), 'party');
            }
            drawLabel(config.ShowPartyTitleConfig, parentRect(base, { x: 0, y: 0 }), 'Party Frames / title', disabled,
                [...path, 'ShowPartyTitleConfig'], options.dummyName, 'FULL PARTY');
        }

        function drawEnemyList() {
            const entry = byType.get('EnemyListConfig'), healthEntry = byType.get('EnemyListHealthBarConfig');
            if (!entry || !healthEntry) {
                if (entry) skipped.push('Enemy List: health bar config is missing from this export');
                return;
            }
            const { config, path } = entry, health = healthEntry.config, disabled = disabledFor(config);
            if (!visible(disabled)) return;
            const size = vec(health.Size), direction = config.GrowthDirection === 1 ? -1 : 1;
            const count = Math.max(1, Math.min(8, Number(options.enemyCount) || 4));
            const base = add(origin, vec(config.Position));
            for (let i = 0; i < count; i++) {
                const first = scene.elements.length;
                const point = add(base, { x: 0, y: i * direction * (size.y + (Number(config.VerticalPadding) || 0)) });
                const rect = parentRect(point, size), name = `Enemy List / enemy ${i + 1}`, sampleName = `${options.dummyTarget || 'Training Dummy'} ${i + 1}`;
                emit(health, point, size, name, 'bar', disabledFor(health, disabled), positionPath(path), { fillRatio: hp });
                const sign = byType.get('EnemyListSignIconConfig');
                const showSign = i === 0 && sign && sign.config.Enabled !== false;
                attachedLabels(showSign && sign.config.ReplaceOrderLabel ? { ...health, OrderLabel: null } : health,
                    rect, name, disabled, healthEntry.path, sampleName, String.fromCharCode(65 + i));
                for (const type of ['EnemyListBuffsConfig', 'EnemyListDebuffsConfig']) {
                    const child = byType.get(type);
                    if (child) drawStatuses(child.config, framePoint(rect, child.config.HealthBarAnchor), `${name} / ${friendly(type)}`, disabled, child.path);
                }
                const cast = byType.get('EnemyListCastbarConfig');
                if (cast) drawBar(cast.config, framePoint(rect, cast.config.HealthBarAnchor), `${name} / cast`, disabled, cast.path, { fillRatio: .5 }, sampleName);
                const enmity = byType.get('EnemyListEnmityIconConfig');
                if (enmity) drawIcon(enmity.config, rect, `${name} / enmity`, disabled, enmity.path, enmity.config.HealthBarAnchor, '▲');
                if (showSign) drawIcon(sign.config, rect, `${name} / sign`, disabled, sign.path, sign.config.HealthBarAnchor, '1');
                sharedNotes(first, positionPath(path), 'enemy list');
            }
        }

        for (const [type, entry] of byType) {
            const { config, path } = entry, name = friendly(type), disabled = disabledFor(config);
            if (!visible(disabled)) continue;
            if (String(config.$type).includes('.Jobs.')) {
                if (type === options.job) {
                    jobBars(config, add(origin, vec(config.Position)), name, disabled, path, type.replace(/Config$/, ''));
                }
            } else if (type === 'PartyFramesConfig') {
                drawParty();
            } else if (type === 'EnemyListConfig') {
                drawEnemyList();
            } else if (/^(PartyFrames|EnemyList)/.test(type)) {
                continue;
            } else if (/Nameplate|^PartyCooldowns/.test(type)) {
                continue;
            } else if (type === 'GCDIndicatorConfig') {
                const base = config.AnchorToMouse ? options.mousePosition || scene.center : origin;
                if (config.CircularMode) {
                    const radius = Math.max(1, Number(config.CircleRadius) || 40), thickness = Math.max(1, Number(config.CircleThickness) || 10);
                    const size = { x: radius * 2, y: radius * 2 };
                    const center = topLeft(add(add(base, vec(config.Position)), { x: radius, y: radius }), size, config.Anchor);
                    emit(config, { x: center.x - radius - thickness / 2, y: center.y - radius - thickness / 2 },
                        { x: radius * 2 + thickness, y: radius * 2 + thickness }, name, 'circle', disabled, positionPath(path),
                        { fillRatio: .6, circleThickness: thickness, startAngle: Number(config.CircleStartAngle) || 0, rotateCCW: config.RotateCCW === true });
                } else if (config.Bar) {
                    drawBar({ ...config.Bar, Enabled: config.Enabled, Position: config.Position, Anchor: config.Anchor,
                        FillColor: config.FillColor, BackgroundColor: config.BackgroundColor, DrawBorder: config.ShowBorder }, base, name, disabled, path, { fillRatio: .6 });
                }
            } else if (type === 'MPTickerConfig' && config.Bar) {
                drawBar(config.Bar, add(origin, vec(config.Position)), name, disabled, [...path, 'Bar'], { fillRatio: .7 });
            } else if (/BuffsList|DebuffsList|CustomEffectsList/.test(type)) {
                drawStatuses(config, parentPoint(config), name, disabled, path);
            } else if (config.Size && config.Position && config.FillColor) {
                const rect = drawBar(config, parentPoint(config), name, disabled, path,
                    type === 'LimitBreakConfig' ? { chunks: config.UseChunks === false ? 1 : 3, chunkGap: Number(config.Padding) || 0, fillRatio: .55 } : {},
                    /^Player/.test(type) ? options.dummyName : options.dummyTarget);
                if (rect && /UnitFrameConfig$/.test(type)) {
                    drawIcon(config.RoleIconConfig, rect, `${name} / role icon`, disabled, [...path, 'RoleIconConfig'], undefined, '◆');
                }
            } else if (config.Position || config.Size) {
                skipped.push(`${name}: unsupported layout`);
            }
        }
        extra.build(profile, scene);
    }

    const api = { build };
    if (typeof module !== 'undefined') module.exports = api;
    root.DelvUIPreview = api;
})(globalThis);
