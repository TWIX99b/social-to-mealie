'use client';

import { createContext, useCallback, useContext } from 'react';
import { type Lang, type MsgKey, translate } from '@/lib/stm/i18n';

export const LangContext = createContext<Lang>('de');

export function useLang(): Lang {
    return useContext(LangContext);
}

export type T = (key: MsgKey, vars?: Record<string, string | number>) => string;

export function useT(): T {
    const lang = useLang();
    return useCallback<T>((key, vars) => translate(lang, key, vars), [lang]);
}
