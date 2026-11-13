'use client';

import type { CSSProperties } from 'react';
import type { Job } from '@/lib/stm/types';
import { useT } from './i18n';
import { daysOld, imageUrl, relTime, sourceLabel } from './ui';

export function DraftsTab({ drafts, onReview }: { drafts: Job[]; onReview: (id: string) => void }) {
    const t = useT();
    if (drafts.length === 0) {
        return (
            <section className='stm-empty stm-glass'>
                <p className='stm-h2' style={{ marginBottom: 8 }}>
                    {t('drafts.emptyTitle')}
                </p>
                <p style={{ margin: 0 }}>{t('drafts.emptyText')}</p>
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
                                {j.recipe?.name || j.title || t('drafts.untitled')}
                            </h3>
                            <p className='stm-small' style={{ margin: 0 }}>
                                {sourceLabel(t, j)} · {relTime(t, j.createdAt)}
                            </p>
                            {j.recipe && (
                                <p className='stm-small' style={{ margin: 0 }}>
                                    {t('drafts.counts', { i: j.recipe.ingredients.length, s: j.recipe.instructions.length })}
                                </p>
                            )}
                            {old > 10 && (
                                <span className='stm-badge' style={{ color: 'var(--warn)' }}>
                                    {t('drafts.old', { n: old })}
                                </span>
                            )}
                            {j.error && (
                                <span className='stm-small' style={{ color: 'var(--err)' }}>
                                    {j.error}
                                </span>
                            )}
                            <span style={{ flex: 1 }} />
                            <button type='button' className='stm-btn stm-btn-primary' onClick={() => onReview(j.id)}>
                                {t('common.review')}
                            </button>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
