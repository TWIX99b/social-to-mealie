'use client';

import { useEffect, useMemo, useState } from 'react';
import { type MatchEntry, buildIndex, lookup } from '@/lib/stm/match';
import type { DraftRecipe, Ingredient, Job } from '@/lib/stm/types';
import { useT } from './i18n';
import { IconPlus, IconSpin, IconTrash, IconX, daysOld, imageUrl, sourceLabel } from './ui';

type Meta = { tags: string[]; categories: string[] };

const emptyRecipe = (): DraftRecipe => ({
    name: '',
    description: '',
    servings: null,
    totalTime: null,
    prepTime: null,
    ingredients: [],
    instructions: [],
    notes: [],
    tags: [],
    category: null,
});

function numText(n: number | null | undefined) {
    return n === null || n === undefined ? '' : String(n).replace('.', ',');
}
function parseNum(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

export function ReviewView({ id, job: liveJob, onClose, onRewrite }: { id: string; job?: Job; onClose: () => void; onRewrite: (id: string) => void }) {
    const [job, setJob] = useState<Job | null>(liveJob ?? null);
    const [recipe, setRecipe] = useState<DraftRecipe | null>(liveJob?.recipe ? structuredClone(liveJob.recipe) : null);
    const [qtyDraft, setQtyDraft] = useState<string[]>([]);
    const [imageIndex, setImageIndex] = useState(0);
    const [meta, setMeta] = useState<Meta>({ tags: [], categories: [] });
    const [matchData, setMatchData] = useState<{ foods: MatchEntry[]; units: MatchEntry[] } | null>(null);
    const foodIndex = useMemo(() => (matchData ? buildIndex(matchData.foods) : null), [matchData]);
    const unitIndex = useMemo(() => (matchData ? buildIndex(matchData.units) : null), [matchData]);
    const [hint, setHint] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const t = useT();

    useEffect(() => {
        fetch('/api/match')
            .then((r) => r.json())
            .then((m) => Array.isArray(m.foods) && m.foods.length > 0 && setMatchData({ foods: m.foods, units: m.units || [] }))
            .catch(() => undefined);
        fetch('/api/meta')
            .then((r) => r.json())
            .then((m) => setMeta({ tags: m.tags || [], categories: m.categories || [] }))
            .catch(() => undefined);
        if (!recipe) {
            fetch(`/api/jobs/${id}`)
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error('404'))))
                .then((b) => {
                    const j: Job = b.job ?? b;
                    setJob(j);
                    setRecipe(j.recipe ? structuredClone(j.recipe) : emptyRecipe());
                })
                .catch(() => setNotFound(true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /* follow server status (e.g. saved elsewhere) without overwriting local edits */
    useEffect(() => {
        if (liveJob) setJob(liveJob);
    }, [liveJob]);

    useEffect(() => {
        if (recipe) setQtyDraft(recipe.ingredients.map((i) => numText(i.quantity)));
        // only when the ingredient count changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipe?.ingredients.length]);

    if (notFound) {
        return (
            <section className='stm-empty stm-glass'>
                <p>{t('review.gone')}</p>
                <button type='button' className='stm-btn' onClick={onClose}>
                    {t('common.back')}
                </button>
            </section>
        );
    }
    if (!job || !recipe) {
        return (
            <section className='stm-empty stm-glass' aria-busy='true'>
                <IconSpin /> {t('common.loading')}
            </section>
        );
    }

    const set = <K extends keyof DraftRecipe>(k: K, v: DraftRecipe[K]) => setRecipe((r) => (r ? { ...r, [k]: v } : r));
    const setIng = (n: number, patch: Partial<Ingredient>) =>
        setRecipe((r) => {
            if (!r) return r;
            const ingredients = r.ingredients.map((i, k) => (k === n ? { ...i, ...patch } : i));
            return { ...r, ingredients };
        });
    const tagOptions = Array.from(new Set([...meta.tags, ...recipe.tags]));
    // live check against Mealie (falls back to the server's match when the list could not be loaded)
    const foodExists = (ing: Ingredient) => (foodIndex ? Boolean(lookup(foodIndex, ing.food)) : Boolean(ing.foodId));
    const unitExists = (ing: Ingredient) => !ing.unit || (unitIndex ? Boolean(lookup(unitIndex, ing.unit)) : Boolean(ing.unitId));
    const newFoods = recipe.ingredients.filter((i) => i.food.trim() && !foodExists(i)).length;
    const newUnits = recipe.ingredients.filter((i) => !unitExists(i)).length;

    const post = async (action: string, body: unknown) => {
        setBusy(action);
        setError(null);
        try {
            const res = await fetch(`/api/jobs/${id}/${action}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            });
            const b = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(b.error || `HTTP ${res.status}`);
            return b;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setBusy(null);
        }
    };

    const save = async () => {
        const b = await post('save', { recipe, imageIndex });
        if (b?.job) setJob(b.job);
    };
    const rewrite = async () => {
        const b = await post('rewrite', { recipe, hint });
        if (b) onRewrite(id);
    };
    const discard = async () => {
        setBusy('discard');
        await fetch(`/api/jobs/${id}`, { method: 'DELETE' }).catch(() => undefined);
        setBusy(null);
        onClose();
    };

    if (job.status === 'saved') {
        return (
            <section className='stm-card stm-glass' style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 className='stm-title'>{job.recipe?.name || recipe.name}</h2>
                <p style={{ margin: 0 }}>{t('review.savedText')}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {job.mealieUrl && (
                        <a className='stm-btn stm-btn-primary' href={job.mealieUrl} target='_blank' rel='noreferrer'>
                            {t('common.openMealie')}
                        </a>
                    )}
                    <button type='button' className='stm-btn' onClick={onClose}>
                        {t('common.back')}
                    </button>
                </div>
            </section>
        );
    }

    const old = daysOld(job.createdAt);

    return (
        <div className='stm-cols'>
            <aside className='stm-side'>
                <section className='stm-card stm-glass' aria-labelledby='stm-pic-h'>
                    <h3 id='stm-pic-h' className='stm-h4' style={{ marginBottom: 10 }}>
                        {t('review.image')}
                    </h3>
                    {job.imageCount > 0 ? (
                        <div className='stm-pics' role='radiogroup' aria-label={t('review.chooseImage')}>
                            {Array.from({ length: job.imageCount }, (_, n) => (
                                <button
                                    key={n}
                                    type='button'
                                    role='radio'
                                    aria-checked={imageIndex === n}
                                    aria-label={t('review.imageN', { n: n + 1 })}
                                    className='stm-pic'
                                    style={{ backgroundImage: `url("${imageUrl(job, n)}")` }}
                                    onClick={() => setImageIndex(n)}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className='stm-small' style={{ margin: 0 }}>
                            {t('review.noImages')}
                        </p>
                    )}
                </section>

                <section className='stm-card stm-glass' aria-labelledby='stm-src-h'>
                    <h3 id='stm-src-h' className='stm-h4' style={{ marginBottom: 8 }}>
                        {t('review.source')}
                    </h3>
                    <p className='stm-small' style={{ margin: '0 0 4px' }}>
                        {sourceLabel(t, job)}
                        {job.model ? ` · ${job.model}` : ''}
                    </p>
                    <a href={job.url} target='_blank' rel='noreferrer' style={{ color: 'var(--accent)', wordBreak: 'break-all', fontSize: 14 }}>
                        {job.url}
                    </a>
                    {old > 10 && (
                        <p className='stm-banner stm-banner-warn' style={{ margin: '10px 0 0', padding: 0 }}>
                            {t('review.old', { n: old })}
                        </p>
                    )}
                </section>

                <section className='stm-card stm-glass' aria-labelledby='stm-hint-h'>
                    <h3 id='stm-hint-h' className='stm-h4' style={{ marginBottom: 8 }}>
                        {t('review.rewriteTitle')}
                    </h3>
                    <textarea
                        className='stm-input'
                        rows={3}
                        value={hint}
                        onChange={(e) => setHint(e.target.value)}
                        placeholder={t('review.hintPh')}
                        aria-label={t('review.hint')}
                    />
                    <button type='button' className='stm-btn' style={{ width: '100%', marginTop: 10 }} disabled={!!busy} onClick={rewrite}>
                        {busy === 'rewrite' ? <IconSpin /> : null}
                        {t('review.rewrite')}
                    </button>
                    <p className='stm-small' style={{ margin: '8px 0 0' }}>
                        {t('review.rewriteNote')}
                    </p>
                </section>
            </aside>

            <main className='stm-main'>
                <section className='stm-card stm-glass' style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-label={t('review.formLabel')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <p className='stm-eyebrow'>{t('review.heading')}</p>
                        <button type='button' className='stm-icon-btn' aria-label={t('common.close')} onClick={onClose}>
                            <IconX />
                        </button>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className='stm-label'>{t('review.title')}</span>
                        <textarea
                            className='stm-input stm-serif'
                            rows={1}
                            style={{ fontSize: 22, fontWeight: 650, resize: 'none' }}
                            value={recipe.name}
                            onChange={(e) => set('name', e.target.value.replace(/\n/g, ' '))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault();
                            }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className='stm-label'>{t('review.description')}</span>
                        <textarea className='stm-input' rows={3} value={recipe.description} onChange={(e) => set('description', e.target.value)} />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span className='stm-label'>{t('review.servings')}</span>
                            <input className='stm-input' inputMode='numeric' value={numText(recipe.servings)} onChange={(e) => set('servings', parseNum(e.target.value))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span className='stm-label'>{t('review.totalTime')}</span>
                            <input className='stm-input' value={recipe.totalTime ?? ''} placeholder={t('review.timePh')} onChange={(e) => set('totalTime', e.target.value || null)} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span className='stm-label'>{t('review.prepTime')}</span>
                            <input className='stm-input' value={recipe.prepTime ?? ''} placeholder={t('review.prepPh')} onChange={(e) => set('prepTime', e.target.value || null)} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span className='stm-label'>{t('review.category')}</span>
                            <select className='stm-input' style={{ width: '100%', borderRadius: 12 }} value={recipe.category ?? ''} onChange={(e) => set('category', e.target.value || null)}>
                                <option value=''>{t('review.none')}</option>
                                {Array.from(new Set([...meta.categories, ...(recipe.category ? [recipe.category] : [])])).map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div>
                        <h3 className='stm-h4' style={{ marginBottom: 10 }}>
                            {t('h.ingredients')}
                        </h3>
                        <div className='stm-ing-grid stm-small' aria-hidden='true' style={{ marginBottom: 6 }}>
                            <span>{t('review.qty')}</span>
                            <span>{t('review.unit')}</span>
                            <span>{t('review.food')}</span>
                            <span className='stm-col-note'>{t('review.note')}</span>
                            <span className='stm-col-badge' />
                            <span />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {recipe.ingredients.map((ing, n) => (
                                <div key={n} className='stm-ing-grid'>
                                    <input
                                        className='stm-input'
                                        inputMode='decimal'
                                        aria-label={`${t('review.qty')} ${n + 1}`}
                                        value={qtyDraft[n] ?? numText(ing.quantity)}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setQtyDraft((q) => q.map((x, k) => (k === n ? v : x)));
                                            setIng(n, { quantity: parseNum(v) });
                                        }}
                                    />
                                    <input
                                        className={`stm-input${unitExists(ing) ? '' : ' stm-input-new'}`}
                                        list='stm-units'
                                        aria-label={`${t('review.unit')} ${n + 1}`}
                                        title={unitExists(ing) ? undefined : t('review.newUnit')}
                                        value={ing.unit ?? ''}
                                        onChange={(e) => setIng(n, { unit: e.target.value || null, unitId: null })}
                                    />
                                    <input
                                        className={`stm-input${!ing.food.trim() || foodExists(ing) ? '' : ' stm-input-new'}`}
                                        list='stm-foods'
                                        aria-label={`${t('review.food')} ${n + 1}`}
                                        title={foodExists(ing) ? undefined : t('review.newFood')}
                                        value={ing.food}
                                        onChange={(e) => setIng(n, { food: e.target.value, foodId: null })}
                                    />
                                    <input className='stm-input stm-col-note' aria-label={`${t('review.note')} ${n + 1}`} value={ing.note ?? ''} onChange={(e) => setIng(n, { note: e.target.value || null })} />
                                    <span
                                        className='stm-badge stm-col-badge'
                                        title={foodExists(ing) ? undefined : t('review.newFood')}
                                        style={{ alignSelf: 'center', color: foodExists(ing) ? 'var(--ok)' : 'var(--warn)' }}
                                    >
                                        {foodExists(ing) ? t('review.exists') : t('review.new')}
                                    </span>
                                    <button
                                        type='button'
                                        className='stm-icon-btn'
                                        aria-label={t('review.removeIngredient', { n: n + 1 })}
                                        onClick={() => set('ingredients', recipe.ingredients.filter((_, k) => k !== n))}
                                    >
                                        <IconTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type='button'
                            className='stm-btn'
                            style={{ marginTop: 10 }}
                            onClick={() => set('ingredients', [...recipe.ingredients, { quantity: null, unit: null, food: '', note: null }])}
                        >
                            <IconPlus /> {t('review.addIngredient')}
                        </button>
                        {(newFoods > 0 || newUnits > 0) && (
                            <p className='stm-small' style={{ margin: '10px 0 0' }}>
                                <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{t('review.newSummary', { f: newFoods, u: newUnits })}</span> {t('review.newSummaryHint')}
                            </p>
                        )}
                        {matchData && (
                            <>
                                <datalist id='stm-foods'>
                                    {matchData.foods.map((f) => (
                                        <option key={f.id} value={f.name} />
                                    ))}
                                </datalist>
                                <datalist id='stm-units'>
                                    {matchData.units.map((u) => (
                                        <option key={u.id} value={u.short || u.name} label={u.name} />
                                    ))}
                                </datalist>
                            </>
                        )}
                    </div>

                    <div>
                        <h3 className='stm-h4' style={{ marginBottom: 10 }}>
                            {t('h.instructions')}
                        </h3>
                        <ol className='stm-steps-out'>
                            {recipe.instructions.map((s, n) => (
                                <li key={n}>
                                    <span className='stm-num'>{n + 1}</span>
                                    <textarea
                                        className='stm-input'
                                        rows={2}
                                        aria-label={t('review.step', { n: n + 1 })}
                                        value={s}
                                        onChange={(e) => set('instructions', recipe.instructions.map((x, k) => (k === n ? e.target.value : x)))}
                                    />
                                    <button
                                        type='button'
                                        className='stm-icon-btn'
                                        aria-label={t('review.removeStep', { n: n + 1 })}
                                        onClick={() => set('instructions', recipe.instructions.filter((_, k) => k !== n))}
                                    >
                                        <IconTrash />
                                    </button>
                                </li>
                            ))}
                        </ol>
                        <button type='button' className='stm-btn' style={{ marginTop: 10 }} onClick={() => set('instructions', [...recipe.instructions, ''])}>
                            <IconPlus /> {t('review.addStep')}
                        </button>
                    </div>

                    {recipe.notes.length > 0 && (
                        <div>
                            <h3 className='stm-h4' style={{ marginBottom: 10 }}>
                                {t('h.notes')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {recipe.notes.map((note, n) => (
                                    <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                        <textarea
                                            className='stm-input'
                                            rows={2}
                                            aria-label={t('review.noteN', { n: n + 1 })}
                                            value={note.text}
                                            onChange={(e) => set('notes', recipe.notes.map((x, k) => (k === n ? { ...x, text: e.target.value } : x)))}
                                        />
                                        <button type='button' className='stm-icon-btn' aria-label={t('review.removeNote', { n: n + 1 })} onClick={() => set('notes', recipe.notes.filter((_, k) => k !== n))}>
                                            <IconTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className='stm-h4' style={{ marginBottom: 10 }}>
                            {t('h.tags')}
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {tagOptions.map((t) => {
                                const on = recipe.tags.includes(t);
                                return (
                                    <button
                                        key={t}
                                        type='button'
                                        className={on ? 'stm-tag' : 'stm-chip'}
                                        style={on ? undefined : { cursor: 'pointer', font: 'inherit', fontSize: 13, color: 'var(--text)', minHeight: 32 }}
                                        aria-pressed={on}
                                        onClick={() => set('tags', on ? recipe.tags.filter((x) => x !== t) : [...recipe.tags, t])}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {(error || job.error) && (
                        <p className='stm-banner stm-banner-err' role='alert' style={{ margin: 0, padding: 0 }}>
                            {error || job.error}
                        </p>
                    )}

                    <div className='stm-done-bar'>
                        <button type='button' className='stm-btn stm-btn-danger' disabled={!!busy} onClick={discard}>
                            {t('common.discard')}
                        </button>
                        <button type='button' className='stm-btn' disabled={!!busy} onClick={rewrite}>
                            {t('review.rewrite')}
                        </button>
                        <span style={{ flex: 1 }} />
                        <button type='button' className='stm-btn stm-btn-primary stm-btn-big' disabled={!!busy || !recipe.name.trim() || job.status === 'saving'} onClick={save}>
                            {busy === 'save' || job.status === 'saving' ? <IconSpin /> : null}
                            {t('review.save')}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
