'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { Job, JobStatus } from '@/lib/stm/types';
import { useLang, useT } from './i18n';
import { IconCheck, IconChevron, IconCircle, IconClock, IconSpin, IconX, imageUrl, qtyText, secs, sourceLabel, statusText, type PartialRecipe } from './ui';

type Props = {
    direct: boolean;
    setDirect: (v: boolean) => void;
    submit: (text: string) => Promise<string[]>;
    focused: Job | null;
    partial?: PartialRecipe;
    queue: Job[];
    onReview: (id: string) => void;
};

const ORDER: JobStatus[] = ['queued', 'downloading', 'transcribing', 'writing', 'saving'];

/** live seconds counter for the running stage */
function useTicker(active: boolean) {
    const [, setN] = useState(0);
    useEffect(() => {
        if (!active) return undefined;
        const t = setInterval(() => setN((n) => n + 1), 200);
        return () => clearInterval(t);
    }, [active]);
}

export function NewTab({ direct, setDirect, submit, focused, partial, queue, onReview }: Props) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    const go = async () => {
        if (!text.trim()) return;
        setBusy(true);
        setError(null);
        try {
            await submit(text);
            setText('');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='stm-cols'>
            <aside className='stm-side'>
                <section className='stm-card stm-glass' aria-labelledby='stm-new-h'>
                    <h2 id='stm-new-h' className='stm-h2'>
                        {t('new.title')}
                    </h2>
                    <p className='stm-small' style={{ margin: '6px 0 12px' }}>
                        {t('new.help')}
                    </p>
                    <textarea
                        className='stm-input'
                        rows={3}
                        placeholder='https://www.instagram.com/reel/…'
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go();
                        }}
                        aria-label={t('new.links')}
                    />
                    <div className='stm-switch-row' style={{ marginTop: 12 }}>
                        <span>
                            <strong>{t('new.direct')}</strong>
                            <br />
                            <span className='stm-small'>{direct ? t('new.directOn') : t('new.directOff')}</span>
                        </span>
                        <button type='button' role='switch' aria-checked={direct} aria-label={t('new.direct')} className='stm-switch' onClick={() => setDirect(!direct)}>
                            <span />
                        </button>
                    </div>
                    <button type='button' className='stm-btn stm-btn-primary stm-btn-big' style={{ width: '100%', marginTop: 8 }} disabled={busy || !text.trim()} onClick={go}>
                        {busy ? <IconSpin /> : null}
                        {t('new.submit')}
                    </button>
                    {error && (
                        <p className='stm-banner stm-banner-err' style={{ margin: '10px 0 0', padding: '8px 0' }}>
                            {error}
                        </p>
                    )}
                </section>

                {focused && <StepsCard job={focused} />}

                {queue.length > 0 && (
                    <section className='stm-card stm-glass' aria-labelledby='stm-queue-h'>
                        <h3 id='stm-queue-h' className='stm-h4' style={{ marginBottom: 10 }}>
                            {t('queue.title', { n: queue.length })}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {queue.map((j, i) => (
                                <div key={j.id} className='stm-queue-row'>
                                    <span className='stm-small' style={{ fontWeight: 600 }}>
                                        {i + 1}.
                                    </span>
                                    <span title={j.url}>{j.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                    <span className='stm-small'>{j.platform || ''}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </aside>

            <main className='stm-main'>
                {focused ? (
                    <Stage job={focused} partial={partial} onReview={onReview} />
                ) : (
                    <section className='stm-empty stm-glass'>
                        <p className='stm-h2' style={{ marginBottom: 8 }}>
                            {t('stage.label')}
                        </p>
                        <p style={{ margin: 0 }}>{t('stage.emptyText')}</p>
                    </section>
                )}
            </main>
        </div>
    );
}

function StepsCard({ job }: { job: Job }) {
    const [open, setOpen] = useState(false);
    const t = useT();
    const lang = useLang();
    const running = ['downloading', 'transcribing', 'writing', 'saving'].includes(job.status);
    useTicker(running);
    const stageMs = job.stageStartedAt ? Date.now() - new Date(job.stageStartedAt).getTime() : undefined;
    const failed = job.status === 'failed';
    const idx = ORDER.indexOf(job.status);
    const finished = ['draft', 'saved', 'duplicate'].includes(job.status);

    const rows: { key: JobStatus; label: string; time?: number }[] = [
        { key: 'downloading', label: t('steps.download'), time: job.timings.download },
        { key: 'transcribing', label: t('steps.transcribe'), time: job.timings.transcribe },
        { key: 'writing', label: t('steps.write'), time: job.timings.write },
    ];
    if (job.direct || job.status === 'saving' || job.status === 'saved') rows.push({ key: 'saving', label: t('steps.save'), time: job.timings.save });

    const r = (key: JobStatus) => rows.find((x) => x.key === key)?.time;
    const stateOf = (key: JobStatus): 'run' | 'done' | 'fail' | 'wait' => {
        const k = ORDER.indexOf(key);
        if (finished) return job.status === 'duplicate' && k > 1 ? 'wait' : 'done';
        if (job.status === key) return 'run';
        if (failed) {
            // the stage that has no timing yet is the one that failed
            const firstMissing = rows.find((r) => r.time === undefined)?.key;
            return key === firstMissing ? 'fail' : r(key) !== undefined ? 'done' : 'wait';
        }
        return idx > k ? 'done' : 'wait';
    };

    return (
        <section className='stm-card stm-glass' aria-labelledby='stm-steps-h'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <h3 id='stm-steps-h' className='stm-h4'>
                    {t('steps.title')}
                </h3>
                <span className='stm-small' style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sourceLabel(t, job)}
                </span>
            </div>
            <ol className='stm-steps' aria-live='polite'>
                {rows.map((row) => {
                    const state = stateOf(row.key);
                    const time = state === 'run' ? stageMs : row.time;
                    return (
                        <li key={row.key} className='stm-step' data-state={state}>
                            <span className='stm-step-icon' aria-hidden='true'>
                                {state === 'done' ? <IconCheck /> : state === 'run' ? <IconSpin /> : state === 'fail' ? <IconX /> : <IconCircle />}
                            </span>
                            <span style={{ flex: 1 }}>{row.label}</span>
                            <span className='stm-step-time'>{time !== undefined ? secs(lang, time) : ''}</span>
                        </li>
                    );
                })}
            </ol>
            {job.status === 'queued' && (
                <p className='stm-small' style={{ margin: '8px 0 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <IconClock /> {t('steps.waiting')}
                </p>
            )}
            {job.transcript && (
                <>
                    <button type='button' className='stm-disclosure' aria-expanded={open} onClick={() => setOpen(!open)} style={{ marginTop: 8 }}>
                        <span style={{ fontWeight: 600 }}>{t('steps.transcript')}</span>
                        <IconChevron open={open} />
                    </button>
                    {open && <p className='stm-transcript'>{job.transcript}</p>}
                </>
            )}
        </section>
    );
}

function Stage({ job, partial, onReview }: { job: Job; partial?: PartialRecipe; onReview: (id: string) => void }) {
    const [busy, setBusy] = useState<string | null>(null);
    const t = useT();
    const lang = useLang();
    const recipe: PartialRecipe | undefined = job.status === 'writing' ? partial : job.recipe;
    const writing = job.status === 'writing';
    const img = job.imageCount > 0 ? `url("${imageUrl(job, 0)}")` : undefined;

    const action = async (name: string, method = 'POST') => {
        setBusy(name);
        try {
            if (method === 'DELETE') await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
            else await fetch(`/api/jobs/${job.id}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        } finally {
            setBusy(null);
        }
    };

    const ingredients = (recipe?.ingredients || []).filter((i) => i && i.food);
    const steps = (recipe?.instructions || []).filter(Boolean);
    const meta = [
        recipe?.servings ? t('meta.servings', { n: recipe.servings }) : '',
        recipe?.totalTime ? t('meta.total', { t: recipe.totalTime }) : '',
        recipe?.prepTime ? t('meta.prep', { t: recipe.prepTime }) : '',
        recipe?.category || '',
    ].filter(Boolean);

    return (
        <section className='stm-stage stm-glass' style={img ? ({ '--img': img } as CSSProperties) : undefined} aria-label={t('stage.label')}>
            <div className='stm-hero'>
                {img && <div className='stm-hero-img' aria-hidden='true' />}
                <div className='stm-hero-bar'>
                    <span className='stm-pill-dark stm-hide-mobile'>{t('stage.label')}</span>
                    <span className='stm-status' role='status'>
                        {['downloading', 'transcribing', 'writing', 'saving'].includes(job.status) ? <IconSpin /> : job.status === 'failed' ? <IconX /> : job.status === 'queued' ? <IconClock /> : <IconCheck />}
                        {statusText(t, job.status)}
                    </span>
                </div>
            </div>
            <div className='stm-stage-body'>
                {job.status === 'failed' && (
                    <div className='stm-done-bar' role='alert'>
                        <span className='stm-banner-err' style={{ flex: 1, fontWeight: 600 }}>
                            {job.error || t('stage.genericError')}
                        </span>
                        <button type='button' className='stm-btn stm-btn-primary' disabled={!!busy} onClick={() => action('retry')}>
                            {t('common.retry')}
                        </button>
                    </div>
                )}
                {job.status === 'duplicate' && job.duplicateOf && (
                    <div className='stm-done-bar'>
                        <span style={{ flex: 1 }}>
                            {t('stage.duplicate', { name: job.duplicateOf.name })}
                        </span>
                        <a className='stm-btn' href={job.duplicateOf.url} target='_blank' rel='noreferrer'>
                            {t('common.openMealie')}
                        </a>
                        <button type='button' className='stm-btn stm-btn-primary' disabled={!!busy} onClick={() => action('force')}>
                            {t('common.forceNew')}
                        </button>
                    </div>
                )}

                {recipe?.name ? (
                    <h2 className='stm-title stm-in'>{recipe.name}</h2>
                ) : (
                    <div className='stm-skel stm-pulse' style={{ height: 38, width: '60%' }} aria-hidden='true' />
                )}
                {recipe?.description ? (
                    <p className='stm-desc'>{recipe.description}</p>
                ) : (
                    !recipe?.name && (
                        <>
                            <div className='stm-skel stm-pulse' style={{ height: 14, width: '90%' }} aria-hidden='true' />
                            <div className='stm-skel stm-pulse' style={{ height: 14, width: '70%' }} aria-hidden='true' />
                        </>
                    )
                )}
                {!recipe?.name && job.title && <p className='stm-small' style={{ margin: 0 }}>{t('stage.post', { title: job.title })}</p>}

                {meta.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {meta.map((m) => (
                            <span key={m} className='stm-chip'>
                                {m}
                            </span>
                        ))}
                    </div>
                )}

                {(ingredients.length > 0 || steps.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
                        {ingredients.length > 0 && (
                            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                                <h3 className='stm-h4' style={{ marginBottom: 6 }}>
                                    {t('h.ingredients')}
                                </h3>
                                <ul className='stm-ing'>
                                    {ingredients.map((i, n) => (
                                        <li key={n} className='stm-in'>
                                            <span className='stm-qty'>{qtyText(lang, i)}</span>
                                            <span>
                                                {i.food}
                                                {i.note ? <span className='stm-muted'>, {i.note}</span> : null}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {steps.length > 0 && (
                            <div style={{ flex: '2 1 320px', minWidth: 0 }}>
                                <h3 className='stm-h4' style={{ marginBottom: 10 }}>
                                    {t('h.instructions')}
                                </h3>
                                <ol className='stm-steps-out'>
                                    {steps.map((s, n) => (
                                        <li key={n} className='stm-in'>
                                            <span className='stm-num'>{n + 1}</span>
                                            <span>{s}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                )}

                {writing && (
                    <p className='stm-small stm-pulse' style={{ margin: 0 }}>
                        {t('stage.writing')}
                    </p>
                )}

                {(recipe?.tags?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {recipe!.tags!.filter(Boolean).map((t) => (
                            <span key={t} className='stm-tag'>
                                {t}
                            </span>
                        ))}
                    </div>
                )}

                {job.status === 'draft' && (
                    <div className='stm-done-bar'>
                        <span style={{ flex: 1, fontWeight: 600 }}>{t('stage.ready')}</span>
                        <button type='button' className='stm-btn stm-btn-danger' disabled={!!busy} onClick={() => action('discard', 'DELETE')}>
                            {t('common.discard')}
                        </button>
                        <button type='button' className='stm-btn stm-btn-primary' onClick={() => onReview(job.id)}>
                            {t('common.review')}
                        </button>
                    </div>
                )}
                {job.status === 'saved' && (
                    <div className='stm-done-bar'>
                        <span style={{ flex: 1, fontWeight: 600 }}>{t('stage.saved')}</span>
                        {job.mealieUrl && (
                            <a className='stm-btn stm-btn-primary' href={job.mealieUrl} target='_blank' rel='noreferrer'>
                                {t('common.openMealie')}
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
