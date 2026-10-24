import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Semana', icon: 'week' },
  { to: '/planejar', label: 'Planejar', icon: 'plan' },
  { to: '/despensa', label: 'Despensa', icon: 'jar' },
  { to: '/receitas', label: 'Receitas', icon: 'book' },
];

export function TabBar() {
  return (
    <nav className="tabs" aria-label="Seções">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <Icon name={t.icon} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Cabeçalho das abas principais: sobretítulo, título e atalho para Ajustes. */
export function TabHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <header className="top">
      <div className="titles">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      <Link className="iconbtn" to="/ajustes" aria-label="Ajustes">
        <Icon name="gear" />
      </Link>
    </header>
  );
}

/** Cabeçalho das telas internas, com botão de voltar. */
export function SubHeader({ title, right }: { title: string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="top">
      <button
        className="iconbtn"
        onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
        aria-label="Voltar"
      >
        <Icon name="back" />
      </button>
      <div className="t-sub">{title}</div>
      {right}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card empty-state">
      <span className="badge-ic">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
