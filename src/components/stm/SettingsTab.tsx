'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/stm/types';
import type { Mode } from './StmApp';
import { IconCheck, IconSpin } from './ui';

const THEMES: [string, string, string][] = [
    ['kueche', 'Küche', 'linear-gradient(135deg, #f3dcc6, #c25a2c 55%, #6f7d4a)'],
    ['homelab', 'Homelab', 'linear-gradient(135deg, #dfe8f3, #1e4a78 55%, #0b6a52)'],
    ['kraeuter', 'Kräuter', 'linear-gradient(135deg, #e6ecd8, #78965f 55%, #c9a874)'],
    ['nacht', 'Nacht', 'linear-gradient(135deg, #2a2a3a, #505a8c 55%, #c08a2a)'],
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
};

const RULES: [keyof Settings['rules'], string, string][] = [
    ['german', 'Auf Deutsch', 'Titel, Zutaten und Schritte immer deutsch'],
    ['metric', 'Metrisch', 'Gramm, Milliliter, °C statt Cups und °F'],
    ['spoons', 'EL / TL', 'Esslöffel und Teelöffel als Einheit'],
    ['oven', 'Ofenart angeben', 'Ober-/Unterhitze oder Umluft immer nennen'],
    ['existingTags', 'Nur vorhandene Tags', 'Claude wählt nur Tags und Kategorien, die es in Mealie schon gibt'],
];

type Props = { theme: string; mode: Mode; setTheme: (t: string) => void; setMode: (m: Mode) => void };

export function SettingsTab({ theme, mode, setTheme, setMode }: Props) {
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
                <IconSpin /> Lädt …
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

    return (
        <div className='stm-cols'>
            <main className='stm-main'>
                <section className='stm-card stm-glass' aria-labelledby='stm-rules-h'>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <h2 id='stm-rules-h' className='stm-h2'>
                            Hausregeln für Claude
                        </h2>
                        <span className='stm-small' role='status'>
                            {state === 'saving' ? 'speichert …' : state === 'saved' ? 'gespeichert' : state === 'error' ? 'Fehler beim Speichern' : 'gilt für alle'}
                        </span>
                    </div>
                    <div style={{ marginTop: 10 }}>
                        {RULES.map(([key, label, help]) => (
                            <div key={key} className='stm-switch-row'>
                                <span>
                                    <strong>{label}</strong>
                                    <br />
                                    <span className='stm-small'>{help}</span>
                                </span>
                                <button
                                    type='button'
                                    role='switch'
                                    aria-checked={settings.rules[key]}
                                    aria-label={label}
                                    className='stm-switch'
                                    onClick={() => save({ ...settings, rules: { ...settings.rules, [key]: !settings.rules[key] } })}
                                >
                                    <span />
                                </button>
                            </div>
                        ))}
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                        <span className='stm-label'>Eigene Hinweise</span>
                        <textarea
                            className='stm-input'
                            rows={4}
                            value={settings.freeText}
                            placeholder='z. B. „Wir haben einen Thermomix“ oder „Immer für 4 Personen umrechnen“'
                            onChange={(e) => setSettings({ ...settings, freeText: e.target.value })}
                            onBlur={() => save(settings)}
                        />
                    </label>

                    <fieldset style={{ border: 'none', padding: 0, margin: '18px 0 0' }}>
                        <legend className='stm-label' style={{ marginBottom: 8 }}>
                            Modell
                        </legend>
                        <div className='stm-segment' role='radiogroup' style={{ width: 'fit-content', flexWrap: 'wrap' }}>
                            {(
                                [
                                    ['auto', 'Automatisch'],
                                    ['fast', 'Haiku (schnell)'],
                                    ['smart', 'Sonnet (gründlich)'],
                                ] as [Settings['model'], string][]
                            ).map(([v, l]) => (
                                <button key={v} type='button' role='radio' aria-checked={settings.model === v} aria-pressed={settings.model === v} onClick={() => save({ ...settings, model: v })}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <p className='stm-small' style={{ margin: '8px 0 0' }}>
                            Automatisch: Haiku fürs erste Schreiben, Sonnet bei „Neu schreiben“.
                        </p>
                    </fieldset>
                </section>
            </main>

            <aside className='stm-side'>
                <section className='stm-card stm-glass' aria-labelledby='stm-look-h'>
                    <h3 id='stm-look-h' className='stm-h4' style={{ marginBottom: 10 }}>
                        Darstellung
                    </h3>
                    <div className='stm-swatches' role='radiogroup' aria-label='Thema'>
                        {THEMES.map(([v, l, bg]) => (
                            <button key={v} type='button' role='radio' aria-checked={theme === v} className='stm-swatch' onClick={() => setTheme(v)}>
                                <i style={{ background: bg }} aria-hidden='true' />
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className='stm-segment' role='radiogroup' aria-label='Hell oder dunkel' style={{ marginTop: 12, width: 'fit-content' }}>
                        {(
                            [
                                ['light', 'Hell'],
                                ['dark', 'Dunkel'],
                                ['auto', 'Automatisch'],
                            ] as [Mode, string][]
                        ).map(([m, l]) => (
                            <button key={m} type='button' role='radio' aria-checked={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <p className='stm-small' style={{ margin: '8px 0 0' }}>
                        Gilt nur für dieses Gerät.
                    </p>
                </section>

                <section className='stm-card stm-glass' aria-labelledby='stm-share-h'>
                    <h3 id='stm-share-h' className='stm-h4' style={{ marginBottom: 10 }}>
                        Vom Handy teilen
                    </h3>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>iPhone – Kurzbefehl „An Mealie“</p>
                    <ol className='stm-small' style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.6 }}>
                        <li>Kurzbefehle → neuer Kurzbefehl, „Im Share-Sheet anzeigen“ an, Eingabe: URLs und Text.</li>
                        <li>
                            Aktion „Inhalte von URL abrufen“: <code style={{ wordBreak: 'break-all' }}>{origin}/api/jobs</code>
                        </li>
                        <li>Methode POST, Anfragetext JSON, Feld <code>url</code> = Kurzbefehleingabe.</li>
                        <li>Optional Feld <code>direct</code> = Ja für direktes Speichern.</li>
                    </ol>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Android</p>
                    <p className='stm-small' style={{ margin: 0 }}>
                        Seite im Chrome öffnen → Menü → „App installieren“. Danach taucht „Social → Mealie“ im Teilen-Menü auf.
                    </p>
                </section>

                {info && (
                    <section className='stm-card stm-glass' aria-labelledby='stm-info-h'>
                        <h3 id='stm-info-h' className='stm-h4' style={{ marginBottom: 10 }}>
                            Verbindungen
                        </h3>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(
                                [
                                    ['Claude', info.claude, info.claude ? `${info.fastModel} / ${info.smartModel}` : 'ANTHROPIC_API_KEY fehlt'],
                                    ['Mealie', Boolean(info.mealieUrl), info.mealieUrl],
                                    ['Gotify', info.gotify, info.gotify ? 'Meldet „bereit zum Prüfen“ und Fehler' : 'nicht eingerichtet'],
                                    ['Transkription', Boolean(info.localWhisper), info.localWhisper || 'nur Untertitel/Beschreibung'],
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
                            Verlauf wird nach {info.retentionDays} Tagen gelöscht, Entwürfe bleiben.
                        </p>
                    </section>
                )}
            </aside>
        </div>
    );
}
