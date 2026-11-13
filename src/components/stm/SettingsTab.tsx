'use client';

import { Fragment, useEffect, useState } from 'react';
import type { Lang, MsgKey } from '@/lib/stm/i18n';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/stm/types';
import { useT } from './i18n';
import type { Mode } from './StmApp';
import { IconCheck, IconSpin, dateTime } from './ui';

const THEMES: [string, MsgKey, string][] = [
    ['kueche', 'theme.kueche', 'linear-gradient(135deg, #f3dcc6, #c25a2c 55%, #6f7d4a)'],
    ['homelab', 'theme.homelab', 'linear-gradient(135deg, #dfe8f3, #1e4a78 55%, #0b6a52)'],
    ['kraeuter', 'theme.kraeuter', 'linear-gradient(135deg, #e6ecd8, #78965f 55%, #c9a874)'],
    ['nacht', 'theme.nacht', 'linear-gradient(135deg, #2a2a3a, #505a8c 55%, #c08a2a)'],
];

const LANG_NAMES: [Lang, string][] = [
    ['de', 'Deutsch'],
    ['en', 'English'],
];

type Info = {
    gotify: boolean;
    claude: boolean;
    fastModel: string;
    smartModel: string;
    localWhisper: string;
    mealieUrl: string;
    appUrl: string;
    retentionDays: number;
    cookies?: { platform: string; state: 'ok' | 'expiring' | 'expired'; expires: string | null }[];
};

const RULES: [keyof Settings['rules'], MsgKey, MsgKey][] = [
    ['translate', 'rule.translate', 'rule.translateHelp'],
    ['metric', 'rule.metric', 'rule.metricHelp'],
    ['spoons', 'rule.spoons', 'rule.spoonsHelp'],
    ['oven', 'rule.oven', 'rule.ovenHelp'],
    ['existingTags', 'rule.existingTags', 'rule.existingTagsHelp'],
];

/** Replaces {name} placeholders in a translated text with <code>name</code>. */
function withCode(text: string) {
    return text.split(/(\{[a-z]+\})/).map((part, i) =>
        /^\{[a-z]+\}$/.test(part) ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>,
    );
}

type Props = {
    theme: string;
    mode: Mode;
    lang: Lang;
    setTheme: (t: string) => void;
    setMode: (m: Mode) => void;
    setLang: (l: Lang) => void;
};

export function SettingsTab({ theme, mode, lang, setTheme, setMode, setLang }: Props) {
    const t = useT();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [info, setInfo] = useState<Info | null>(null);
    const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        fetch('/api/settings')
            .then((r) => r.json())
            .then((b) => setSettings(b.settings ?? DEFAULT_SETTINGS))
            .catch(() => setSettings(DEFAULT_SETTINGS));
        fetch('/api/meta')
            .then((r) => r.json())
            .then((b) => setInfo(b.info))
            .catch(() => undefined);
    }, []);

    if (!settings) {
        return (
            <section className='stm-empty stm-glass' aria-busy='true'>
                <IconSpin /> {t('common.loading')}
            </section>
        );
    }

    const save = async (next: Settings) => {
        setSettings(next);
        setState('saving');
        try {
            const res = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) });
            setState(res.ok ? 'saved' : 'error');
        } catch {
            setState('error');
        }
    };
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const status =
        state === 'saving' ? t('settings.saving') : state === 'saved' ? t('settings.saved') : state === 'error' ? t('settings.error') : t('settings.forAll');

    return (
        <div className='stm-cols'>
            <main className='stm-main'>
                <section className='stm-card stm-glass' aria-labelledby='stm-rules-h'>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <h2 id='stm-rules-h' className='stm-h2'>
                            {t('settings.rules')}
                        </h2>
                        <span className='stm-small' role='status'>
                            {status}
                        </span>
                    </div>

                    <div className='stm-switch-row' style={{ marginTop: 10 }}>
                        <span>
                            <strong>{t('settings.recipeLang')}</strong>
                            <br />
                            <span className='stm-small'>{t('settings.recipeLangHelp')}</span>
                        </span>
                        <div className='stm-segment' role='radiogroup' aria-label={t('settings.recipeLang')}>
                            {LANG_NAMES.map(([v, l]) => (
                                <button key={v} type='button' role='radio' aria-checked={settings.language === v} aria-pressed={settings.language === v} onClick={() => save({ ...settings, language: v })}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        {RULES.map(([key, label, help]) => (
                            <div key={key} className='stm-switch-row'>
                                <span>
                                    <strong>{t(label)}</strong>
                                    <br />
                                    <span className='stm-small'>{t(help)}</span>
                                </span>
                                <button
                                    type='button'
                                    role='switch'
                                    aria-checked={settings.rules[key]}
                                    aria-label={t(label)}
                                    className='stm-switch'
                                    onClick={() => save({ ...settings, rules: { ...settings.rules, [key]: !settings.rules[key] } })}
                                >
                                    <span />
                                </button>
                            </div>
                        ))}
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                        <span className='stm-label'>{t('settings.freeText')}</span>
                        <textarea
                            className='stm-input'
                            rows={4}
                            value={settings.freeText}
                            placeholder={t('settings.freeTextPh')}
                            onChange={(e) => setSettings({ ...settings, freeText: e.target.value })}
                            onBlur={() => save(settings)}
                        />
                    </label>

                    <fieldset style={{ border: 'none', padding: 0, margin: '18px 0 0' }}>
                        <legend className='stm-label' style={{ marginBottom: 8 }}>
                            {t('settings.model')}
                        </legend>
                        <div className='stm-segment' role='radiogroup' style={{ width: 'fit-content', flexWrap: 'wrap' }}>
                            {(
                                [
                                    ['auto', t('settings.modelAuto')],
                                    ['fast', t('settings.modelFast')],
                                    ['smart', t('settings.modelSmart')],
                                ] as [Settings['model'], string][]
                            ).map(([v, l]) => (
                                <button key={v} type='button' role='radio' aria-checked={settings.model === v} aria-pressed={settings.model === v} onClick={() => save({ ...settings, model: v })}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <p className='stm-small' style={{ margin: '8px 0 0' }}>
                            {t('settings.modelHelp')}
                        </p>
                    </fieldset>
                </section>
            </main>

            <aside className='stm-side'>
                <section className='stm-card stm-glass' aria-labelledby='stm-look-h'>
                    <h3 id='stm-look-h' className='stm-h4' style={{ marginBottom: 10 }}>
                        {t('settings.look')}
                    </h3>
                    <div className='stm-swatches' role='radiogroup' aria-label={t('settings.theme')}>
                        {THEMES.map(([v, l, bg]) => (
                            <button key={v} type='button' role='radio' aria-checked={theme === v} className='stm-swatch' onClick={() => setTheme(v)}>
                                <i style={{ background: bg }} aria-hidden='true' />
                                {t(l)}
                            </button>
                        ))}
                    </div>
                    <div className='stm-segment' role='radiogroup' aria-label={t('settings.lightDark')} style={{ marginTop: 12, width: 'fit-content' }}>
                        {(
                            [
                                ['light', t('mode.light')],
                                ['dark', t('mode.dark')],
                                ['auto', t('mode.auto')],
                            ] as [Mode, string][]
                        ).map(([m, l]) => (
                            <button key={m} type='button' role='radio' aria-checked={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <p className='stm-label' style={{ margin: '14px 0 8px' }}>
                        {t('settings.uiLang')}
                    </p>
                    <div className='stm-segment' role='radiogroup' aria-label={t('settings.uiLang')} style={{ width: 'fit-content' }}>
                        {LANG_NAMES.map(([v, l]) => (
                            <button key={v} type='button' role='radio' lang={v} aria-checked={lang === v} aria-pressed={lang === v} onClick={() => setLang(v)}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <p className='stm-small' style={{ margin: '8px 0 0' }}>
                        {t('settings.deviceOnly')}
                    </p>
                </section>

                <section className='stm-card stm-glass' aria-labelledby='stm-share-h'>
                    <h3 id='stm-share-h' className='stm-h4' style={{ marginBottom: 10 }}>
                        {t('settings.share')}
                    </h3>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('settings.iphone')}</p>
                    <ol className='stm-small' style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.6, listStyle: 'decimal' }}>
                        <li>{t('settings.ios1')}</li>
                        <li>
                            {t('settings.ios2')}
                            <code className='stm-code'>{origin}/api/jobs</code>
                        </li>
                        <li>{withCode(t('settings.ios3'))}</li>
                        <li>{withCode(t('settings.ios4'))}</li>
                    </ol>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('settings.android')}</p>
                    <p className='stm-small' style={{ margin: 0 }}>
                        {t('settings.androidText')}
                    </p>
                </section>

                {info && (
                    <section className='stm-card stm-glass' aria-labelledby='stm-info-h'>
                        <h3 id='stm-info-h' className='stm-h4' style={{ marginBottom: 10 }}>
                            {t('settings.connections')}
                        </h3>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(
                                [
                                    ['Claude', info.claude, info.claude ? `${info.fastModel} / ${info.smartModel}` : t('settings.claudeMissing')],
                                    ['Mealie', Boolean(info.mealieUrl), info.mealieUrl],
                                    ['Gotify', info.gotify, info.gotify ? t('settings.gotifyOn') : t('settings.gotifyOff')],
                                    [t('settings.transcription'), Boolean(info.localWhisper), info.localWhisper || t('settings.transcriptionNone')],
                                    ...(info.cookies && info.cookies.length > 0
                                        ? info.cookies.map(
                                              (c) =>
                                                  [
                                                      t('settings.cookiesFor', { platform: c.platform }),
                                                      c.state === 'ok',
                                                      c.state === 'expired'
                                                          ? t('settings.cookiesExpired', { date: c.expires ? dateTime(lang, c.expires) : '?' })
                                                          : c.expires
                                                            ? t(c.state === 'expiring' ? 'settings.cookiesExpiring' : 'settings.cookiesValid', { date: dateTime(lang, c.expires) })
                                                            : t('settings.cookiesSession'),
                                                  ] as [string, boolean, string],
                                          )
                                        : [[t('settings.cookies'), false, t('settings.cookiesNone')] as [string, boolean, string]]),
                                ] as [string, boolean, string][]
                            ).map(([name, ok, detail]) => (
                                <li key={name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span className='stm-step-icon' style={{ width: 22, height: 22, background: ok ? 'var(--ok)' : 'var(--soft)', color: ok ? '#fff' : 'var(--muted)' }} aria-hidden='true'>
                                        {ok ? <IconCheck size={13} /> : '–'}
                                    </span>
                                    <span style={{ minWidth: 0 }}>
                                        <strong>{name}</strong>
                                        <br />
                                        <span className='stm-small' style={{ wordBreak: 'break-all' }}>
                                            {detail}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className='stm-small' style={{ margin: '12px 0 0' }}>
                            {t('settings.retention', { n: info.retentionDays })}
                        </p>
                    </section>
                )}
            </aside>
        </div>
    );
}
