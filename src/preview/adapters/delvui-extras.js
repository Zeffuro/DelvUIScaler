(function (root) {
    const stateApi = typeof module !== 'undefined' ? require('../state.js') : root.PreviewState;
    const nameplateTypes = ['PlayerNameplateConfig', 'EnemyNameplateConfig', 'PartyMembersNameplateConfig',
        'AllianceMembersNameplateConfig', 'FriendPlayerNameplateConfig', 'OtherPlayerNameplateConfig',
        'PetNameplateConfig', 'NPCNameplateConfig', 'MinionNPCNameplateConfig', 'ObjectsNameplateConfig'];
    const jobs = [19, 21, 24, 28, 20, 23, 25, 42];
    const jobCodes = { 19: 'PLD', 21: 'WAR', 32: 'DRK', 37: 'GNB', 24: 'WHM', 28: 'SCH', 33: 'AST', 40: 'SGE',
        20: 'MNK', 22: 'DRG', 30: 'NIN', 34: 'SAM', 39: 'RPR', 41: 'VPR', 23: 'BRD', 31: 'MCH', 38: 'DNC',
        25: 'BLM', 27: 'SMN', 35: 'RDM', 42: 'PCT', 36: 'BLU' };
    const jobNames = ['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker', 'WhiteMage', 'Scholar', 'Astrologian', 'Sage',
        'Monk', 'Dragoon', 'Ninja', 'Samurai', 'Reaper', 'Viper', 'Bard', 'Machinist', 'Dancer', 'BlackMage', 'Summoner', 'RedMage', 'Pictomancer', 'BlueMage'];
    const namedJobIds = [19, 21, 32, 37, 24, 28, 33, 40, 20, 22, 30, 34, 39, 41, 23, 31, 38, 25, 27, 35, 42, 36];
    const roles = { 19: 0, 21: 0, 32: 0, 37: 0, 24: 1, 28: 1, 33: 1, 40: 1,
        20: 2, 22: 2, 30: 2, 34: 2, 39: 2, 41: 2, 23: 3, 31: 3, 38: 3, 25: 4, 27: 4, 35: 4, 42: 4, 36: 4 };
    const posPath = path => [...path, 'Position'];
    const rectFor = (point, size) => ({ x: point.x, y: point.y, width: size.x, height: size.y });
    const isDisabled = (config, scene) => config?.Enabled === false || config?.VisibilityConfig?.AlwaysHide === true ||
        Boolean(scene && stateApi && !stateApi.visible(config?.VisibilityConfig, scene.options, false));
    function framePoint(scene, rect, value) {
        const a = scene.util.anchor(value);
        return { x: rect.x + rect.width * a[0], y: rect.y + rect.height * a[1] };
    }
    function icon(scene, config, rect, name, disabled, path, symbol) {
        if (!config) return;
        const { vec, add, topLeft } = scene.util;
        const size = vec(config.Size), point = topLeft(add(framePoint(scene, rect, config.FrameAnchor), vec(config.Position)), size, config.Anchor);
        return scene.emit(config, point, size, name, 'icon', disabled || isDisabled(config), posPath(path), { symbol, fillRatio: 1 });
    }
    function labelGeometry(scene, config, rect, text) {
        if (scene.labelGeometry) {
            const geometry = scene.labelGeometry(config, rect, false, text);
            return rectFor(geometry.point, geometry.size);
        }
        const { vec, add, topLeft } = scene.util;
        const fontSize = (Number(String(config.FontID || config.FontKey || '').match(/_(\d+)/)?.[1]) || 20) * (config.FontScale || 1);
        const width = scene.options.measureText ? scene.options.measureText(text, fontSize) : text.length * fontSize * .6;
        const size = { x: width, y: fontSize };
        return rectFor(topLeft(add(framePoint(scene, rect, config.FrameAnchor), vec(config.Position)), size, config.TextAnchor), size);
    }
    function fadeColor(value, alpha) {
        const rgba = String(value).match(/^rgba\(([^,]+),([^,]+),([^,]+),([^)]*)\)$/);
        if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${Math.min(Number(rgba[4]), alpha)})`;
        if (/^#[\da-f]{3}$/i.test(value)) value = '#' + value.slice(1).split('').map(digit => digit + digit).join('');
        if (/^#[\da-f]{6}$/i.test(value)) return `rgba(${[1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)).join(',')},${alpha})`;
        return value;
    }
    function actorColor(byType, jobId, useRole = false) {
        const role = roles[jobId];
        if (!useRole) return byType.get(['Tanks', 'Healers', 'Melee', 'Ranged', 'Casters'][role] + 'ColorConfig')?.config[jobCodes[jobId] + 'Color'];
        const palette = byType.get('RolesColorConfig')?.config;
        const key = role === 0 ? 'TankRoleColor' : role === 1 ? 'HealerRoleColor' : palette?.UseSpecificDPSColors ?
            ['MeleeDPSRoleColor', 'RangedDPSRoleColor', 'CasterDPSRoleColor'][role - 2] : 'DPSRoleColor';
        return palette?.[key];
    }
    function withAlpha(value, alpha) {
        const vector = value?.Vector || value;
        return vector ? { Vector: { ...vector, W: alpha } } : null;
    }
    function drawNameplate(scene, config, path, type, general, byType) {
        const { vec, add, topLeft, friendly, sampleText, clamp } = scene.util;
        const options = scene.options, index = nameplateTypes.indexOf(type);
        const targeted = (options.nameplateTarget || 'EnemyNameplateConfig') === type;
        const disabled = isDisabled(config, scene) || isDisabled(general, scene) || config.OnlyShowWhenTargeted && !targeted;
        if (disabled && !options.showDisabled) return;
        const npc = index === 1 || index >= 6, actorKind = npc ? 'npc' : 'player';
        const selectedJob = namedJobIds[jobNames.indexOf(String(options.job || 'Paladin').replace(/Config$/, ''))] || 19;
        const actorJob = index === 0 ? options.jobId || selectedJob : jobs[index % jobs.length];
        const coloredLabel = child => ({ ...child, Color: !npc && (child.UseJobColor || child.UseRoleColor) ?
            actorColor(byType, actorJob, !child.UseJobColor) || child.Color : child.Color });
        const sampleName = index === 0 ? options.dummyName : index === 1 ? options.dummyTarget :
            ['','','Party Member','Alliance Member','Friend Player','Other Player','Fairy','Shopkeeper','Wind-up Companion','Aetheryte'][index];
        const title = npc ? index === 7 ? 'Merchant' : '' : 'The Liberator';
        const screen = { x: scene.width * (.12 + index % 5 * .19), y: scene.height * (.23 + Math.floor(index / 5) * .2) };
        const parentOffset = vec(config.Position), bar = config.BarConfig, hp = clamp(options.hpPercent / 100, 0, 1);
        const barVisible = bar && !isDisabled(bar) && !(bar.OnlyShowWhenNotFull && hp >= 1) && !(bar.HideHealthAtZero && hp <= 0);
        const barSize = vec(targeted && bar?.UseDifferentSizeWhenTargeted ? bar.SizeWhenTargeted : bar?.Size);
        const barAnchor = barVisible ? rectFor(topLeft(add(screen, vec(bar.Position)), barSize, bar.Anchor), barSize) : null;
        const groupName = friendly(type), first = scene.elements.length;
        const distance = Number(options.nameplateDistance) || 12, range = config.RangeConfig;
        const opacity = range && range.Enabled !== false && distance > range.StartRange ?
            clamp(1 - (distance - range.StartRange) / (range.EndRange - range.StartRange), 0, 1) : 1;
        if (barVisible || bar && options.showDisabled) {
            const point = add(topLeft(add(screen, vec(bar.Position)), barSize, bar.Anchor), parentOffset);
            const style = { ...bar, BorderColor: targeted ? bar.TargetedBorderColor || bar.BorderColor : bar.BorderColor,
                BorderThickness: targeted ? bar.TargetedBorderThickness ?? bar.BorderThickness : bar.BorderThickness };
            if (!npc && (bar.UseJobColor || bar.UseRoleColor)) style.FillColor = actorColor(byType, actorJob, !bar.UseJobColor) || style.FillColor;
            if (!npc && (bar.UseJobColorAsBackgroundColor || bar.UseRoleColorAsBackgroundColor)) {
                style.BackgroundColor = actorColor(byType, actorJob, !bar.UseJobColorAsBackgroundColor) || style.BackgroundColor;
            }
            if (index === 1 && bar.UseStateColor) style.FillColor = bar.EngagedColor || bar.FillColor;
            if (index === 1 && bar.UseCustomColorWhenBeingTargeted) style.FillColor = bar.CustomColorWhenBeingTargeted;
            const body = scene.emit(style, point, barSize, groupName + ' / health', 'bar', disabled || !barVisible,
                posPath([...path, 'BarConfig']), { fillRatio: hp, opacity });
            if (body) {
                for (const key of ['LeftLabelConfig', 'RightLabelConfig', 'OptionalLabelConfig']) {
                    const child = bar[key];
                    if (child) scene.label({ ...coloredLabel(child), Text: sampleText(child.Text || '', options, sampleName, actorKind) }, body,
                        groupName + ' / health / ' + friendly(key), disabled || !barVisible, posPath([...path, 'BarConfig', key]));
                }
            }
        }
        const labelBase = barAnchor ? { ...barAnchor, ...add(barAnchor, parentOffset) } : rectFor(add(screen, parentOffset), { x: 0, y: 0 });
        const nameConfig = config.NameLabelConfig, titleConfig = config.TitleLabelConfig;
        const swap = config.SwapLabelsWhenNeeded && (options.nameplateTitlePrefix || !title) && nameConfig && titleConfig ?
            { x: vec(titleConfig.Position).x - vec(nameConfig.Position).x, y: vec(titleConfig.Position).y - vec(nameConfig.Position).y } : { x: 0, y: 0 };
        const labels = {};
        for (const [key, offset] of [['NameLabelConfig', swap], ['TitleLabelConfig', { x: -swap.x, y: -swap.y }]]) {
            const child = config[key];
            if (!child || key === 'TitleLabelConfig' && !title) continue;
            const text = sampleText(String(child.Text || '').replace(/\[title\]/gi, title), options, sampleName, actorKind);
            const rect = { ...labelBase, x: labelBase.x + offset.x, y: labelBase.y + offset.y };
            if (child.Enabled !== false && text) labels[key] = labelGeometry(scene, child, rect, text);
            const drawn = scene.label({ ...coloredLabel(child), Text: text }, rect, groupName + ' / ' + friendly(key), disabled, posPath([...path, key]));
            if (drawn) drawn.opacity = opacity;
        }
        function extrasAnchor(child) {
            if (child.PrioritizeHealthBarAnchor && barAnchor) return barAnchor;
            const name = labels.NameLabelConfig, title = labels.TitleLabelConfig;
            let chosen = child.NameplateLabelAnchor === 1 ? title : name;
            if (name && title && [2, 3].includes(child.NameplateLabelAnchor)) {
                chosen = name.y === title.y ? null : child.NameplateLabelAnchor === 2 ? name.y < title.y ? name : title : name.y > title.y ? name : title;
            }
            return chosen || name || title || rectFor(screen, { x: 0, y: 0 });
        }
        for (const [key, symbol] of [['RoleIconConfig', '◆'], ['StateIconConfig', '×'], ['IconConfig', '◆']]) {
            const child = config[key];
            if (!child) continue;
            let rect = extrasAnchor(child);
            // Enemy icons add the nameplate offset; player extras use the resolved anchor directly.
            if (key === 'IconConfig') rect = { ...rect, x: rect.x + parentOffset.x, y: rect.y + parentOffset.y };
            const drawn = icon(scene, child, rect, groupName + ' / ' + friendly(key), disabled, [...path, key], symbol);
            if (drawn) drawn.opacity = opacity;
        }
        if (index === 1) {
            const extraBase = barAnchor || labels.NameLabelConfig || rectFor(add(screen, parentOffset), { x: 0, y: 0 });
            if (bar?.OrderLabelConfig) scene.label({ ...bar.OrderLabelConfig, Text: 'A' }, extraBase, groupName + ' / order', disabled,
                posPath([...path, 'BarConfig', 'OrderLabelConfig']));
            const debuffs = config.DebuffsConfig;
            if (debuffs) scene.statuses(debuffs, framePoint(scene, extraBase, debuffs.HealthBarAnchor), groupName + ' / debuffs',
                disabled || isDisabled(debuffs), posPath([...path, 'DebuffsConfig']));
            const cast = config.CastbarConfig;
            if (cast && (!isDisabled(cast) || options.showDisabled)) {
                const size = vec(cast.Size);
                if (cast.MatchWidth) size.x = extraBase.width;
                if (cast.MatchHeight) size.y = extraBase.height;
                const point = topLeft(add(framePoint(scene, extraBase, cast.HealthBarAnchor), vec(cast.Position)), size, cast.Anchor);
                const rect = rectFor(point, size), castDisabled = disabled || isDisabled(cast, scene);
                scene.emit(cast, point, size, groupName + ' / cast', 'bar', castDisabled,
                    posPath([...path, 'CastbarConfig']), { fillRatio: .55, opacity });
                const iconSize = cast.SeparateIcon ? vec(cast.CustomIconSize) : { x: size.y, y: size.y };
                if (cast.ShowIcon) scene.emit(cast, cast.SeparateIcon ? add(point, vec(cast.CustomIconPosition)) : point, iconSize,
                    groupName + ' / cast icon', 'icon', castDisabled,
                    cast.SeparateIcon ? [...path, 'CastbarConfig', 'CustomIconPosition'] : posPath([...path, 'CastbarConfig']),
                    { symbol: '✦', fillRatio: 1, opacity });
                for (const key of ['CastNameLabel', 'CastTimeLabel']) {
                    const child = cast[key];
                    if (!child) continue;
                    const offset = cast.ShowIcon && !cast.SeparateIcon && [1, 4, 7].includes(child.TextAnchor) ? iconSize.x : 0;
                    scene.label({ ...child, Text: key === 'CastNameLabel' ? 'Ancient Flare' : cast.ShowMaxCastTime ? '1.2 / 2.5' : '1.2' },
                        { ...rect, x: rect.x + offset }, groupName + ' / ' + friendly(key), castDisabled, posPath([...path, 'CastbarConfig', key]));
                }
            }
        }
        const children = scene.elements.slice(first);
        for (const child of children) {
            child.opacity = child.kind === 'icon' ? opacity : 1;
            if (child.kind !== 'icon') for (const key of ['fill', 'background', 'border', 'outline']) child[key] = fadeColor(child[key], opacity);
        }
        if (children.length) {
            const x = Math.min(...children.map(e => e.x)), y = Math.min(...children.map(e => e.y));
            const width = Math.max(...children.map(e => e.x + e.width)) - x, height = Math.max(...children.map(e => e.y + e.height)) - y;
            const group = scene.emit(config, { x, y }, { x: width, y: height }, groupName, 'group', disabled, posPath(path),
                { note: 'Dummy actor position. Moves the nameplate offset; child anchors follow DelvUI.' });
            if (group) {
                const moving = children.find(child => /\/ health$|\/ Name Label$|\/ Title Label$/.test(child.name));
                if (moving) {
                    group.snapPoint = { x: moving.x, y: moving.y };
                    group.alignmentRect = { x: moving.x, y: moving.y, width: moving.width, height: moving.height };
                    group.note = 'Snaps the health or name corner. Aligns that frame. Moves the nameplate offset.';
                }
                scene.elements.pop(); scene.elements.splice(first, 0, group);
            }
        }
    }
    function usable(data, jobId) {
        const values = value => Array.isArray(value) ? value : value?.$values || [];
        if (values(data.ExcludedJobIds).includes(jobId)) return false;
        if (data.RequiredLevel > 100 || data.DisabledAfterLevel > 0 && data.DisabledAfterLevel <= 100) return false;
        if (data.Roles != null) return values(data.Roles).includes(roles[jobId]);
        if (data.Role != null && data.Role !== 7) return data.Role === roles[jobId];
        if (data.JobIds != null) return values(data.JobIds).includes(jobId);
        return data.JobId === jobId;
    }
    function drawCooldowns(profile, scene, byType) {
        const entry = byType.get('PartyCooldownsConfig');
        if (!entry) return;
        const barEntry = byType.get('PartyCooldownsBarConfig');
        if (!barEntry) { scene.skipped.push('Party Cooldowns: bar config is missing from this export'); return; }
        const { config, path } = entry, bar = barEntry.config, options = scene.options;
        const count = Math.max(1, Math.min(8, Number(options.partyCount) || 8));
        const disabled = isDisabled(config, scene) || count === 1 && config.ShowWhenSolo === false;
        if (disabled && !options.showDisabled) return;
        const { vec, add } = scene.util, hud = byType.get('HUDOptionsConfig')?.config;
        const origin = add(scene.center, hud?.UseGlobalHudShift ? vec(hud.HudOffset) : vec(null));
        const base = add(origin, vec(config.Position)), fullSize = vec(bar.Size), padding = vec(config.Padding);
        const size = { x: Math.max(1, fullSize.x - fullSize.y), y: fullSize.y };
        const dataEntry = byType.get('PartyCooldownsDataConfig'), data = dataEntry?.config.Cooldowns;
        const tracked = Array.isArray(data) ? data : data?.$values;
        const samples = tracked || jobs.map((JobId, i) => ({ JobId, ActionId: i + 1, Column: i % 3 + 1, CooldownDuration: 120, EffectDuration: 15, Priority: i }));
        const columns = Array.from({ length: 5 }, () => []);
        for (const item of samples) {
            if (![0, 1].includes(item.EnabledV2 ?? 0)) continue;
            for (let member = 0; member < count; member++) {
                if (usable(item, jobs[member])) columns[Math.max(0, Math.min(4, (item.Column || 1) - 1))].push({ item, member });
            }
        }
        const vertical = (config.GrowthDirection || 0) < 2, direction = [1, -1, 1, -1][config.GrowthDirection || 0];
        let section = 0;
        for (const list of columns) {
            if (!list.length) continue;
            list.sort((a, b) => (a.item.Priority || 0) - (b.item.Priority || 0) || (a.item.ActionId || 0) - (b.item.ActionId || 0) || a.member - b.member);
            const offset = section * (vertical ? fullSize.x + padding.x : fullSize.y + padding.y);
            for (let i = 0; i < list.length; i++) {
                const { item, member } = list[i];
                const state = ['active', 'recharging', 'ready'].includes(options.cooldownState) ? options.cooldownState : ['active', 'recharging', 'ready'][(i + section) % 3];
                const active = state === 'active', ready = state === 'ready';
                const point = vertical ? { x: base.x + size.y + offset - 1, y: base.y + i * direction * (size.y + padding.y) } :
                    { x: base.x + size.y + i * direction * (fullSize.x + padding.x), y: base.y + offset - 1 };
                const rect = rectFor(point, size), name = `Party Cooldowns / section ${section + 1} / member ${member + 1} / action ${item.ActionId || i + 1}`;
                const style = { ...bar, FillColor: active ? bar.AvailableColor : bar.RechargingColor,
                    BackgroundColor: active || ready ? bar.AvailableBackgroundColor : bar.RechargingBackgroundColor };
                const jobColor = bar.UseJobColors ? actorColor(byType, jobs[member]) : null;
                if (jobColor) {
                    style.FillColor = withAlpha(jobColor, active ? 1 : .25);
                    style.BackgroundColor = active || ready ? withAlpha(jobColor, .4) : { Vector: { X: 0, Y: 0, Z: 0, W: 136 / 255 } };
                }
                const remaining = active ? Math.max(1, Math.round((item.EffectDuration || 15) * .6)) : ready ? 0 : Math.max(1, Math.round((item.CooldownDuration || 120) * .45));
                if (bar.ShowBar !== false) scene.emit(style, point, size, name, 'bar', disabled, posPath(path),
                    { fillRatio: active ? .6 : ready ? 0 : .45, note: 'Moves every cooldown section' });
                if (bar.ShowIcon !== false) scene.emit({ ...bar, BorderColor: active && bar.ChangeIconBorderWhenActive ? bar.IconActiveBorderColor : bar.BorderColor,
                    BorderThickness: active && bar.ChangeIconBorderWhenActive ? bar.IconActiveBorderThickness : bar.BorderThickness },
                    { x: point.x - size.y + 1, y: point.y }, { x: size.y, y: size.y }, name + ' / icon', 'icon', disabled, posPath(path),
                    { symbol: '✦', fillRatio: .45, swipe: !active && !ready && bar.ShowIconCooldownAnimation, note: 'Moves every cooldown section' });
                for (const key of ['NameLabel', 'TimeLabel']) {
                    const child = bar[key];
                    if (!child) continue;
                    if (key === 'TimeLabel' && (ready || (active ? child.ShowEffectDuration === false : child.ShowRemainingCooldown === false))) continue;
                    scene.label({ ...child, Text: key === 'TimeLabel' ? String(remaining) : child.Text,
                        Color: active && bar.ChangeLabelsColorWhenActive ? bar.LabelsActiveColor : child.Color }, rect, name + ' / ' + key,
                        disabled, posPath([...barEntry.path, key]), member === 0 ? options.dummyName : `Party Member ${member + 1}`);
                }
            }
            section++;
        }
    }
    function drawTrackers(scene, config, path, rect, name, disabled, memberIndex = 0, body = null) {
        const state = scene.options.partyState || 'normal', { color } = scene.util;
        const active = kind => state === kind || state === 'all' && memberIndex % 3 === ['raise', 'invuln', 'cleanse'].indexOf(kind);
        const raise = active('raise') && config.Raise && !isDisabled(config.Raise);
        const invuln = active('invuln') && config.Invuln && !isDisabled(config.Invuln);
        const job = String(scene.options.job || 'WhiteMage').replace(/Config$/, '');
        const cleanse = active('cleanse') && config.Cleanse && !isDisabled(config.Cleanse) &&
            (!config.Cleanse?.CleanseJobsOnly || ['WhiteMage', 'Scholar', 'Astrologian', 'Sage', 'Bard', 'BlueMage'].includes(job));
        if (body) {
            if (raise && config.Raise.ChangeBackgroundColorWhenRaised) body.background = color(config.Raise.BackgroundColor, body.background);
            else if (invuln && config.Invuln.ChangeBackgroundColorWhenInvuln) body.background = color(config.Invuln.BackgroundColor, body.background);
            if (cleanse && config.Cleanse.ChangeHealthBarCleanseColor) body.fill = color(config.Cleanse.HealthBarColor, body.fill);
            if (cleanse && config.Cleanse.ChangeBorderCleanseColor) body.border = color(config.Cleanse.BorderColor, body.border);
            else if (raise && config.Raise.ChangeBorderColorWhenRaised) body.border = color(config.Raise.BorderColor, body.border);
        }
        for (const [key, showing, symbol] of [['Raise', raise, '↑'], ['Invuln', invuln, '◆']]) {
            const tracker = config[key];
            if (!showing || !tracker) continue;
            icon(scene, tracker.Icon, rect, name + ' / ' + key.toLowerCase(), disabled, [...path, key, 'Icon'], symbol);
            if (tracker.Icon?.NumericLabel) scene.label({ ...tracker.Icon.NumericLabel, Text: key === 'Raise' ? '4.2' : '8.0' }, rect,
                name + ' / ' + key.toLowerCase() + ' / duration', disabled, posPath([...path, key, 'Icon', 'NumericLabel']));
        }
        return { hideName: Boolean(raise && config.Raise.HideNameWhenRaised || invuln && config.Invuln.HideNameWhenInvuln) };
    }
    function build(profile, scene) {
        const byType = new Map(profile.configs.map((config, index) => [scene.util.typeName(config), { config, path: ['configs', index] }]));
        const general = byType.get('NameplatesGeneralConfig')?.config;
        for (const type of nameplateTypes) {
            const entry = byType.get(type);
            if (entry) drawNameplate(scene, entry.config, entry.path, type, general, byType);
        }
        drawCooldowns(profile, scene, byType);
    }
    const api = { build, drawTrackers, nameplateTypes };
    if (typeof module !== 'undefined') module.exports = api;
    root.DelvUIExtra = api;
})(globalThis);
