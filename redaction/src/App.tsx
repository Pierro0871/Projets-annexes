import { useEffect } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { NavProvider, useNav, type Tab } from './nav';
import { ConfirmHost, Icon, ToastHost } from './ui';
import { ArticlesScreen } from './screens/Articles';
import { ArticleScreen } from './screens/ArticleScreen';
import { IdeasScreen } from './screens/Ideas';
import { IssueScreen, IssuesScreen } from './screens/Issues';
import { CalendarScreen } from './screens/Calendar';
import { SettingsScreen } from './screens/Settings';
import { isNative, rescheduleReminders } from './native';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'articles', label: 'Articles', icon: 'doc' },
  { id: 'idees', label: 'Idées', icon: 'idea' },
  { id: 'numeros', label: 'Numéros', icon: 'book' },
  { id: 'calendrier', label: 'Agenda', icon: 'calendar' },
  { id: 'reglages', label: 'Réglages', icon: 'settings' },
];

function useTheme() {
  const theme = useLiveQuery(() => db.settings.get('theme'), []);
  const accent = useLiveQuery(() => db.settings.get('accent'), []);
  useEffect(() => {
    const t = (theme?.value as string) ?? 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    if (!isNative) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = t === 'dark' || (t === 'auto' && mq.matches);
      void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', (accent?.value as string) ?? '#e4572e');
  }, [accent]);
}

function Shell() {
  const { route, tab, setTab } = useNav();
  useTheme();

  let screen;
  if (route.name === 'article') screen = <ArticleScreen key={route.id} id={route.id} />;
  else if (route.name === 'issue') screen = <IssueScreen key={route.id} id={route.id} />;
  else if (tab === 'idees') screen = <IdeasScreen />;
  else if (tab === 'numeros') screen = <IssuesScreen />;
  else if (tab === 'calendrier') screen = <CalendarScreen />;
  else if (tab === 'reglages') screen = <SettingsScreen />;
  else screen = <ArticlesScreen />;

  const showTabs = route.name === 'tab';

  return (
    <div className={`app ${showTabs ? 'with-tabs' : ''}`}>
      {screen}
      {showTabs && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon"><Icon name={t.icon} size={22} /></span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    void navigator.storage?.persist?.();
    void rescheduleReminders();
  }, []);
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}
