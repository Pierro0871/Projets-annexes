import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { isNative } from './native';

export type Tab = 'articles' | 'idees' | 'numeros' | 'calendrier' | 'reglages';

export type Route =
  | { name: 'tab'; tab: Tab }
  | { name: 'article'; id: string }
  | { name: 'issue'; id: string };

interface Nav {
  route: Route;
  tab: Tab;
  push: (r: Route) => void;
  back: () => void;
  setTab: (t: Tab) => void;
  /** Un écran peut intercepter le bouton retour (ex. fermer une feuille ouverte). */
  setBackHandler: (fn: () => boolean) => () => void;
}

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'tab', tab: 'articles' }]);
  const handlers = useRef<Array<() => boolean>>([]);
  const route = stack[stack.length - 1];
  const tab = (stack.find((r) => r.name === 'tab') as { tab: Tab } | undefined)?.tab ?? 'articles';

  const push = useCallback((r: Route) => {
    setStack((s) => [...s, r]);
    window.scrollTo(0, 0);
  }, []);
  const setTab = useCallback((t: Tab) => {
    setStack([{ name: 'tab', tab: t }]);
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const stackRef = useRef(stack);
  stackRef.current = stack;

  const setBackHandler = useCallback((fn: () => boolean) => {
    handlers.current.push(fn);
    return () => {
      handlers.current = handlers.current.filter((h) => h !== fn);
    };
  }, []);

  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      for (let i = handlers.current.length - 1; i >= 0; i--) {
        if (handlers.current[i]()) return;
      }
      const s = stackRef.current;
      if (s.length > 1) setStack(s.slice(0, -1));
      else if (s[0].name === 'tab' && s[0].tab !== 'articles') setStack([{ name: 'tab', tab: 'articles' }]);
      else void CapApp.exitApp();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, []);

  const value = useMemo(() => ({ route, tab, push, back, setTab, setBackHandler }), [route, tab, push, back, setTab, setBackHandler]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error('NavProvider manquant');
  return v;
}

/** Ferme un élément (feuille, menu) avec le bouton retour Android quand il est ouvert. */
export function useBackClose(open: boolean, close: () => void) {
  const { setBackHandler } = useNav();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    return setBackHandler(() => {
      closeRef.current();
      return true;
    });
  }, [open, setBackHandler]);
}
