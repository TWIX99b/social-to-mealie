'use client';

import type { CSSProperties } from 'react';
import type { Job } from '@/lib/stm/types';
import { daysOld, imageUrl, relTime, sourceLabel } from './ui';

export function DraftsTab({ drafts, onReview }: { drafts: Job[]; onReview: (id: string) => void }) {
    if (drafts.length === 0) {
        return (
            <section className='stm-empty stm-glass'>
                <p className='stm-h2' style={{ marginBottom: 8 }}>
                    Keine offenen Entwürfe
                </p>
                <p style={{ margin: 0 }}>Fertig geschriebene Rezepte warten hier, bis du sie prüfst und speicherst.</p>
            </section>
        );
    }
    return (
        <div className='stm-grid-cards'>
            {drafts.map((j) => {
                const old = daysOld(j.createdAt);
                const style = j.imageCount > 0 ? ({ '--img': `url("${imageUrl(j, 0)}")` } as CSSProperties) : undefined;
                return (
                    <article key={j.id} className='stm-draft stm-glass stm-in' style={style}>
                        <div className='stm-draft-img' aria-hidden='true' />
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                            <h3 className='stm-h2' style={{ fontSize: 18 }}>
                                {j.recipe?.name || j.title || 'Ohne Titel'}
                            </h3>
                            <p className='stm-small' style={{ margin: 0 }}>
                                {sourceLabel(j)} · {relTime(j.createdAt)}
                            </p>
                            {j.recipe && (
                                <p className='stm-small' style={{ margin: 0 }}>
                                    {j.recipe.ingredients.length} Zutaten · {j.recipe.instructions.length} Schritte
                                </p>
                            )}
                            {old > 10 && (
                                <span className='stm-badge' style={{ color: 'var(--warn)' }}>
                                    Schon {old} Tage alt
                                </span>
                            )}
                            {j.error && (
                                <span className='stm-small' style={{ color: 'var(--err)' }}>
                                    {j.error}
                                </span>
                            )}
                            <span style={{ flex: 1 }} />
                            <button type='button' className='stm-btn stm-btn-primary' onClick={() => onReview(j.id)}>
                                Prüfen
                            </button>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
