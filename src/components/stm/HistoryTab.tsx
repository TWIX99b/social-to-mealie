'use client';

import { useState } from 'react';
import type { Job } from '@/lib/stm/types';
import { IconCheck, IconX, STATUS_TEXT, dateTime, sourceLabel } from './ui';

export function HistoryTab({ history, onFocus }: { history: Job[]; onReview: (id: string) => void; onFocus: (id: string) => void }) {
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
                    Noch nichts im Verlauf
                </p>
                <p style={{ margin: 0 }}>Gespeicherte, doppelte und fehlgeschlagene Links tauchen hier auf und verschwinden nach 10 Tagen.</p>
            </section>
        );
    }

    return (
        <section className='stm-card stm-glass' aria-labelledby='stm-hist-h'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <h2 id='stm-hist-h' className='stm-h2'>
                    Verlauf
                </h2>
                <span className='stm-small'>wird nach 10 Tagen gelöscht</span>
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
                                <span style={{ color, fontWeight: 600 }}>{STATUS_TEXT[j.status]}</span> · {sourceLabel(j)} · {dateTime(j.updatedAt)}
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
                                    Öffnen
                                </a>
                            )}
                            {j.status === 'duplicate' && j.duplicateOf && (
                                <>
                                    <a className='stm-btn' href={j.duplicateOf.url} target='_blank' rel='noreferrer'>
                                        Öffnen
                                    </a>
                                    <button type='button' className='stm-btn' disabled={busy === j.id} onClick={() => act(j.id, 'force')}>
                                        Trotzdem neu erstellen
                                    </button>
                                </>
                            )}
                            {j.status === 'failed' && (
                                <>
                                    <button type='button' className='stm-btn stm-btn-primary' disabled={busy === j.id} onClick={() => act(j.id, 'retry')}>
                                        Nochmal versuchen
                                    </button>
                                    <button type='button' className='stm-btn stm-btn-danger' disabled={busy === j.id} onClick={() => remove(j.id)}>
                                        Entfernen
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
