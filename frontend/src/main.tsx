import React, { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Languages,
  MapPin,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  api,
  type User,
  type Item,
  type Location,
  type Supplier,
  type Movement,
  type Order,
  type Audit,
} from './api';
import { BarcodeScan } from './barcode';
import { t, locale, useLanguage, setLanguage, errorText, type Language } from './i18n';
import './styles.css';

const money = (v: number | string) =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD' }).format(Number(v));
const date = (v: string) =>
  new Date(v).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const titles = {
  overview: 'Overview',
  inventory: 'Inventory',
  movements: 'Stock movements',
  orders: 'Purchase orders',
  locations: 'Locations',
  suppliers: 'Suppliers',
  audit: 'Audit trail',
  users: 'Team',
  settings: 'Account settings',
};
type Page = keyof typeof titles;
type Modal = 'item' | 'movement' | 'order' | 'location' | 'supplier' | 'user' | null;
function Brand() {
  return (
    <div className="brand-content">
      <img
        className="brand-logo"
        src="/branding/goshenignite-logo.png"
        alt="Goshen Ignite"
        width="164"
        height="130"
      />
      <small>{t('INVENTORY WORKSPACE')}</small>
    </div>
  );
}
function LanguageSelector() {
  const language = useLanguage();
  return (
    <label className="language-selector">
      <Languages size={17} aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select
        aria-label={t('Language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="fr" lang="fr">
          Français
        </option>
        <option value="es" lang="es">
          Español
        </option>
      </select>
    </label>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {React.Children.map(children, (child) => {
        if (
          React.isValidElement<Record<string, unknown>>(child) &&
          typeof child.type === 'string' &&
          ['input', 'select', 'textarea'].includes(child.type) &&
          !child.props['aria-label']
        ) {
          return React.cloneElement(child, { 'aria-labelledby': labelId });
        }
        return child;
      })}
    </label>
  );
}
function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Package size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-label={title}
    >
      <div className="dialog-title">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label={t('Close')}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      onLogin(await api('/auth/login', 'POST', Object.fromEntries(f)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <Brand />
        </div>
        <div>
          <span className="eyebrow">{t('INVENTORY & OPERATIONS')}</span>
          <h1>
            {' '}
            {t('Ready to care.')} <br /> {t('Equipped to help.')}{' '}
          </h1>
          <p>
            {' '}
            {t(
              'A considered space to manage the supplies that support your people and your purpose.',
            )}{' '}
          </p>
          <div className="login-art">
            <Boxes size={90} strokeWidth={1} />
            <span>
              {' '}
              {t('Every resource.')} <br /> {t('In the right place.')}{' '}
            </span>
          </div>
        </div>
        <small>{t('Goshenignite · Mental health & wellbeing')}</small>
      </section>
      <section className="login-form">
        <div className="login-language">
          <LanguageSelector />
        </div>
        <form onSubmit={submit}>
          <span className="eyebrow">{t('YOUR WORKSPACE')}</span>
          <h2>{t('Welcome back')}</h2>
          <p>{t('Sign in to your inventory workspace.')}</p>
          <Field label={t('Email address')}>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@goshenignite.com"
            />
          </Field>
          <Field label={t('Password')}>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {errorText(error)}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? t('Signing in…') : t('Sign in')}
            <ArrowRight size={18} />
          </button>
          <small className="muted">{t('Need access? Contact your workspace administrator.')}</small>
        </form>
      </section>
    </main>
  );
}
function App() {
  useLanguage();
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true);
  const [page, setPage] = useState<Page>('overview'),
    [modal, setModal] = useState<Modal>(null),
    [edit, setEdit] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]),
    [locations, setLocations] = useState<Location[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [movements, setMovements] = useState<Movement[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [events, setEvents] = useState<Audit[]>([]),
    [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('all'),
    [lowOnly, setLowOnly] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [formError, setFormError] = useState('');
  const [movementType, setMovementType] = useState('receive');
  const [lines, setLines] = useState([{ item_id: '', quantity: 1, unit_cost: 0 }]);
  const [scanItemId, setScanItemId] = useState(''),
    [scanNotice, setScanNotice] = useState('');
  const findByBarcode = (code: string) =>
    items.find((i) => i.sku.toLowerCase() === code.trim().toLowerCase()) || null;
  const manager = user?.role === 'admin' || user?.role === 'manager';
  const canMove = manager || user?.role === 'staff';
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setBoot(false));
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [i, l, s, m, o] = await Promise.all([
        api<Item[]>('/items'),
        api<Location[]>('/locations'),
        api<Supplier[]>('/suppliers'),
        api<Movement[]>('/movements'),
        api<Order[]>('/orders'),
      ]);
      setItems(i);
      setLocations(l);
      setSuppliers(s);
      setMovements(m);
      setOrders(o);
      if (manager) setEvents(await api('/audit'));
      if (user?.role === 'admin') setUsers(await api('/users'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) {
      setPage('overview');
      void refresh();
    }
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  function open(type: Modal, item: Item | null = null) {
    setEdit(item);
    setFormError('');
    setMovementType('receive');
    setLines([{ item_id: '', quantity: 1, unit_cost: 0 }]);
    setScanItemId('');
    setScanNotice('');
    setModal(type);
  }
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, method, body);
      setToast('Changes saved');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (modal === 'item')
        await api(`/items${edit ? `/${edit.id}` : ''}`, edit ? 'PUT' : 'POST', {
          ...f,
          unit_cost: Number(f.unit_cost),
          reorder_point: Number(f.reorder_point),
        });
      if (modal === 'movement')
        await api('/movements', 'POST', { ...f, quantity: Number(f.quantity) });
      if (modal === 'order') await api('/orders', 'POST', { ...f, lines });
      if (modal === 'location') await api('/locations', 'POST', f);
      if (modal === 'supplier') await api('/suppliers', 'POST', f);
      if (modal === 'user') await api('/users', 'POST', f);
      setModal(null);
      setToast('Changes saved');
      await refresh();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCSV() {
    const cell = (v: unknown) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replaceAll('"', '""')}"`;
    };
    const csv = [
      [
        t('SKU'),
        t('Item'),
        t('Category'),
        t('Quantity'),
        t('Unit'),
        t('Reorder point'),
        t('Unit cost'),
      ],
      ...filtered.map((i) => [
        i.sku,
        i.name,
        i.category,
        i.quantity,
        i.unit,
        i.reorder_point,
        i.unit_cost,
      ]),
    ]
      .map((r) => r.map(cell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goshenignite-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  const low = items.filter((i) => i.quantity <= i.reorder_point);
  const filtered = items.filter(
    (i) =>
      `${i.name} ${i.sku}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'all' || i.category === category) &&
      (!lowOnly || i.quantity <= i.reorder_point),
  );
  const value = items.reduce((s, i) => s + i.quantity * Number(i.unit_cost), 0);
  const pending = orders.filter((o) => ['draft', 'ordered'].includes(o.status));
  const nav: [Page, ReactNode][] = [
    ['overview', <LayoutDashboard size={19} />],
    ['inventory', <Package size={19} />],
    ['movements', <ArrowRightLeft size={19} />],
    ['orders', <ShoppingCart size={19} />],
    ['locations', <MapPin size={19} />],
    ['suppliers', <Truck size={19} />],
    ...(manager ? [['audit', <ShieldCheck size={19} />] as [Page, ReactNode]] : []),
    ...(user?.role === 'admin' ? [['users', <Users size={19} />] as [Page, ReactNode]] : []),
  ];
  const selectItems = (
    <>
      <option value="">{t('Select an item')}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name} · {i.sku}
        </option>
      ))}
    </>
  );
  const selectLocations = (
    <>
      <option value="">{t('Select a location')}</option>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </>
  );
  if (boot) return <div className="startup">{t('Loading your workspace…')}</div>;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('overview');
          }}
        >
          <Brand />
        </a>
        <div className="workspace">
          <span className="workspace-icon">G</span>
          <div>
            Goshenignite<small>{t('Mental health & wellbeing')}</small>
          </div>
          <span className="online" />
        </div>
        <span className="nav-label">{t('WORKSPACE')}</span>
        <nav>
          {nav.map(([p, icon]) => (
            <button
              key={p}
              className={page === p ? 'active' : ''}
              onClick={() => {
                setPage(p);
                setSearch('');
              }}
            >
              {icon}
              {t(titles[p])}
              {p === 'inventory' && low.length > 0 && (
                <span className="nav-count">{low.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-note">
            <HeartHandshake size={22} />
            <strong>{t('Supporting better care')}</strong>
            <p>{t('The right resources make room for what matters.')}</p>
          </div>
          <button onClick={() => setPage('settings')}>
            <Settings size={18} /> {t('Account settings')}{' '}
          </button>
          <button
            onClick={async () => {
              try {
                await api('/auth/logout', 'POST');
                setUser(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={18} /> {t('Sign out')}{' '}
          </button>
          <div className="profile">
            <div className="avatar">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              {user.name}
              <small>{t(user.role)}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            {' '}
            {t('Workspace')} <ChevronRight size={15} />
            <strong>{t(titles[page])}</strong>
          </div>
          <div>
            <LanguageSelector />
            <span className="today">
              {new Date().toLocaleDateString(locale(), {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              className="icon-button notification"
              aria-label={t('{count} low-stock alerts', { count: low.length })}
              onClick={() => {
                setPage('inventory');
                setLowOnly(true);
              }}
            >
              <Bell size={19} />
              {low.length > 0 && <i />}
            </button>
            <div className="avatar small">{user.name[0]}</div>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{t('GOSHENIGNITE / OPERATIONS')}</span>
              <h1>{t(titles[page])}</h1>
              <p>
                {
                  {
                    overview: t('A clear view of your resources. More room to focus on care.'),
                    inventory: t('Keep every essential accounted for, across every location.'),
                    movements: t('Follow each receipt, issue, adjustment, and transfer.'),
                    orders: t('From supply request to shelves, all in one place.'),
                    locations: t('Organize the spaces that support your work.'),
                    suppliers: t('Your partners in keeping care moving.'),
                    audit: t('A record of changes and the people behind them.'),
                    users: t('Manage workspace access for your team.'),
                    settings: t('Keep your account secure.'),
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === 'inventory' && (
                <button className="secondary" onClick={exportCSV}>
                  <Download size={16} /> {t('Export')}{' '}
                </button>
              )}
              {manager && ['overview', 'inventory'].includes(page) && (
                <button className="primary" onClick={() => open('item')}>
                  <Plus size={17} /> {t('Add item')}{' '}
                </button>
              )}
              {canMove && page === 'movements' && (
                <button className="primary" onClick={() => open('movement')}>
                  <Plus size={17} /> {t('Record movement')}{' '}
                </button>
              )}
              {manager && page === 'orders' && (
                <button className="primary" onClick={() => open('order')}>
                  <Plus size={17} /> {t('New purchase order')}{' '}
                </button>
              )}
              {manager && page === 'locations' && (
                <button className="primary" onClick={() => open('location')}>
                  <Plus size={17} /> {t('Add location')}{' '}
                </button>
              )}
              {manager && page === 'suppliers' && (
                <button className="primary" onClick={() => open('supplier')}>
                  <Plus size={17} /> {t('Add supplier')}{' '}
                </button>
              )}
              {user.role === 'admin' && page === 'users' && (
                <button className="primary" onClick={() => open('user')}>
                  <Plus size={17} /> {t('Add team member')}{' '}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {errorText(error)}
              <button onClick={refresh}>{t('Retry')}</button>
            </div>
          )}
          {loading && (
            <div className="loading" role="status">
              {' '}
              {t('Refreshing workspace…')}{' '}
            </div>
          )}
          {page === 'overview' && (
            <>
              <div className="welcome-banner">
                <div>
                  <span className="eyebrow">{t('A LITTLE ORGANIZATION. A LOT OF IMPACT.')}</span>
                  <h2>{t('Care starts with being prepared.')}</h2>
                  <p>{t("Your team's essentials, thoughtfully managed.")}</p>
                  <button onClick={() => setPage('inventory')}>
                    {' '}
                    {t('Explore inventory')} <ArrowRight size={16} />
                  </button>
                </div>
                <div className="banner-illustration" aria-hidden="true">
                  <div className="box-back">
                    <HeartHandshake size={38} />
                  </div>
                  <div className="box-front">
                    <Package size={62} strokeWidth={1.3} />
                  </div>
                  <span className="floating-check">
                    <Check size={20} />
                  </span>
                  <div className="leaf leaf-one" />
                  <div className="leaf leaf-two" />
                </div>
              </div>
              <div className="stats">
                <Stat
                  label={t('Inventory items')}
                  value={items.length.toLocaleString(locale())}
                  icon={<Package />}
                  foot={t('Unique items in your catalog')}
                />
                <Stat
                  label={t('Inventory value')}
                  value={money(value)}
                  icon={<Boxes />}
                  foot={t('At current catalog unit cost')}
                />
                <Stat
                  label={t('Low-stock items')}
                  value={String(low.length).padStart(2, '0')}
                  icon={<Activity />}
                  foot={t('At or below reorder point')}
                  warn
                />
                <Stat
                  label={t('Open purchase orders')}
                  value={String(pending.length).padStart(2, '0')}
                  icon={<ClipboardList />}
                  foot={t('Draft and ordered purchases')}
                />
              </div>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {' '}
                        {t('Needs your attention')} <span className="count">{low.length}</span>
                      </h2>
                      <p>{t('Replenish these essentials to stay prepared.')}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPage('inventory');
                        setLowOnly(true);
                      }}
                    >
                      {' '}
                      {t('View all')} <ArrowRight size={15} />
                    </button>
                  </div>
                  {low.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('ITEM')}</th>
                            <th>{t('ON HAND')}</th>
                            <th>{t('STATUS')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {low.slice(0, 5).map((i) => (
                            <tr key={i.id}>
                              <td>
                                <div className="item-cell">
                                  <span className="item-icon">
                                    <Package size={19} />
                                  </span>
                                  <div>
                                    <strong>{i.name}</strong>
                                    <small>
                                      {i.sku} · {i.category}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <strong>{i.quantity}</strong>
                                <small>
                                  {' '}
                                  {t('Min.')} {i.reorder_point} {i.unit}
                                </small>
                              </td>
                              <td>
                                <Badge tone={i.quantity === 0 ? 'danger' : 'warning'}>
                                  {i.quantity === 0 ? t('Out of stock') : t('Low stock')}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title={t('All stocked up')}
                      text={t('Low-stock items will appear here.')}
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{t('Quick actions')}</h2>
                      <p>{t('Keep your day moving.')}</p>
                    </div>
                  </div>
                  <div className="quick-actions">
                    {canMove && (
                      <button onClick={() => open('movement')}>
                        <span className="quick-icon">
                          <ArrowDownLeft size={20} />
                        </span>
                        <span>
                          <strong>{t('Record stock movement')}</strong>
                          <small>{t('Receive, issue, or transfer supplies')}</small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    )}
                    {manager && (
                      <button onClick={() => open('order')}>
                        <span className="quick-icon peach">
                          <ShoppingCart size={20} />
                        </span>
                        <span>
                          <strong>{t('Create purchase order')}</strong>
                          <small>{t('Plan your next supply restock')}</small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    )}
                    <button onClick={() => setPage('locations')}>
                      <span className="quick-icon lavender">
                        <MapPin size={20} />
                      </span>
                      <span>
                        <strong>{t('Browse locations')}</strong>
                        <small>{t('See where your resources live')}</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  </div>
                  <div className="location-summary">
                    <MapPin size={17} />
                    <span>
                      <strong>
                        {locations.length} {t('locations')}
                      </strong>{' '}
                      {t('connected to your workspace')}{' '}
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{t('Recent activity')}</h2>
                    <p>{t('The latest movements across your workspace.')}</p>
                  </div>
                  <button className="text-button" onClick={() => setPage('movements')}>
                    {' '}
                    {t('All movements')} <ArrowRight size={15} />
                  </button>
                </div>
                <MovementTable rows={movements.slice(0, 5)} />
              </section>
            </>
          )}
          {page === 'inventory' && (
            <section className="panel">
              <div className="filters">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label={t('Search items')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('Search by item name or SKU…')}
                  />
                </div>
                <select
                  aria-label={t('Category')}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">{t('All categories')}</option>
                  {[...new Set(items.map((i) => i.category))].sort().map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={lowOnly}
                    onChange={(e) => setLowOnly(e.target.checked)}
                  />{' '}
                  {t('Low stock only')}{' '}
                </label>
                <span className="muted">
                  {filtered.length} {t('items')}
                </span>
              </div>
              <div className="filters">
                <BarcodeScan
                  onScan={(code) => {
                    const match = findByBarcode(code);
                    setSearch(match ? match.sku : code);
                  }}
                />
              </div>
              {filtered.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('ITEM / SKU')}</th>
                        <th>{t('CATEGORY')}</th>
                        <th>{t('STOCK BY LOCATION')}</th>
                        <th>{t('ON HAND')}</th>
                        <th>{t('UNIT COST')}</th>
                        <th>{t('STATUS')}</th>
                        {manager && <th>{t('ACTION')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((i) => (
                        <tr key={i.id}>
                          <td>
                            <strong>{i.name}</strong>
                            <small>{i.sku}</small>
                          </td>
                          <td>{i.category}</td>
                          <td>
                            {i.stock.length ? (
                              i.stock.map((s) => (
                                <small key={s.location_id}>
                                  {s.location}: <strong>{s.quantity}</strong>
                                </small>
                              ))
                            ) : (
                              <span className="muted">{t('No stock recorded')}</span>
                            )}
                          </td>
                          <td>
                            <strong>{i.quantity}</strong> {i.unit}
                            <small>
                              {t('Reorder at')} {i.reorder_point}
                            </small>
                          </td>
                          <td>{money(i.unit_cost)}</td>
                          <td>
                            <Badge
                              tone={
                                i.quantity === 0
                                  ? 'danger'
                                  : i.quantity <= i.reorder_point
                                    ? 'warning'
                                    : 'success'
                              }
                            >
                              {i.quantity === 0
                                ? t('Out of stock')
                                : i.quantity <= i.reorder_point
                                  ? t('Low stock')
                                  : t('In stock')}
                            </Badge>
                          </td>
                          {manager && (
                            <td>
                              <button className="text-button" onClick={() => open('item', i)}>
                                {' '}
                                {t('Edit')}{' '}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={t('No items found')}
                  text={t('Add your first item or adjust your filters.')}
                />
              )}
            </section>
          )}
          {page === 'movements' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>{t('Stock ledger')}</h2>
                <span className="muted">{t('Latest 200 movements')}</span>
              </div>
              <MovementTable rows={movements} />
            </section>
          )}
          {page === 'orders' && (
            <section className="panel">
              {orders.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('ORDER')}</th>
                        <th>{t('SUPPLIER / DELIVERY')}</th>
                        <th>{t('ITEMS')}</th>
                        <th>{t('TOTAL')}</th>
                        <th>{t('STATUS')}</th>
                        {manager && <th>{t('ACTIONS')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>PO-{String(o.number).padStart(4, '0')}</strong>
                            <small>{date(o.created_at)}</small>
                          </td>
                          <td>
                            <strong>{o.supplier}</strong>
                            <small>{o.location}</small>
                          </td>
                          <td>
                            {o.lines.map((l) => (
                              <small key={l.item_id}>
                                {l.item} × {l.quantity}
                              </small>
                            ))}
                          </td>
                          <td>{money(o.total)}</td>
                          <td>
                            <Badge
                              tone={
                                o.status === 'received'
                                  ? 'success'
                                  : o.status === 'ordered'
                                    ? 'info'
                                    : ''
                              }
                            >
                              {t(o.status)}
                            </Badge>
                          </td>
                          {manager && (
                            <td>
                              <div className="row-actions">
                                {o.status === 'draft' && (
                                  <button
                                    disabled={busy}
                                    onClick={() => action(`/orders/${o.id}/submit`, 'POST')}
                                  >
                                    {' '}
                                    {t('Mark ordered')}{' '}
                                  </button>
                                )}
                                {o.status === 'ordered' && (
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          t('Receive all items in this order into stock?'),
                                        )
                                      )
                                        void action(`/orders/${o.id}/receive`, 'POST');
                                    }}
                                  >
                                    {' '}
                                    {t('Receive all')}{' '}
                                  </button>
                                )}
                                {['draft', 'ordered'].includes(o.status) && (
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      if (window.confirm(t('Cancel this purchase order?')))
                                        void action(`/orders/${o.id}/cancel`, 'POST');
                                    }}
                                  >
                                    {' '}
                                    {t('Cancel')}{' '}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={t('No purchase orders yet')}
                  text={t('Create an order to start planning your next restock.')}
                />
              )}
              <p className="panel-note">
                {' '}
                {t(
                  'Latest 200 orders. “Mark ordered” records an order placed with your supplier. Receiving adds all order quantities to stock.',
                )}{' '}
              </p>
            </section>
          )}
          {page === 'locations' && (
            <div className="cards">
              {locations.map((l) => (
                <section className="panel directory-card" key={l.id}>
                  <div className="directory-icon">
                    <MapPin />
                  </div>
                  <h2>{l.name}</h2>
                  <p>{l.description || t('Inventory storage location')}</p>
                  <div className="directory-meta">
                    <span>
                      {
                        items.filter((i) =>
                          i.stock.some((s) => s.location_id === l.id && s.quantity > 0),
                        ).length
                      }{' '}
                      {t('stocked items')}{' '}
                    </span>
                    <span>
                      {items.reduce(
                        (n, i) => n + (i.stock.find((s) => s.location_id === l.id)?.quantity || 0),
                        0,
                      )}{' '}
                      {t('units')}{' '}
                    </span>
                  </div>
                </section>
              ))}
              {!locations.length && (
                <Empty
                  title={t('Add your first location')}
                  text={t('Create the clinics, rooms, or storage spaces you use.')}
                />
              )}
            </div>
          )}
          {page === 'suppliers' && (
            <div className="cards">
              {suppliers.map((s) => (
                <section className="panel directory-card" key={s.id}>
                  <div className="directory-icon peach">
                    <Truck />
                  </div>
                  <h2>{s.name}</h2>
                  <p>
                    {s.email || t('No email provided')}
                    <br />
                    {s.phone || t('No phone provided')}
                  </p>
                </section>
              ))}
              {!suppliers.length && (
                <Empty
                  title={t('Build your supplier directory')}
                  text={t('Add the businesses that provide your supplies.')}
                />
              )}
            </div>
          )}
          {page === 'audit' && manager && (
            <section className="panel">
              <div className="panel-heading">
                <h2>{t('Workspace changes')}</h2>
                <span className="muted">{t('Latest 200 events')}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('WHEN')}</th>
                      <th>{t('ACTOR')}</th>
                      <th>{t('ACTION')}</th>
                      <th>{t('DETAILS')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td>{date(e.created_at)}</td>
                        <td>{e.actor || t('System')}</td>
                        <td>
                          <Badge>{e.action}</Badge>
                        </td>
                        <td>
                          <details>
                            <summary>{t('View details')}</summary>
                            <pre>
                              {JSON.stringify({ entity: e.entity_id, ...e.details }, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === 'users' && user.role === 'admin' && (
            <section className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('TEAM MEMBER')}</th>
                      <th>{t('ROLE')}</th>
                      <th>{t('STATUS')}</th>
                      <th>{t('ACCESS')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </td>
                        <td>
                          <select
                            aria-label={t('Role for {name}', { name: u.name })}
                            value={u.role}
                            disabled={u.id === user.id || busy}
                            onChange={(e) =>
                              action(`/users/${u.id}`, 'PATCH', {
                                role: e.target.value,
                                active: u.active,
                              })
                            }
                          >
                            {['viewer', 'staff', 'manager', 'admin'].map((r) => (
                              <option key={r} value={r}>
                                {t(r)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Badge tone={u.active ? 'success' : ''}>
                            {u.active ? t('Active') : t('Inactive')}
                          </Badge>
                        </td>
                        <td>
                          <button
                            disabled={u.id === user.id || busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  t(u.active ? 'Deactivate {name}?' : 'Activate {name}?', {
                                    name: u.name,
                                  }),
                                )
                              )
                                void action(`/users/${u.id}`, 'PATCH', {
                                  role: u.role,
                                  active: !u.active,
                                });
                            }}
                          >
                            {u.active ? t('Deactivate') : t('Activate')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === 'settings' && (
            <section className="panel settings-panel">
              <h2>{t('Change password')}</h2>
              <p>
                {' '}
                {t(
                  'Use at least 14 characters. Changing your password signs you out of all sessions.',
                )}{' '}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body = Object.fromEntries(new FormData(e.currentTarget));
                  setBusy(true);
                  try {
                    await api('/auth/password', 'POST', body);
                    setUser(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label={t('Current password')}>
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={200}
                  />
                </Field>
                <Field label={t('New password')}>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={14}
                    maxLength={200}
                  />
                </Field>
                <button className="primary" disabled={busy}>
                  {' '}
                  {t('Update password')}{' '}
                </button>
              </form>
            </section>
          )}
          <footer>
            <span>
              <HeartHandshake size={14} /> {t('Goshenignite · Supporting your purpose')}{' '}
            </span>
            <span>{t('Inventory & operations')}</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {t(toast)}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            {
              item: edit ? t('Edit inventory item') : t('Add inventory item'),
              movement: t('Record stock movement'),
              order: t('New purchase order'),
              location: t('Add location'),
              supplier: t('Add supplier'),
              user: t('Add team member'),
            }[modal]
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={submit}>
            {modal === 'item' && (
              <>
                <div className="form-grid">
                  <Field label={t('Item name')}>
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={edit?.name}
                    />
                  </Field>
                  <Field label={t('SKU')}>
                    <input
                      name="sku"
                      required
                      minLength={2}
                      maxLength={40}
                      pattern="[A-Za-z0-9_-]+"
                      defaultValue={edit?.sku}
                      placeholder={t('e.g. CLN-001')}
                    />
                  </Field>
                  <Field label={t('Category')}>
                    <input
                      name="category"
                      required
                      minLength={2}
                      maxLength={60}
                      list="categories"
                      defaultValue={edit?.category}
                    />
                  </Field>
                  <datalist id="categories">
                    {[
                      'Clinical supplies',
                      'Therapy materials',
                      'Office supplies',
                      'Equipment',
                      'Cleaning',
                      'Outreach',
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                  <Field label={t('Unit')}>
                    <input
                      name="unit"
                      required
                      maxLength={30}
                      defaultValue={edit?.unit || 'each'}
                    />
                  </Field>
                  <Field label={t('Reorder point (total across locations)')}>
                    <input
                      name="reorder_point"
                      type="number"
                      min={0}
                      max={1000000}
                      required
                      defaultValue={edit?.reorder_point ?? 10}
                    />
                  </Field>
                  <Field label={t('Unit cost (USD)')}>
                    <input
                      name="unit_cost"
                      type="number"
                      min={0}
                      max={1000000}
                      step="0.01"
                      required
                      defaultValue={edit?.unit_cost ?? 0}
                    />
                  </Field>
                </div>
                <p className="form-note">
                  {t('Record a stock movement to set or change quantities.')}
                </p>
              </>
            )}
            {modal === 'movement' && (
              <>
                <Field label={t('Scan barcode (optional)')}>
                  <BarcodeScan
                    onScan={(code) => {
                      const match = findByBarcode(code);
                      setScanItemId(match?.id || '');
                      setScanNotice(match ? '' : t('No item matches that barcode.'));
                    }}
                  />
                </Field>
                {scanNotice && (
                  <p className="error" role="alert">
                    {scanNotice}
                  </p>
                )}
                <Field label={t('Item')}>
                  <select
                    name="item_id"
                    required
                    value={scanItemId}
                    onChange={(e) => setScanItemId(e.target.value)}
                  >
                    {selectItems}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label={t('Movement type')}>
                    <select
                      name="type"
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value)}
                    >
                      <option value="receive">{t('Receive stock')}</option>
                      <option value="issue">{t('Issue stock')}</option>
                      <option value="transfer">{t('Transfer between locations')}</option>
                      {manager && <option value="adjust">{t('Adjust quantity (+/−)')}</option>}
                    </select>
                  </Field>
                  <Field label={movementType === 'transfer' ? t('Source location') : t('Location')}>
                    <select name="location_id" required>
                      {selectLocations}
                    </select>
                  </Field>
                  {movementType === 'transfer' && (
                    <Field label={t('Destination')}>
                      <select name="destination_id" required>
                        {selectLocations}
                      </select>
                    </Field>
                  )}
                  <Field
                    label={
                      movementType === 'adjust'
                        ? t('Quantity change (positive or negative)')
                        : t('Quantity')
                    }
                  >
                    <input
                      name="quantity"
                      type="number"
                      required
                      min={movementType === 'adjust' ? -1000000 : 1}
                      max={1000000}
                      defaultValue={1}
                    />
                  </Field>
                </div>
                <Field label={t('Reason / reference')}>
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={300}
                    placeholder={t('e.g. Weekly restock or supply room count correction')}
                  />
                </Field>
                <p className="form-note">
                  {' '}
                  {t('Use operational references only. Do not enter patient information.')}{' '}
                </p>
              </>
            )}
            {modal === 'order' && (
              <>
                <div className="form-grid">
                  <Field label={t('Supplier')}>
                    <select name="supplier_id" required>
                      <option value="">{t('Select supplier')}</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('Deliver to')}>
                    <select name="location_id" required>
                      {selectLocations}
                    </select>
                  </Field>
                </div>
                <div className="order-lines">
                  {lines.map((line, index) => (
                    <div className="order-line" key={index}>
                      <Field label={t('Item')}>
                        <select
                          required
                          value={line.item_id}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, n) =>
                                n === index
                                  ? {
                                      ...l,
                                      item_id: e.target.value,
                                      unit_cost: Number(
                                        items.find((i) => i.id === e.target.value)?.unit_cost || 0,
                                      ),
                                    }
                                  : l,
                              ),
                            )
                          }
                        >
                          {selectItems}
                        </select>
                      </Field>
                      <Field label={t('Quantity')}>
                        <input
                          aria-label={t('Line {number} quantity', { number: index + 1 })}
                          type="number"
                          min={1}
                          max={1000000}
                          required
                          value={line.quantity}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, n) =>
                                n === index ? { ...l, quantity: Number(e.target.value) } : l,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label={t('Unit cost ($)')}>
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          step="0.01"
                          required
                          value={line.unit_cost}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, n) =>
                                n === index ? { ...l, unit_cost: Number(e.target.value) } : l,
                              ),
                            )
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={lines.length === 1}
                        aria-label={t('Remove line {number}', { number: index + 1 })}
                        onClick={() => setLines(lines.filter((_, n) => n !== index))}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="text-button"
                  type="button"
                  disabled={lines.length >= 100}
                  onClick={() => setLines([...lines, { item_id: '', quantity: 1, unit_cost: 0 }])}
                >
                  <Plus size={16} /> {t('Add line')}{' '}
                </button>
                <p className="order-total">
                  {' '}
                  {t('Order total')}{' '}
                  <strong>{money(lines.reduce((n, l) => n + l.quantity * l.unit_cost, 0))}</strong>
                </p>
              </>
            )}
            {modal === 'location' && (
              <>
                <Field label={t('Location name')}>
                  <input name="name" required minLength={2} maxLength={100} />
                </Field>
                <Field label={t('Description')}>
                  <textarea name="description" maxLength={250} />
                </Field>
              </>
            )}
            {modal === 'supplier' && (
              <>
                <Field label={t('Supplier name')}>
                  <input name="name" required minLength={2} maxLength={100} />
                </Field>
                <Field label={t('Email')}>
                  <input name="email" type="email" maxLength={254} />
                </Field>
                <Field label={t('Phone')}>
                  <input name="phone" type="tel" maxLength={40} />
                </Field>
              </>
            )}
            {modal === 'user' && (
              <>
                <Field label={t('Full name')}>
                  <input name="name" required minLength={2} maxLength={100} />
                </Field>
                <Field label={t('Email')}>
                  <input name="email" type="email" required maxLength={254} />
                </Field>
                <Field label={t('Role')}>
                  <select name="role">
                    <option value="viewer">{t('Viewer — read only')}</option>
                    <option value="staff">{t('Staff — receive, issue, transfer')}</option>
                    <option value="manager">{t('Manager — inventory and purchasing')}</option>
                    <option value="admin">{t('Admin — full access and team management')}</option>
                  </select>
                </Field>
                <Field label={t('Initial password (14+ characters)')}>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={14}
                    maxLength={200}
                  />
                </Field>
                <p className="form-note">
                  {' '}
                  {t(
                    'Share this password securely. The team member can change it in account settings.',
                  )}{' '}
                </p>
              </>
            )}
            {formError && (
              <p className="error" role="alert">
                {errorText(formError)}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={() => setModal(null)}>
                {' '}
                {t('Cancel')}{' '}
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? t('Saving…')
                  : modal === 'order'
                    ? t('Create draft order')
                    : t('Save changes')}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  foot,
  warn = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  foot: string;
  warn?: boolean;
}) {
  return (
    <section className="stat">
      <div>
        <span>{label}</span>
        <span className={`stat-icon ${warn ? 'amber' : ''}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>
        {warn && <span className="amber-dot" />}
        {foot}
      </small>
    </section>
  );
}
function MovementTable({ rows }: { rows: Movement[] }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('ITEM')}</th>
            <th>{t('MOVEMENT')}</th>
            <th>{t('QUANTITY')}</th>
            <th>{t('LOCATION')}</th>
            <th>{t('BY / WHEN')}</th>
            <th>{t('REFERENCE')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.item}</strong>
                <small>{m.sku}</small>
              </td>
              <td>
                <span className={`movement-type ${m.quantity > 0 ? 'positive' : ''}`}>
                  {m.quantity > 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}{' '}
                  {t(m.type).replaceAll('_', ' ')}
                </span>
              </td>
              <td>
                <strong className={m.quantity > 0 ? 'positive' : ''}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </strong>
              </td>
              <td>{m.location}</td>
              <td>
                {m.actor}
                <small>{date(m.created_at)}</small>
              </td>
              <td className="reason">{m.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title={t('No movements yet')}
      text={t('Your stock activity will appear here as your team gets started.')}
    />
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
