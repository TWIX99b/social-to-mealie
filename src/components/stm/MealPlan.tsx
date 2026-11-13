'use client';

import { useState } from 'react';
import type { MsgKey } from '@/lib/stm/i18n';
import type { Job } from '@/lib/stm/types';
import { useLang, useT } from './i18n';
import { IconCheck, IconSpin } from './ui';

const ENTRY_TYPES = ['breakfast', 'lunch', 'dinner', 'side'] as const;

function isoDay(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** "In den Wochenplan": pick a day (today + 13) and a meal, then add the saved recipe to Mealie's meal plan. */
export function MealPlanButton({ job }: { job: Job }) {
    const t = useT();
    const lang = useLang();
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(() => isoDay(new Date()));
    const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>('dinner');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const loc = lang === 'de' ? 'de-DE' : 'en-GB';
    const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const label =
            i === 0 ? t('plan.today') : i === 1 ? t('plan.tomorrow') : d.toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: '2-digit' });
        return [isoDay(d), label] as const;
    });
    const dayLabel = (iso: string) => days.find(([v]) => v === iso)?.[1] ?? iso;

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/jobs/${job.id}/mealplan`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ date, entryType }),
            });
            const b = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(b.error || `HTTP ${res.status}`);
            setDone(`${dayLabel(date)} · ${t(`plan.${entryType}` as MsgKey)}`);
            setOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <>
                {done && (
                    <span className='stm-small' role='status' style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--ok)', fontWeight: 600 }}>
                        <IconCheck size={14} /> {t('plan.added', { when: done })}
                    </span>
                )}
                <button type='button' className='stm-btn' onClick={() => setOpen(true)}>
                    {done ? t('plan.again') : t('plan.button')}
                </button>
            </>
        );
    }

    return (
        <div className='stm-plan' role='group' aria-label={t('plan.button')}>
            <select className='stm-input' aria-label={t('plan.day')} value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map(([v, l]) => (
                    <option key={v} value={v}>
                        {l}
                    </option>
                ))}
            </select>
            <select className='stm-input' aria-label={t('plan.meal')} value={entryType} onChange={(e) => setEntryType(e.target.value as (typeof ENTRY_TYPES)[number])}>
                {ENTRY_TYPES.map((v) => (
                    <option key={v} value={v}>
                        {t(`plan.${v}` as MsgKey)}
                    </option>
                ))}
            </select>
            <button type='button' className='stm-btn stm-btn-primary' disabled={busy} onClick={submit}>
                {busy ? <IconSpin /> : null}
                {t('plan.add')}
            </button>
            <button type='button' className='stm-btn' onClick={() => setOpen(false)}>
                {t('plan.cancel')}
            </button>
            {error && (
                <span className='stm-small' role='alert' style={{ color: 'var(--err)', flexBasis: '100%' }}>
                    {error}
                </span>
            )}
        </div>
    );
}
