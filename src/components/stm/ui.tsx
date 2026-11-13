'use client';

import type { DraftRecipe, Ingredient, Job, JobStatus } from '@/lib/stm/types';

/* ---------- icons (stroke SVG, decorative) ---------- */

export function IconPot({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M4 11h16a8 8 0 0 1-16 0z' />
            <path d='M8 7c0-1.5 1-2 1-3.5' />
            <path d='M12 7c0-1.5 1-2 1-3.5' />
            <path d='M16 7c0-1.5 1-2 1-3.5' />
        </svg>
    );
}
export function IconCheck({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M5 12.5l4.5 4.5L19 7.5' />
        </svg>
    );
}
export function IconSpin({ size = 16 }: { size?: number }) {
    return (
        <svg className='stm-spin' width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' aria-hidden='true'>
            <path d='M12 3a9 9 0 1 0 9 9' />
        </svg>
    );
}
export function IconCircle({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
            <circle cx='12' cy='12' r='8' />
        </svg>
    );
}
export function IconX({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' aria-hidden='true'>
            <path d='M6 6l12 12M18 6L6 18' />
        </svg>
    );
}
export function IconChevron({ open }: { open: boolean }) {
    return (
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true' style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <path d='M6 9l6 6 6-6' />
        </svg>
    );
}
export function IconMoon() {
    return (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
            <path d='M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z' />
        </svg>
    );
}
export function IconClock() {
    return (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
            <circle cx='12' cy='12' r='9' />
            <path d='M12 7v5l3 2' />
        </svg>
    );
}
export function IconPlus() {
    return (
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' aria-hidden='true'>
            <path d='M12 5v14M5 12h14' />
        </svg>
    );
}
export function IconTrash() {
    return (
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
            <path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' />
        </svg>
    );
}

/* ---------- helpers ---------- */

export function secs(ms?: number) {
    if (ms === undefined || ms === null) return '';
    return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    const h = Math.round(min / 60);
    if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24);
    return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

export function dateTime(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

export function daysOld(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function sourceLabel(job: Job) {
    const src = job.source === 'shortcut' ? 'iPhone-Kurzbefehl' : job.source === 'share' ? 'Teilen' : 'App';
    return `${job.platform || 'Link'} · ${src}`;
}

export function qtyText(i: Ingredient) {
    const q = i.quantity === null || i.quantity === undefined || i.quantity === 0 ? '' : String(Math.round(i.quantity * 1000) / 1000).replace('.', ',');
    return [q, i.unit || ''].filter(Boolean).join(' ');
}

export function imageUrl(job: Job, n: number) {
    return `/api/jobs/${job.id}/image/${n}?v=${encodeURIComponent(job.updatedAt.slice(0, 16))}`;
}

export const STATUS_TEXT: Record<JobStatus, string> = {
    queued: 'Wartet',
    downloading: 'Lädt Video …',
    transcribing: 'Transkribiert …',
    writing: 'Claude schreibt …',
    draft: 'Bereit zum Prüfen',
    saving: 'Speichert …',
    saved: 'In Mealie gespeichert',
    failed: 'Fehler',
    duplicate: 'Schon vorhanden',
    discarded: 'Verworfen',
};

export type PartialRecipe = Partial<DraftRecipe>;
