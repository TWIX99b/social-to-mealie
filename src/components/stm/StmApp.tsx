'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ACTIVE_STATUSES, type Job, type StmEvent } from '@/lib/stm/types';
import { DraftsTab } from './DraftsTab';
import { HistoryTab } from './HistoryTab';
import { NewTab } from './NewTab';
import { ReviewView } from './ReviewView';
import { SettingsTab } from './SettingsTab';
import { IconMoon, IconPot, type PartialRecipe } from './ui';

export type Tab = 'neu' | 'entwuerfe' | 'verlauf' | 'einstellungen';
type Mode = 'light' | 'dark' | 'auto';
const THEMES = [
    ['kueche', 'Küche'],
    ['homelab', 'Homelab'],
    ['kraeuter', 'Kräuter'],
    ['nacht', 'Nacht'],
] as const;

function readLS(key: string, fallback: string) {
    try {
        return window.localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}
function writeLS(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

export function StmApp() {
    const searchParams = useSearchParams();
    const [theme, setTheme] = useState('kueche');
    const [mode, setMode] = useState<Mode>('auto');
    const [sysDark, setSysDark] = useState(false);
    const [direct, setDirect] = useState(false);
    const [tab, setTab] = useState<Tab>('neu');
    const [reviewId, setReviewId] = useState<string | null>(null);
    const [jobs, setJobs] = useState<Record<string, Job>>({});
    const [partials, setPartials] = useState<Record<string, PartialRecipe>>({});
    const [focusId, setFocusId] = useState<string | null>(null);
    const [connected, setConnected] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);
    const handledParams = useRef(false);

    /* preferences (per device) */
    useEffect(() => {
        setTheme(readLS('stm-theme', 'kueche'));
        setMode(readLS('stm-mode', 'auto') as Mode);
        setDirect(readLS('stm-direct', 'false') === 'true');
        try {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            setSysDark(mq.matches);
            const onChange = (e: MediaQueryListEvent) => setSysDark(e.matches);
            mq.addEventListener('change', onChange);
            return () => mq.removeEventListener('change', onChange);
        } catch {
            return undefined;
        }
    }, []);
    const dark = mode === 'dark' || (mode === 'auto' && sysDark);

    /* live updates */
    useEffect(() => {
        const es = new EventSource('/api/events');
        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);
        es.onmessage = (msg) => {
            let event: StmEvent;
            try {
                event = JSON.parse(msg.data);
            } catch {
                return;
            }
            if (event.type === 'snapshot') {
                const map: Record<string, Job> = {};
                for (const j of event.jobs) map[j.id] = j;
                setJobs(map);
            } else if (event.type === 'job') {
                setJobs((prev) => ({ ...prev, [event.job.id]: event.job }));
                if (event.job.status !== 'writing') {
                    setPartials((prev) => {
                        if (!(event.job.id in prev)) return prev;
                        const next = { ...prev };
                        delete next[event.job.id];
                        return next;
                    });
                }
            } else if (event.type === 'remove') {
                setJobs((prev) => {
                    const next = { ...prev };
                    delete next[event.id];
                    return next;
                });
            } else if (event.type === 'partial') {
                setPartials((prev) => ({ ...prev, [event.id]: event.recipe }));
            }
        };
        return () => es.close();
    }, []);

    const submit = useCallback(
        async (text: string, source = 'ui') => {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text, direct, source }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Konnte nicht starten');
            if (Array.isArray(body.jobs) && body.jobs[0]) setFocusId(body.jobs[0]);
            setTab('neu');
            setReviewId(null);
            return body.jobs as string[];
        },
        [direct],
    );

    /* share target / deep links (once) */
    useEffect(() => {
        if (handledParams.current) return;
        handledParams.current = true;
        const shared = [searchParams.get('shared_url'), searchParams.get('shared_text'), searchParams.get('shared_title'), searchParams.get('url')]
            .filter(Boolean)
            .join('\n');
        const draft = searchParams.get('draft');
        const wantTab = searchParams.get('tab') as Tab | null;
        if (shared) {
            submit(shared, 'share')
                .then(() => setNotice('Link übernommen – läuft im Hintergrund weiter, du kannst die App schließen.'))
                .catch((e) => setNotice(e.message));
        } else if (draft) {
            setReviewId(draft);
            setTab('entwuerfe');
        } else if (wantTab && ['neu', 'entwuerfe', 'verlauf', 'einstellungen'].includes(wantTab)) {
            setTab(wantTab);
        }
        if (shared || draft || wantTab) {
            try {
                window.history.replaceState(null, '', '/');
            } catch {
                /* ignore */
            }
        }
    }, [searchParams, submit]);

    const all = useMemo(() => Object.values(jobs), [jobs]);
    const queue = useMemo(() => all.filter((j) => j.status === 'queued').sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [all]);
    const active = useMemo(() => all.find((j) => ACTIVE_STATUSES.includes(j.status) && j.status !== 'saving'), [all]);
    const drafts = useMemo(() => all.filter((j) => j.status === 'draft').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all]);
    const history = useMemo(
        () => all.filter((j) => ['saved', 'failed', 'duplicate'].includes(j.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        [all],
    );

    /* the stage follows the running job; afterwards it keeps showing the last one */
    useEffect(() => {
        if (active && active.id !== focusId) setFocusId(active.id);
    }, [active, focusId]);
    const focused = (focusId && jobs[focusId]) || active || null;

    const openReview = (id: string) => {
        setReviewId(id);
        setTab('entwuerfe');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const go = (t: Tab) => {
        setTab(t);
        setReviewId(null);
    };

    const tabs: [Tab, string, number][] = [
        ['neu', 'Neu', queue.length + (active ? 1 : 0)],
        ['entwuerfe', 'Entwürfe', drafts.length],
        ['verlauf', 'Verlauf', 0],
        ['einstellungen', 'Einstellungen', 0],
    ];

    return (
        <div className='stm' data-theme={theme} data-dark={dark ? 'true' : 'false'}>
            <div className='stm-wrap'>
                <header className='stm-header stm-glass'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className='stm-logo'>
                            <IconPot />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className='stm-serif' style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em' }}>
                                Social → Mealie
                            </span>
                            <span className='stm-small stm-subtitle'>Rezepte aus Reels, TikToks und Posts – geschrieben von Claude</span>
                        </div>
                    </div>
                    <nav aria-label='Bereiche' className='stm-tabs'>
                        {tabs.map(([key, label, count]) => (
                            <button key={key} type='button' className='stm-tab' aria-current={tab === key ? 'page' : undefined} onClick={() => go(key)}>
                                <span>{label}</span>
                                {count > 0 && <span className='stm-count'>{count}</span>}
                            </button>
                        ))}
                    </nav>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className='stm-small stm-subtitle'>Thema</span>
                            <select
                                className='stm-input'
                                value={theme}
                                aria-label='Thema'
                                onChange={(e) => {
                                    setTheme(e.target.value);
                                    writeLS('stm-theme', e.target.value);
                                }}
                            >
                                {THEMES.map(([v, l]) => (
                                    <option key={v} value={v}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className='stm-segment stm-subtitle' role='group' aria-label='Hell oder dunkel'>
                            {(
                                [
                                    ['light', 'Hell'],
                                    ['dark', 'Dunkel'],
                                    ['auto', 'Auto'],
                                ] as [Mode, string][]
                            ).map(([m, l]) => (
                                <button
                                    key={m}
                                    type='button'
                                    aria-pressed={mode === m}
                                    onClick={() => {
                                        setMode(m);
                                        writeLS('stm-mode', m);
                                    }}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                        <button
                            type='button'
                            className='stm-icon-btn stm-mobile-only'
                            aria-label={`Darstellung wechseln (jetzt: ${mode === 'auto' ? 'Automatisch' : mode === 'light' ? 'Hell' : 'Dunkel'})`}
                            onClick={() => {
                                const order: Mode[] = ['auto', 'light', 'dark'];
                                const next = order[(order.indexOf(mode) + 1) % 3];
                                setMode(next);
                                writeLS('stm-mode', next);
                            }}
                        >
                            <IconMoon />
                        </button>
                    </div>
                </header>

                {!connected && (
                    <div className='stm-banner stm-banner-warn stm-glass' role='status'>
                        Verbindung zum Server unterbrochen – verbinde neu …
                    </div>
                )}
                {notice && (
                    <div className='stm-banner stm-glass' role='status' style={{ justifyContent: 'space-between' }}>
                        <span>{notice}</span>
                        <button type='button' className='stm-btn' onClick={() => setNotice(null)}>
                            OK
                        </button>
                    </div>
                )}

                {reviewId ? (
                    <ReviewView
                        key={reviewId}
                        id={reviewId}
                        job={jobs[reviewId]}
                        onClose={() => setReviewId(null)}
                        onRewrite={(id) => {
                            setFocusId(id);
                            setReviewId(null);
                            setTab('neu');
                        }}
                    />
                ) : (
                    <>
                        {tab === 'neu' && (
                            <NewTab
                                direct={direct}
                                setDirect={(v) => {
                                    setDirect(v);
                                    writeLS('stm-direct', String(v));
                                }}
                                submit={submit}
                                focused={focused}
                                partial={focused ? partials[focused.id] : undefined}
                                queue={queue}
                                onReview={openReview}
                            />
                        )}
                        {tab === 'entwuerfe' && <DraftsTab drafts={drafts} onReview={openReview} />}
                        {tab === 'verlauf' && <HistoryTab history={history} onReview={openReview} onFocus={(id) => { setFocusId(id); go('neu'); }} />}
                        {tab === 'einstellungen' && <SettingsTab />}
                    </>
                )}
            </div>

            <nav aria-label='Bereiche' className='stm-tabbar'>
                {tabs.map(([key, label, count]) => (
                    <button key={key} type='button' aria-current={tab === key && !reviewId ? 'page' : undefined} onClick={() => go(key)}>
                        <span>{key === 'einstellungen' ? 'Mehr' : label}</span>
                        <span style={{ fontSize: 11, minHeight: 14 }}>{count > 0 ? count : ''}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}
