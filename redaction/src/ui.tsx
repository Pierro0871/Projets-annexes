import { useEffect, useState, type ReactNode } from 'react';
import { useBackClose, useNav } from './nav';
import { statusInfo } from './constants';
import type { Status } from './db';

// ---------- Icônes (traits simples, intégrées pour fonctionner hors ligne) ----------

const PATHS: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  more: (<><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>),
  doc: (<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  idea: (<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>),
  book: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M8 7h7" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  trash: (<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  quote: <path d="M7 17c-1.7 0-3-1.3-3-3 0-3 2-6 5-7M17 17c-1.7 0-3-1.3-3-3 0-3 2-6 5-7M4 14h4v3H4zM14 14h4v3h-4z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  olist: <path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.6 14.2c.3-.6 1.5-.8 1.8 0 .3 1-2 2-2 3.8h2.4" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
  focus: <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />,
  unfocus: <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />,
  share: (<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: <path d="M9 4h6l-1 6 4 3H6l4-3zM12 13v8" />,
  history: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>),
  sources: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  alignLeft: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  alignCenter: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  alignJustify: <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  hr: <path d="M4 12h16" />,
  download: (<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 19h14" /></>),
  upload: (<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 19h14" /></>),
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>),
  external: (<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>),
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>),
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// ---------- En-tête ----------

export function Header({ title, subtitle, back, actions, large }: { title: ReactNode; subtitle?: ReactNode; back?: boolean; actions?: ReactNode; large?: boolean }) {
  const nav = useNav();
  return (
    <header className={`header ${large ? 'header-large' : ''}`}>
      {back && (
        <button className="icon-btn" onClick={nav.back} aria-label="Retour">
          <Icon name="back" />
        </button>
      )}
      <div className="header-titles">
        <h1>{title}</h1>
        {subtitle && <div className="header-sub">{subtitle}</div>}
      </div>
      <div className="header-actions">{actions}</div>
    </header>
  );
}

// ---------- Feuille du bas (modale) ----------

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-grip" />
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Menu({ open, onClose, items }: { open: boolean; onClose: () => void; items: Array<{ label: string; icon?: string; danger?: boolean; onClick: () => void } | null> }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="menu">
        {items.filter(Boolean).map((it) => (
          <button
            key={it!.label}
            className={`menu-item ${it!.danger ? 'danger' : ''}`}
            onClick={() => {
              onClose();
              it!.onClick();
            }}
          >
            {it!.icon && <Icon name={it!.icon} />}
            <span>{it!.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ---------- Confirmation ----------

let confirmImpl: ((msg: string, opts?: { ok?: string; danger?: boolean }) => Promise<boolean>) | null = null;
export function confirmDialog(msg: string, opts?: { ok?: string; danger?: boolean }) {
  return confirmImpl ? confirmImpl(msg, opts) : Promise.resolve(window.confirm(msg));
}

export function ConfirmHost() {
  const [state, setState] = useState<{ msg: string; ok: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);
  useEffect(() => {
    confirmImpl = (msg, opts) => new Promise((resolve) => setState({ msg, ok: opts?.ok ?? 'Confirmer', danger: !!opts?.danger, resolve }));
    return () => {
      confirmImpl = null;
    };
  }, []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <Sheet
      open={!!state}
      onClose={() => close(false)}
      footer={
        <div className="row-end">
          <button className="btn ghost" onClick={() => close(false)}>Annuler</button>
          <button className={`btn ${state?.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>{state?.ok}</button>
        </div>
      }
    >
      <p className="confirm-msg">{state?.msg}</p>
    </Sheet>
  );
}

// ---------- Toast ----------

let toastImpl: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  toastImpl?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    toastImpl = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      toastImpl = null;
    };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

// ---------- Petits éléments ----------

export function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  const s = statusInfo(status);
  return (
    <span className={`badge ${small ? 'badge-sm' : ''}`} style={{ '--c': s.color } as React.CSSProperties}>
      {s.label}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={30} /></div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action}
    </div>
  );
}

export function Fab({ onClick, label, icon = 'plus' }: { onClick: () => void; label: string; icon?: string }) {
  return (
    <button className="fab" onClick={onClick} aria-label={label}>
      <Icon name={icon} size={26} />
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Zone de texte qui s'agrandit avec son contenu. */
export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      ref={(el) => {
        if (el) {
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
        props.onInput?.(e);
      }}
    />
  );
}
