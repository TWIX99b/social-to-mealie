'use client';

import { useState } from 'react';
import type { Job } from '@/lib/stm/types';
import { useLang, useT } from './i18n';
import { IconCheck, IconX, dateTime, sourceLabel, statusText } from './ui';

export function HistoryTab({ history, onFocus, retentionDays = 10 }: { history: Job[]; onReview: (id: string) => void; onFocus: (id: string) => void; retentionDays?: number }) {
    const t = useT();
    const lang = useLang();
    const [busy, setBusy] = useState<string | null>(null);
    const act = async (id: string, action: 'retry' | 'force') => {
        setBusy(id);
        try {
            await fetch(`/api/jobs/${id}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
            onFocus(id);
        } finally {
            setBusy(null);
        }
    };
    const remove = async (id: string) => {
        setBusy(id);
        await fetch(`/api/jobs/${id}`, { method: 'DELETE' }).catch(() => undefined);
        setBusy(null);
    };

    if (history.length === 0) {
        return (
            <section className='stm-empty stm-glass'>
                <p className='stm-h2' style={{ marginBottom: 8 }}>
                    {t('history.emptyTitle')}
                </p>
                <p style={{ margin: 0 }}>{t('history.emptyText', { n: retentionDays })}</p>
            </section>
        );
    }

    return (
        <section className='stm-card stm-glass' aria-labelledby='stm-hist-h'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <h2 id='stm-hist-h' className='stm-h2'>
                    {t('tab.history')}
                </h2>
                <span className='stm-small'>{t('history.retention', { n: retentionDays })}</span>
            </div>
            {history.map((j) => {
                const color = j.status === 'saved' ? 'var(--ok)' : j.status === 'failed' ? 'var(--err)' : 'var(--warn)';
                return (
                    <div key={j.id} className='stm-hist-row'>
                        <span className='stm-step-icon' style={{ background: color, color: '#fff' }} aria-hidden='true'>
                            {j.status === 'saved' ? <IconCheck /> : <IconX />}
                        </span>
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {j.recipe?.name || j.duplicateOf?.name || j.title || j.url.replace(/^https?:\/\/(www\.)?/, '')}
                            </div>
                            <div className='stm-small'>
                                <span style={{ color, fontWeight: 600 }}>{statusText(t, j.status)}</span> · {sourceLabel(t, j)} · {dateTime(lang, j.updatedAt)}
                            </div>
                            {j.status === 'failed' && j.error && (
                                <div className='stm-small' style={{ marginTop: 2 }}>
                                    {j.error}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {j.status === 'saved' && j.mealieUrl && (
                                <a className='stm-btn' href={j.mealieUrl} target='_blank' rel='noreferrer'>
                                    {t('common.open')}
                                </a>
                            )}
                            {j.status === 'duplicate' && j.duplicateOf && (
                                <>
                                    <a className='stm-btn' href={j.duplicateOf.url} target='_blank' rel='noreferrer'>
                                        {t('common.open')}
                                    </a>
                                    <button type='button' className='stm-btn' disabled={busy === j.id} onClick={() => act(j.id, 'force')}>
                                        {t('common.forceNew')}
                                    </button>
                                </>
                            )}
                            {j.status === 'failed' && (
                                <>
                                    <button type='button' className='stm-btn stm-btn-primary' disabled={busy === j.id} onClick={() => act(j.id, 'retry')}>
                                        {t('common.retry')}
                                    </button>
                                    <button type='button' className='stm-btn stm-btn-danger' disabled={busy === j.id} onClick={() => remove(j.id)}>
                                        {t('common.remove')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
