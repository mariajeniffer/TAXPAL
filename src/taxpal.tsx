import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';

type User = {
  id?: number;
  name: string;
  email: string;
  profession?: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
  pan?: string;
  password?: string;
};

type IncomeItem = {
  id: number;
  client: string;
  project: string;
  amount: number;
  method: string;
  date: string;
  notes: string;
};

type ExpenseItem = {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
};

type ClientItem = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  revenue: number;
  projects: number;
  status: 'Active' | 'Inactive';
};

type PaymentItem = {
  id: number;
  client: string;
  project: string;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Paid' | 'Overdue';
};

type GoalItem = {
  id: number;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  icon: string;
};

type FormState = Record<string, string | number | boolean>;
type ModalKey = 'income' | 'expense' | 'goal' | null;
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RecentTransaction =
  | (IncomeItem & { type: 'income' })
  | { type: 'expense'; client: string; category: string; amount: number; date: string };
type AppData = {
  income: IncomeItem[];
  expenses: ExpenseItem[];
  clients: ClientItem[];
  goals: GoalItem[];
  payments: PaymentItem[];
  monthlyIncome: number[];
  monthlyExpenses: number[];
  months: string[];
};

type AuthResponse = { user: User };
type AuthError = { error?: string };
type DataResponse = { data: AppData | null };

async function authRequest<T extends object>(url: string, options: RequestInit = {}): Promise<T> {
  const existingHeaders =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : options.headers || {};
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...existingHeaders,
    },
  });

  let data: unknown = null;

  try {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();

      if (text.trim()) {
        data = { error: text.trim() } as AuthError;
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  if (data === null) {
    throw new Error('Empty response from server.');
  }

  return data as T;
}

async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  profession: string;
  linkedin: string;
  portfolio: string;
  pan: string;
  password: string;
}): Promise<User> {
  const data = await authRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.user;
}

async function loginUser(email: string, password: string): Promise<User> {
  const data = await authRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

async function fetchUser(id: number): Promise<User | null> {
  try {
    const data = await authRequest<AuthResponse>(`/api/auth/me/${id}`);
    return data.user;
  } catch {
    return null;
  }
}

async function fetchAppData(userId: number): Promise<AppData> {
  const data = await authRequest<DataResponse>(`/api/data/${userId}`);
  return data.data || {
    income: [],
    expenses: [],
    clients: [],
    goals: [],
    payments: [],
    monthlyIncome: [],
    monthlyExpenses: [],
    months: [],
  };
}

async function saveAppData(userId: number, data: AppData): Promise<void> {
  await authRequest<{ ok: boolean }>(`/api/data/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function saveUserProfile(userId: number, profile: Record<string, string>): Promise<User> {
  const data = await authRequest<AuthResponse>(`/api/profile/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      profession: profile.profession,
      linkedin: profile.linkedin,
      portfolio: profile.portfolio,
      pan: profile.pan,
    }),
  });
  return data.user;
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtK = (n: number) =>
  n >= 100000
    ? '₹' + (n / 100000).toFixed(1) + 'L'
    : '₹' + (n / 1000).toFixed(0) + 'K';

// ─── MINI CHART COMPONENT (canvas-free sparkline) ────────────────────────────
function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data),
    min = Math.min(...data);
  const range = max - min || 1;
  const w = 120,
    h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} L${pts
    .slice(1)
    .join(' L')} L${w},${h} L0,${h} Z`;
  const linePath = `M${pts[0]} L${pts.slice(1).join(' L')}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: h, display: 'block' }}
    >
      <path d={areaPath} fill={color} fillOpacity={0.15} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({
  data1,
  data2,
  labels,
  color1,
  color2,
  label1,
  label2,
}: {
  data1: number[];
  data2: number[];
  labels: string[];
  color1: string;
  color2: string;
  label1: string;
  label2: string;
}) {
  const max = Math.max(...data1, ...data2);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          fontSize: 12,
          color: '#64748B',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color1,
              display: 'inline-block',
            }}
          />
          {label1}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color2,
              display: 'inline-block',
            }}
          />
          {label2}
        </span>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}
      >
        {labels.map((l, i) => (
          <div
            key={l}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: 2,
                alignItems: 'flex-end',
                height: 140,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: color1,
                  borderRadius: '3px 3px 0 0',
                  height: `${(data1[i] / max) * 100}%`,
                  transition: 'height .4s ease',
                  minHeight: 4,
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: color2,
                  borderRadius: '3px 3px 0 0',
                  height: `${(data2[i] / max) * 100}%`,
                  transition: 'height .4s ease',
                  minHeight: 4,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function DonutChart({
  segments,
  size = 120,
}: {
  segments: { name: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  const r = 45,
    cx = 60,
    cy = 60;
  const paths = segments.map((seg, index) => {
    const startValue = segments
      .slice(0, index)
      .reduce((sum, item) => sum + item.value, 0);
    const endValue = startValue + seg.value;
    const startAngle = (startValue / total) * 2 * Math.PI - Math.PI / 2;
    const endAngle = (endValue / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle),
      y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle),
      y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return {
      ...seg,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
    };
  });
  return (
    <svg viewBox="0 0 120 120" style={{ width: size, height: size }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.9} />
      ))}
      <circle cx={cx} cy={cy} r={28} fill="var(--bg-card)" />
    </svg>
  );
}

// ─── GAUGE ────────────────────────────────────────────────────────────────────
function Gauge({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = value / max;
  const r = 54,
    cx = 70,
    cy = 70;
  const start = Math.PI;
  const angle = start + pct * Math.PI;
  const x1 = cx + r * Math.cos(start),
    y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(angle),
    y2 = cy + r * Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 140 80" style={{ width: '100%', maxWidth: 180 }}>
      <path
        d={`M ${cx + r * Math.cos(start)} ${
          cy + r * Math.sin(start)
        } A ${r} ${r} 0 1 1 ${cx + r * Math.cos(2 * Math.PI)} ${
          cy + r * Math.sin(2 * Math.PI)
        }`}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
        />
      )}
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        fontSize={20}
        fontWeight="600"
        fill={color}
      >
        {value}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={10} fill="#94A3B8">
        out of {max}
      </text>
    </svg>
  );
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color,
  height = 8,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        background: '#E2E8F0',
        borderRadius: 99,
        height,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width .6s ease',
        }}
      />
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 99,
        background: bg,
        color,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'income', label: 'Income', icon: '↑' },
  { id: 'expenses', label: 'Expenses', icon: '↓' },
  { id: 'clients', label: 'Clients', icon: '◎' },
  { id: 'payments', label: 'Payments', icon: '⊞' },
  { id: 'invoices', label: 'Invoices', icon: '▣' },
  { id: 'tax', label: 'Tax Planner', icon: '⬟' },
  { id: 'goals', label: 'Goals', icon: '◈' },
  { id: 'ai', label: 'AI Advisor', icon: '✦' },
  { id: 'profile', label: 'Profile', icon: '◯' },
] as const;

type PageId = (typeof NAV_ITEMS)[number]['id'];

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({
  onLogin,
  onGoRegister,
  dark,
  setDark,
}: {
  onLogin: (user: User) => void;
  onGoRegister: () => void;
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const user = await loginUser(email, password);
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const css = `
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${
      dark ? '#0B0F1A' : '#F4F6FB'
    }; padding: 16px; font-family: 'Outfit', sans-serif; }
    .auth-card { background: ${dark ? '#131929' : '#fff'}; border: 1px solid ${
    dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  }; border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; }
    .auth-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid ${
      dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'
    }; background: ${dark ? '#0B0F1A' : '#F8FAFC'}; color: ${
    dark ? '#E8EDF7' : '#0F172A'
  }; font-size: 14px; outline: none; transition: border .15s; box-sizing: border-box; }
    .auth-input:focus { border-color: #6366F1; }
    .auth-btn { width: 100%; padding: 12px; border-radius: 10px; background: #6366F1; color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: background .15s; margin-top: 20px; }
    .auth-btn:hover { background: #4F46E5; }
    .auth-label { font-size: 12.5px; font-weight: 600; color: ${
      dark ? '#8899BB' : '#64748B'
    }; margin-bottom: 6px; margin-top: 16px; display: block; }
    .auth-error { background: #FEE2E2; color: #DC2626; border-radius: 9px; padding: 10px 14px; font-size: 13px; margin-top: 14px; }
    .pass-wrap { position: relative; }
    .pass-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: ${
      dark ? '#8899BB' : '#94A3B8'
    }; font-size: 14px; }
  `;

  return (
    <div className="auth-page">
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{css}</style>
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            T
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: dark ? '#E8EDF7' : '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome back
          </div>
          <div
            style={{
              fontSize: 14,
              color: dark ? '#8899BB' : '#64748B',
              marginTop: 4,
            }}
          >
            Sign in to your TaxPal account
          </div>
        </div>

        <div
          style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 4,
            fontSize: 13,
            color: '#6366F1',
          }}
        >
          🎯 Demo: <strong>demo@taxpal.in</strong> / <strong>demo123</strong>
        </div>

        <label className="auth-label">Email Address</label>
        <input
          className="auth-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handle()}
        />

        <label className="auth-label">Password</label>
        <div className="pass-wrap">
          <input
            className="auth-input"
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle()}
            style={{ paddingRight: 40 }}
          />
          <button
            className="pass-toggle"
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? '🙈' : '👁'}
          </button>
        </div>

        {error && <div className="auth-error">⚠ {error}</div>}

        <button className="auth-btn" onClick={handle} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13.5,
            color: dark ? '#8899BB' : '#64748B',
          }}
        >
          Don't have an account?{' '}
          <span
            style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}
            onClick={onGoRegister}
          >
            Create one free
          </span>
        </div>

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button
            onClick={() => setDark(!dark)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: dark ? '#8899BB' : '#94A3B8',
            }}
          >
            {dark ? '☀ Light mode' : '◑ Dark mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────
function RegisterPage({
  onLogin,
  onGoLogin,
  dark,
}: {
  onLogin: (user: User) => void;
  onGoLogin: () => void;
  dark: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    profession: '',
    linkedin: '',
    portfolio: '',
    pan: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('Name, email and password are required.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const user = await registerUser({
        name: form.name,
        email: form.email,
        phone: form.phone,
        profession: form.profession,
        linkedin: form.linkedin,
        portfolio: form.portfolio,
        pan: form.pan,
        password: form.password,
      });
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const css = `
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${
      dark ? '#0B0F1A' : '#F4F6FB'
    }; padding: 16px; font-family: 'Outfit', sans-serif; }
    .auth-card { background: ${dark ? '#131929' : '#fff'}; border: 1px solid ${
    dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  }; border-radius: 20px; padding: 40px; width: 100%; max-width: 460px; }
    .auth-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid ${
      dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'
    }; background: ${dark ? '#0B0F1A' : '#F8FAFC'}; color: ${
    dark ? '#E8EDF7' : '#0F172A'
  }; font-size: 14px; outline: none; transition: border .15s; box-sizing: border-box; }
    .auth-input:focus { border-color: #6366F1; }
    .auth-btn { width: 100%; padding: 12px; border-radius: 10px; background: #6366F1; color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: background .15s; margin-top: 20px; }
    .auth-btn:hover { background: #4F46E5; }
    .auth-label { font-size: 12.5px; font-weight: 600; color: ${
      dark ? '#8899BB' : '#64748B'
    }; margin-bottom: 6px; margin-top: 16px; display: block; }
    .auth-error { background: #FEE2E2; color: #DC2626; border-radius: 9px; padding: 10px 14px; font-size: 13px; margin-top: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `;

  return (
    <div className="auth-page">
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{css}</style>
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            T
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: dark ? '#E8EDF7' : '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            Create account
          </div>
          <div
            style={{
              fontSize: 14,
              color: dark ? '#8899BB' : '#64748B',
              marginTop: 4,
            }}
          >
            Join thousands of freelancers on TaxPal
          </div>
        </div>

        <div className="form-row">
          <div>
            <label className="auth-label">Full Name *</label>
            <input
              className="auth-input"
              placeholder="Arjun Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="auth-label">Mobile Number</label>
            <input
              className="auth-input"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        <label className="auth-label">Email Address *</label>
        <input
          className="auth-input"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <label className="auth-label">Profession</label>
        <select
          className="auth-input"
          value={form.profession}
          onChange={(e) => setForm({ ...form, profession: e.target.value })}
        >
          <option value="">Select your profession...</option>
          {[
            'Freelance Developer',
            'Designer',
            'Content Creator',
            'Consultant',
            'Digital Marketer',
            'Photographer',
            'Videographer',
            'Other',
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <div className="form-row">
          <div>
            <label className="auth-label">LinkedIn Profile</label>
            <input
              className="auth-input"
              placeholder="linkedin.com/in/yourname"
              value={form.linkedin}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
            />
          </div>
          <div>
            <label className="auth-label">Portfolio URL</label>
            <input
              className="auth-input"
              placeholder="yourportfolio.com"
              value={form.portfolio}
              onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
            />
          </div>
        </div>

        <label className="auth-label">PAN Number</label>
        <input
          className="auth-input"
          placeholder="ABCDE1234F"
          value={form.pan}
          onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
        />

        <div className="form-row">
          <div>
            <label className="auth-label">Password *</label>
            <input
              className="auth-input"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="auth-label">Confirm Password *</label>
            <input
              className="auth-input"
              type="password"
              placeholder="Repeat password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
        </div>

        {error && <div className="auth-error">⚠ {error}</div>}

        <button className="auth-btn" onClick={handle} disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account →'}
        </button>

        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13.5,
            color: dark ? '#8899BB' : '#64748B',
          }}
        >
          Already have an account?{' '}
          <span
            style={{ color: '#6366F1', fontWeight: 700, cursor: 'pointer' }}
            onClick={onGoLogin}
          >
            Sign in
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TaxPal() {
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = sessionStorage.getItem('taxpal_user');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<PageId>('dashboard');
  const [dark, setDark] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [income, setIncome] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<number[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [showModal, setShowModal] = useState<ModalKey>(null);
  const [form, setForm] = useState<FormState>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const loadingDataRef = useRef(false);

  const handleLogin = (u: User) => {
    sessionStorage.setItem('taxpal_user', JSON.stringify(u));
    setDataLoaded(false);
    setUser(u);
    setPage('dashboard');
    setIncome([]);
    setExpenses([]);
    setClients([]);
    setGoals([]);
    setPayments([]);
    setMonthlyIncome([]);
    setMonthlyExpenses([]);
    setMonths([]);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('taxpal_user');
    setUser(null);
    setAuthPage('login');
    setPage('dashboard');
    setDataLoaded(false);
    setIncome([]);
    setExpenses([]);
    setClients([]);
    setGoals([]);
    setPayments([]);
    setMonthlyIncome([]);
    setMonthlyExpenses([]);
    setMonths([]);
  };

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const userId = user.id;
    let cancelled = false;
    loadingDataRef.current = true;

    fetchUser(userId)
      .then((fetchedUser) => {
        if (!cancelled && fetchedUser) {
          sessionStorage.setItem('taxpal_user', JSON.stringify(fetchedUser));
          setUser(fetchedUser);
        }
        return userId;
      })
      .catch(() => userId)
      .then((currentUserId) => fetchAppData(currentUserId))
      .then((data) => {
        if (cancelled) return;
        setIncome(data.income || []);
        setExpenses(data.expenses || []);
        setClients(data.clients || []);
        setGoals(data.goals || []);
        setPayments(data.payments || []);
        setMonthlyIncome(data.monthlyIncome || []);
        setMonthlyExpenses(data.monthlyExpenses || []);
        setMonths(data.months || []);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load user data:', error);
        }
      })
      .finally(() => {
        if (cancelled) return;
        loadingDataRef.current = false;
        setDataLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !dataLoaded || loadingDataRef.current) return;
    saveAppData(user.id, {
      income,
      expenses,
      clients,
      goals,
      payments,
      monthlyIncome,
      monthlyExpenses,
      months,
    }).catch(console.error);
  }, [
    user?.id,
    dataLoaded,
    income,
    expenses,
    clients,
    goals,
    payments,
    monthlyIncome,
    monthlyExpenses,
    months,
  ]);

  if (!user) {
    if (authPage === 'register')
      return (
        <RegisterPage
          onLogin={handleLogin}
          onGoLogin={() => setAuthPage('login')}
          dark={dark}
        />
      );
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoRegister={() => setAuthPage('register')}
        dark={dark}
        setDark={setDark}
      />
    );
  }

  const totalIncome = income.reduce((a, b) => a + b.amount, 0);
  const totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const taxableIncome = Math.max(netProfit - 250000, 0);
  const taxEstimate =
    taxableIncome <= 250000
      ? 0
      : taxableIncome <= 500000
      ? taxableIncome * 0.05
      : taxableIncome <= 1000000
      ? 12500 + (taxableIncome - 500000) * 0.2
      : 112500 + (taxableIncome - 1000000) * 0.3;
  const pendingPayments = payments
    .filter((p) => p.status !== 'Paid')
    .reduce((a, b) => a + b.amount, 0);
  const healthScore = Math.min(
    100,
    Math.round(
      (netProfit / totalIncome) * 40 +
        (1 - totalExpenses / totalIncome) * 30 +
        (income.length > 3 ? 20 : 10) +
        10
    )
  );

  const theme = {
    '--bg': dark ? '#0B0F1A' : '#F4F6FB',
    '--bg-card': dark ? '#131929' : '#FFFFFF',
    '--bg-sidebar': dark ? '#0D1424' : '#FFFFFF',
    '--text': dark ? '#E8EDF7' : '#0F172A',
    '--text2': dark ? '#8899BB' : '#64748B',
    '--border': dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    '--accent': '#6366F1',
    '--accent2': '#4F46E5',
  } as CSSProperties & Record<`--${string}`, string>;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Outfit', 'DM Sans', sans-serif; }
    .page { min-height: 100vh; background: var(--bg); color: var(--text); transition: background .3s, color .3s; }
    .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 220px; background: var(--bg-sidebar); border-right: 1px solid var(--border); z-index: 100; padding: 0; display: flex; flex-direction: column; }
    .sidebar-logo { padding: 20px 20px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 18px; cursor: pointer; border-radius: 8px; margin: 1px 8px; font-size: 13.5px; font-weight: 500; transition: background .15s, color .15s; color: var(--text2); }
    .nav-item:hover { background: rgba(99,102,241,0.08); color: var(--accent); }
    .nav-item.active { background: rgba(99,102,241,0.12); color: var(--accent); }
    .main { margin-left: 220px; padding: 28px 32px; }
    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .kpi { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; position: relative; overflow: hidden; }
    .kpi-label { font-size: 12px; color: var(--text2); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
    .kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 18px; }
    .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .table th { text-align: left; color: var(--text2); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; padding: 10px 14px; border-bottom: 1px solid var(--border); }
    .table td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
    .table tr:last-child td { border-bottom: none; }
    .table tr:hover td { background: rgba(99,102,241,0.04); }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; }
    .btn-primary { background: #6366F1; color: #fff; }
    .btn-primary:hover { background: #4F46E5; }
    .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
    .btn-ghost:hover { background: rgba(99,102,241,0.08); color: var(--accent); }
    .input { width: 100%; padding: 9px 13px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 13.5px; outline: none; transition: border .15s; }
    .input:focus { border-color: var(--accent); }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 18px; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
    .ai-chip { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%); color: var(--accent); padding: 7px 14px; border-radius: 99px; font-size: 12.5px; font-weight: 600; border: 1px solid rgba(99,102,241,0.2); margin-bottom: 10px; }
    .insight-item { padding: 12px 16px; border-radius: 10px; background: rgba(99,102,241,0.05); border-left: 3px solid var(--accent); margin-bottom: 10px; font-size: 13.5px; line-height: 1.5; }
    .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: var(--bg-card); border-radius: 16px; padding: 28px; width: 100%; max-width: 480px; border: 1px solid var(--border); }
    .label { font-size: 12.5px; font-weight: 600; color: var(--text2); margin-bottom: 5px; margin-top: 14px; display: block; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .chip { padding: 5px 14px; border-radius: 99px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); cursor: pointer; transition: all .15s; color: var(--text2); background: transparent; }
    .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    @media (max-width: 900px) { .sidebar { transform: translateX(-100%); transition: transform .25s; } .sidebar.open { transform: none; } .main { margin-left: 0; padding: 18px 16px; } .grid2 { grid-template-columns: 1fr; } .grid3 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .grid3 { grid-template-columns: 1fr; } .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn .35s ease forwards; }
    .topbar { display: none; }
    @media (max-width: 900px) { .topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; } }
  `;

  return (
    <div className="page" style={theme}>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{css}</style>

      {/* SIDEBAR */}
      <nav className={`sidebar${sideOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
              T
            </span>
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: '-0.02em',
              color: dark ? '#E8EDF7' : '#0F172A',
            }}
          >
            TaxPal
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              background: 'rgba(99,102,241,0.12)',
              color: '#6366F1',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            PRO
          </span>
        </div>
        <div style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map((n) => (
            <div
              key={n.id}
              className={`nav-item${page === n.id ? ' active' : ''}`}
              onClick={() => {
                setPage(n.id);
                setSideOpen(false);
              }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>
                {n.icon}
              </span>
              <span>{n.label}</span>
              {n.id === 'payments' &&
                payments.filter((p) => p.status === 'Overdue').length > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#EF4444',
                      color: '#fff',
                      borderRadius: 99,
                      padding: '1px 7px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {payments.filter((p) => p.status === 'Overdue').length}
                  </span>
                )}
            </div>
          ))}
        </div>
        <div
          style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: dark ? '#E8EDF7' : '#0F172A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.profession || 'Freelancer'}
              </div>
              {(user.linkedin || user.pan) && (
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
                  {user.linkedin ? 'LinkedIn: ' + user.linkedin : ''}
                  {user.linkedin && user.pan ? ' · ' : ''}
                  {user.pan ? 'PAN: ' + user.pan : ''}
                </div>
              )}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* TOPBAR (mobile) */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              color: 'var(--text)',
            }}
            onClick={() => setSideOpen(!sideOpen)}
          >
            ☰
          </button>
          <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
            TaxPal
          </span>
        </div>
        <button
          onClick={() => setDark(!dark)}
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {dark ? '☀ Light' : '⬡ Dark'}
        </button>
      </div>

      {/* OVERLAY (mobile) */}
      {sideOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 90,
          }}
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* MAIN CONTENT */}
      <main className="main fade-in" key={page}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text)',
              }}
            >
              {NAV_ITEMS.find((n) => n.id === page)?.label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              {page === 'dashboard'
                ? `Welcome back, ${user.name} 👋  Here's your financial overview`
                : ''}
            </div>
          </div>
          <button
            onClick={() => setDark(!dark)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 16px',
              cursor: 'pointer',
              color: 'var(--text2)',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            className="topbar-hidden"
          >
            {dark ? '☀' : '◑'} {dark ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* ── DASHBOARD ── */}
        {page === 'dashboard' && (
          <Dashboard
            {...{
              totalIncome,
              totalExpenses,
              netProfit,
              taxEstimate,
              pendingPayments,
              healthScore,
              income,
              expenses,
              goals,
              monthlyIncome,
              monthlyExpenses,
              months,
              dark,
            }}
          />
        )}
        {page === 'income' && (
          <IncomePage
            income={income}
            setIncome={setIncome}
            showModal={showModal}
            setShowModal={setShowModal}
            form={form}
            setForm={setForm}
          />
        )}
        {page === 'expenses' && (
          <ExpensesPage
            expenses={expenses}
            setExpenses={setExpenses}
            showModal={showModal}
            setShowModal={setShowModal}
            form={form}
            setForm={setForm}
          />
        )}
        {page === 'clients' && <ClientsPage clients={clients} />}
        {page === 'payments' && (
          <PaymentsPage payments={payments} setPayments={setPayments} />
        )}
        {page === 'invoices' && <InvoicesPage clients={clients} />}
        {page === 'tax' && (
          <TaxPage
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netProfit={netProfit}
            taxEstimate={taxEstimate}
          />
        )}
        {page === 'goals' && (
          <GoalsPage
            goals={goals}
            setGoals={setGoals}
            showModal={showModal}
            setShowModal={setShowModal}
            form={form}
            setForm={setForm}
          />
        )}
        {page === 'ai' && (
          <AIAdvisorPage
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netProfit={netProfit}
            taxEstimate={taxEstimate}
            healthScore={healthScore}
            clients={clients}
          />
        )}
        {page === 'profile' && (
          <ProfilePage user={user} onUserUpdate={(updatedUser) => {
            sessionStorage.setItem('taxpal_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          }} />
        )}
      </main>
    </div>
  );
}

// ─── DASHBOARD PAGE ──────────────────────────────────────────────────────────
function Dashboard({
  totalIncome,
  totalExpenses,
  netProfit,
  taxEstimate,
  pendingPayments,
  healthScore,
  income,
  expenses,
  goals,
  monthlyIncome,
  monthlyExpenses,
  months,
  dark,
}: {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  taxEstimate: number;
  pendingPayments: number;
  healthScore: number;
  income: IncomeItem[];
  expenses: ExpenseItem[];
  goals: GoalItem[];
  monthlyIncome: number[];
  monthlyExpenses: number[];
  months: string[];
  dark: boolean;
}) {
  const scoreColor =
    healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#EF4444';
  const scoreLabel =
    healthScore >= 75
      ? 'Excellent'
      : healthScore >= 50
      ? 'Good'
      : 'Needs Attention';

  const expCats: Record<string, number> = {};
  expenses.forEach((e) => {
    expCats[e.category] = (expCats[e.category] || 0) + e.amount;
  });
  const catColors = [
    '#6366F1',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#0EA5E9',
    '#F97316',
    '#14B8A6',
  ];
  const catSegs = Object.entries(expCats).map(([name, value], i) => ({
    name,
    value,
    color: catColors[i % catColors.length],
  }));

  const clientRevs: Record<string, number> = {};
  income.forEach((i) => {
    clientRevs[i.client] = (clientRevs[i.client] || 0) + i.amount;
  });
  const topClient = Object.entries(clientRevs).sort((a, b) => b[1] - a[1])[0];
  const recentTransactions: RecentTransaction[] = [
    ...income.slice(0, 3).map((item): RecentTransaction => ({
      ...item,
      type: 'income',
    })),
    ...expenses.slice(0, 3).map((item): RecentTransaction => ({
      type: 'expense',
      client: item.description,
      category: item.category,
      amount: item.amount,
      date: item.date,
    })),
  ].slice(0, 6);

  return (
    <>
      {/* KPI Cards */}
      <div className="kpi-grid">
        {[
          {
            label: 'Total Income',
            value: fmtK(totalIncome),
            sub: '+18% vs last month',
            color: '#10B981',
            bg: '#ECFDF5',
            data: monthlyIncome,
          },
          {
            label: 'Total Expenses',
            value: fmtK(totalExpenses),
            sub: '6 categories',
            color: '#EF4444',
            bg: '#FFF1F2',
            data: monthlyExpenses,
          },
          {
            label: 'Net Profit',
            value: fmtK(netProfit),
            sub: `${Math.round((netProfit / totalIncome) * 100)}% margin`,
            color: '#6366F1',
            bg: '#EEF2FF',
            data: monthlyIncome.map(
              (v, i) => v - monthlyExpenses[i]
            ),
          },
          {
            label: 'Tax Estimate',
            value: fmtK(taxEstimate),
            sub: 'FY 2025-26',
            color: '#F59E0B',
            bg: '#FFFBEB',
            data: [0, 0, 4000, 5000, 7000, 9000],
          },
          {
            label: 'Pending',
            value: fmtK(pendingPayments),
            sub: '3 invoices due',
            color: '#8B5CF6',
            bg: '#F5F3FF',
            data: [0, 5000, 12000, 8000, 11000, 13000],
          },
          {
            label: 'Health Score',
            value: healthScore,
            sub: scoreLabel,
            color: scoreColor,
            bg: dark ? 'rgba(16,185,129,0.1)' : '#ECFDF5',
            data: [60, 63, 68, 71, 73, healthScore],
          },
        ].map((k, i) => (
          <div
            className="kpi"
            key={i}
            style={{ borderTop: `3px solid ${k.color}` }}
          >
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>
              {k.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              {k.sub}
            </div>
            <Sparkline data={k.data} color={k.color} />
          </div>
        ))}
      </div>

      <div className="grid2">
        {/* Income vs Expenses */}
        <div className="card">
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 16,
              color: 'var(--text)',
            }}
          >
            Income vs Expenses
          </div>
          <BarChart
            data1={monthlyIncome}
            data2={monthlyExpenses}
            labels={months}
            color1="#6366F1"
            color2="#F43F5E"
            label1="Income"
            label2="Expenses"
          />
        </div>

        {/* Expense Breakdown */}
        <div className="card">
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 16,
              color: 'var(--text)',
            }}
          >
            Expense Breakdown
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <DonutChart segments={catSegs} size={130} />
            <div style={{ flex: 1 }}>
              {catSegs.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: s.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 12.5, color: 'var(--text2)', flex: 1 }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {Math.round((s.value / totalExpenses) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid2">
        {/* Financial Health */}
        <div className="card">
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 12,
              color: 'var(--text)',
            }}
          >
            Financial Health Score
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Gauge value={healthScore} color={scoreColor} />
            <div style={{ flex: 1 }}>
              {[
                {
                  label: 'Savings Rate',
                  val: Math.round((netProfit / totalIncome) * 100),
                  max: 100,
                  color: '#10B981',
                },
                {
                  label: 'Expense Control',
                  val: Math.round(100 - (totalExpenses / totalIncome) * 100),
                  max: 100,
                  color: '#6366F1',
                },
                {
                  label: 'Client Diversity',
                  val:
                    income.reduce((s, i) => {
                      s.add(i.client);
                      return s;
                    }, new Set<string>()).size * 20,
                  max: 100,
                  color: '#F59E0B',
                },
                {
                  label: 'Tax Readiness',
                  val: taxEstimate > 0 ? 60 : 80,
                  max: 100,
                  color: '#8B5CF6',
                },
              ].map((m, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {m.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {m.val}%
                    </span>
                  </div>
                  <ProgressBar value={m.val} max={m.max} color={m.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="card">
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 14,
              color: 'var(--text)',
            }}
          >
            ✦ AI Insights
          </div>
          {[
            {
              text: `Your top client ${topClient?.[0]} contributes ${Math.round(
                (topClient?.[1] / totalIncome) * 100
              )}% of total revenue. Diversify to reduce risk.`,
              type: 'warn',
            },
            {
              text: `Net profit margin is ${Math.round(
                (netProfit / totalIncome) * 100
              )}%. Industry avg is 65%. You're performing above average.`,
              type: 'good',
            },
            {
              text: `You have ₹${pendingPayments.toLocaleString(
                'en-IN'
              )} in pending payments. Chase Pixel Studio invoice (overdue).`,
              type: 'warn',
            },
            {
              text: `Set aside ₹${Math.round(taxEstimate / 12).toLocaleString(
                'en-IN'
              )}/mo for taxes. You're on track for FY 2025-26.`,
              type: 'info',
            },
          ].map((ins, i) => (
            <div
              key={i}
              className="insight-item"
              style={{
                borderLeftColor:
                  ins.type === 'good'
                    ? '#10B981'
                    : ins.type === 'warn'
                    ? '#F59E0B'
                    : '#6366F1',
                background:
                  ins.type === 'good'
                    ? 'rgba(16,185,129,0.05)'
                    : ins.type === 'warn'
                    ? 'rgba(245,158,11,0.05)'
                    : 'rgba(99,102,241,0.05)',
              }}
            >
              <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
                {ins.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Goals Overview */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 16,
            color: 'var(--text)',
          }}
        >
          Savings Goals
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          {goals.map((g) => (
            <div
              key={g.id}
              style={{
                padding: 16,
                background: 'var(--bg)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{g.icon}</div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--text)',
                  marginBottom: 4,
                }}
              >
                {g.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  marginBottom: 10,
                }}
              >
                {fmt(g.saved)} of {fmt(g.target)}
              </div>
              <ProgressBar value={g.saved} max={g.target} color="#6366F1" />
              <div
                style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 6 }}
              >
                {Math.round((g.saved / g.target) * 100)}% complete
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 16,
            color: 'var(--text)',
          }}
        >
          Recent Transactions
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client/Desc</th>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{t.client}</span>
                      <br />
                      <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                        {t.type === 'income' ? t.project : t.category}
                      </span>
                    </td>
                    <td>
                      <Badge
                        label={t.type === 'income' ? 'Income' : 'Expense'}
                        color={t.type === 'income' ? '#059669' : '#DC2626'}
                        bg={t.type === 'income' ? '#D1FAE5' : '#FEE2E2'}
                      />
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                      {t.date}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: t.type === 'income' ? '#10B981' : '#EF4444',
                      }}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {fmt(t.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── INCOME PAGE ─────────────────────────────────────────────────────────────
function IncomePage({
  income,
  setIncome,
  showModal,
  setShowModal,
  form,
  setForm,
}: {
  income: IncomeItem[];
  setIncome: Dispatch<SetStateAction<IncomeItem[]>>;
  showModal: ModalKey;
  setShowModal: Dispatch<SetStateAction<ModalKey>>;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  const [search, setSearch] = useState('');
  const filtered = income.filter(
    (i) =>
      i.client.toLowerCase().includes(search.toLowerCase()) ||
      i.project.toLowerCase().includes(search.toLowerCase())
  );
  const total = filtered.reduce((a, b) => a + b.amount, 0);

  const save = () => {
    if (!form.client || !form.amount) return;
    const formId = typeof form.id === 'number' ? form.id : undefined;
    const formDate = typeof form.date === 'string' ? form.date : undefined;
    if (formId) {
      setIncome(
        income.map((i) =>
          i.id === formId
            ? {
                ...i,
                ...form,
                id: formId,
                amount: +form.amount,
              }
            : i
        )
      );
    } else {
      setIncome([
        ...income,
        {
          ...form,
          id: Date.now(),
          amount: +form.amount,
          date: formDate || new Date().toISOString().split('T')[0],
        } as IncomeItem,
      ]);
    }
    setShowModal(null);
    setForm({});
  };

  return (
    <>
      <div
        style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="🔍  Search income..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setForm({});
            setShowModal('income');
          }}
        >
          + Add Income
        </button>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi" style={{ borderTop: '3px solid #10B981' }}>
          <div className="kpi-label">Total Shown</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>
            {fmtK(total)}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #6366F1' }}>
          <div className="kpi-label">Entries</div>
          <div className="kpi-value" style={{ color: '#6366F1' }}>
            {filtered.length}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #F59E0B' }}>
          <div className="kpi-label">Avg per Entry</div>
          <div className="kpi-value" style={{ color: '#F59E0B' }}>
            {filtered.length ? fmtK(Math.round(total / filtered.length)) : '—'}
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Method</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{i.client}</span>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{i.project}</td>
                  <td>
                    <Badge
                      label={i.method}
                      color="#6366F1"
                      bg="rgba(99,102,241,0.1)"
                    />
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                    {i.date}
                  </td>
                  <td style={{ fontWeight: 700, color: '#10B981' }}>
                    +{fmt(i.amount)}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', marginRight: 6 }}
                      onClick={() => {
                        setForm(i);
                        setShowModal('income');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{
                        padding: '4px 10px',
                        background: '#FFF1F2',
                        color: '#E11D48',
                        border: 'none',
                      }}
                      onClick={() =>
                        setIncome(income.filter((x) => x.id !== i.id))
                      }
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal === 'income' && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>
              {form.id ? 'Edit' : 'Add'} Income
            </div>
            {[
              ['client', 'Client Name'],
              ['project', 'Project Name'],
              ['method', 'Payment Method'],
              ['date', 'Date'],
              ['notes', 'Notes (optional)'],
            ].map(([k, l]) => (
              <div key={k}>
                <label className="label">{l}</label>
                <input
                  className="input"
                  type={k === 'date' ? 'date' : 'text'}
                  value={String(form[k] ?? '')}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <label className="label">Amount (₹)</label>
            <input
              className="input"
              type="number"
              value={String(form.amount ?? '')}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={save}
              >
                Save
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowModal(null);
                  setForm({});
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── EXPENSES PAGE ────────────────────────────────────────────────────────────
function ExpensesPage({
  expenses,
  setExpenses,
  showModal,
  setShowModal,
  form,
  setForm,
}: {
  expenses: ExpenseItem[];
  setExpenses: Dispatch<SetStateAction<ExpenseItem[]>>;
  showModal: ModalKey;
  setShowModal: Dispatch<SetStateAction<ModalKey>>;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  const [filterCat, setFilterCat] = useState('All');
  const cats = ['All', ...new Set(expenses.map((e) => e.category))];
  const filtered =
    filterCat === 'All'
      ? expenses
      : expenses.filter((e) => e.category === filterCat);
  const total = filtered.reduce((a, b) => a + b.amount, 0);
  const recurring = expenses
    .filter((e) => e.recurring)
    .reduce((a, b) => a + b.amount, 0);

  const save = () => {
    if (typeof form.description !== 'string' || !form.description || !form.amount) return;
    const formId = typeof form.id === 'number' ? form.id : undefined;
    const formDate = typeof form.date === 'string' ? form.date : undefined;
    if (formId) {
      setExpenses(
        expenses.map((e) =>
          e.id === formId
            ? {
                ...e,
                ...form,
                id: formId,
                amount: +form.amount,
              }
            : e
        )
      );
    } else {
      setExpenses([
        ...expenses,
        {
          ...form,
          id: Date.now(),
          amount: +form.amount,
          recurring: false,
          date: formDate || new Date().toISOString().split('T')[0],
        } as ExpenseItem,
      ]);
    }
    setShowModal(null);
    setForm({});
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {cats.map((c) => (
            <button
              key={c}
              className={`chip${filterCat === c ? ' active' : ''}`}
              onClick={() => setFilterCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({});
            setShowModal('expense');
          }}
        >
          + Add Expense
        </button>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi" style={{ borderTop: '3px solid #EF4444' }}>
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value" style={{ color: '#EF4444' }}>
            {fmtK(total)}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #F59E0B' }}>
          <div className="kpi-label">Recurring /mo</div>
          <div className="kpi-value" style={{ color: '#F59E0B' }}>
            {fmtK(recurring)}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #8B5CF6' }}>
          <div className="kpi-label">Entries</div>
          <div className="kpi-value" style={{ color: '#8B5CF6' }}>
            {filtered.length}
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Date</th>
                <th>Recurring</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.description}</td>
                  <td>
                    <Badge
                      label={e.category}
                      color="#6366F1"
                      bg="rgba(99,102,241,0.1)"
                    />
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                    {e.date}
                  </td>
                  <td>
                    {e.recurring ? (
                      <Badge label="Monthly" color="#059669" bg="#D1FAE5" />
                    ) : (
                      <span style={{ color: 'var(--text2)', fontSize: 12 }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: '#EF4444' }}>
                    -{fmt(e.amount)}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', marginRight: 6 }}
                      onClick={() => {
                        setForm(e);
                        setShowModal('expense');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{
                        padding: '4px 10px',
                        background: '#FFF1F2',
                        color: '#E11D48',
                        border: 'none',
                      }}
                      onClick={() =>
                        setExpenses(expenses.filter((x) => x.id !== e.id))
                      }
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal === 'expense' && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>
              {form.id ? 'Edit' : 'Add'} Expense
            </div>
            <label className="label">Description</label>
            <input
              className="input"
              value={String(form.description ?? '')}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <label className="label">Category</label>
            <div className="chip-row">
              {[
                'Internet',
                'Software',
                'Hardware',
                'Electricity',
                'Travel',
                'Marketing',
                'Food',
                'Education',
                'Other',
              ].map((c) => (
                <button
                  key={c}
                  className={`chip${form.category === c ? ' active' : ''}`}
                  onClick={() => setForm({ ...form, category: c })}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={String(form.date ?? '')}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <label className="label">Amount (₹)</label>
            <input
              className="input"
              type="number"
              value={String(form.amount ?? '')}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={save}
              >
                Save
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowModal(null);
                  setForm({});
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── CLIENTS PAGE ─────────────────────────────────────────────────────────────
function ClientsPage({ clients }: { clients: ClientItem[] }) {
  const totalRev = clients.reduce((a, b) => a + b.revenue, 0);
  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi" style={{ borderTop: '3px solid #6366F1' }}>
          <div className="kpi-label">Total Clients</div>
          <div className="kpi-value" style={{ color: '#6366F1' }}>
            {clients.length}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #10B981' }}>
          <div className="kpi-label">Active</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>
            {clients.filter((c) => c.status === 'Active').length}
          </div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #F59E0B' }}>
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value" style={{ color: '#F59E0B' }}>
            {fmtK(totalRev)}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 16,
            color: 'var(--text)',
          }}
        >
          Client Revenue Share
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            height: 120,
          }}
        >
          {[...clients]
            .sort((a, b) => b.revenue - a.revenue)
            .map((c, i) => {
              const colors = [
                '#6366F1',
                '#10B981',
                '#F59E0B',
                '#8B5CF6',
                '#EF4444',
              ];
              const pct = (c.revenue / totalRev) * 100;
              return (
                <div
                  key={c.id}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text2)',
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(pct)}%
                  </span>
                  <div
                    style={{
                      width: '100%',
                      background: colors[i],
                      borderRadius: '4px 4px 0 0',
                      height: `${pct}%`,
                      minHeight: 8,
                      transition: 'height .5s',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text2)',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {c.name.split(' ')[0]}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Projects</th>
                <th>Revenue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {c.name[0]}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                    {c.company}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                    {c.email}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {c.projects}
                  </td>
                  <td style={{ fontWeight: 700, color: '#10B981' }}>
                    {fmt(c.revenue)}
                  </td>
                  <td>
                    <Badge
                      label={c.status}
                      color={c.status === 'Active' ? '#059669' : '#DC2626'}
                      bg={c.status === 'Active' ? '#D1FAE5' : '#FEE2E2'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── PAYMENTS PAGE ────────────────────────────────────────────────────────────
function PaymentsPage({
  payments,
  setPayments,
}: {
  payments: PaymentItem[];
  setPayments: Dispatch<SetStateAction<PaymentItem[]>>;
}) {
  const markPaid = (id: number) =>
    setPayments(
      payments.map((p) => (p.id === id ? { ...p, status: 'Paid' } : p))
    );
  const statusColor: Record<PaymentItem['status'], { c: string; bg: string }> = {
    Pending: { c: '#D97706', bg: '#FEF3C7' },
    Paid: { c: '#059669', bg: '#D1FAE5' },
    Overdue: { c: '#DC2626', bg: '#FEE2E2' },
  };

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          {
            label: 'Total Pending',
            value: fmtK(
              payments
                .filter((p) => p.status === 'Pending')
                .reduce((a, b) => a + b.amount, 0)
            ),
            color: '#F59E0B',
          },
          {
            label: 'Overdue',
            value: fmtK(
              payments
                .filter((p) => p.status === 'Overdue')
                .reduce((a, b) => a + b.amount, 0)
            ),
            color: '#EF4444',
          },
          {
            label: 'Collected',
            value: fmtK(
              payments
                .filter((p) => p.status === 'Paid')
                .reduce((a, b) => a + b.amount, 0)
            ),
            color: '#10B981',
          },
        ].map((k, i) => (
          <div
            className="kpi"
            key={i}
            style={{ borderTop: `3px solid ${k.color}` }}
          >
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.client}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                    {p.project}
                  </td>
                  <td
                    style={{
                      color:
                        p.status === 'Overdue' ? '#EF4444' : 'var(--text2)',
                      fontSize: 13,
                      fontWeight: p.status === 'Overdue' ? 600 : 400,
                    }}
                  >
                    {p.dueDate}
                  </td>
                  <td>
                    <Badge
                      label={p.status}
                      color={statusColor[p.status]?.c}
                      bg={statusColor[p.status]?.bg}
                    />
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {fmt(p.amount)}
                  </td>
                  <td>
                    {p.status !== 'Paid' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '5px 12px', fontSize: 12 }}
                        onClick={() => markPaid(p.id)}
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── INVOICES PAGE ────────────────────────────────────────────────────────────
function InvoicesPage({ clients }: { clients: ClientItem[] }) {
  const [inv, setInv] = useState({
    client: '',
    project: '',
    amount: '',
    tax: 18,
    notes: '',
  });
  const [preview, setPreview] = useState(false);
  const [invoiceNumber] = useState(() =>
    String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')
  );
  const invNum = 'INV-2025-' + invoiceNumber;
  const today = new Date().toISOString().split('T')[0];
  const subtotal = +inv.amount || 0;
  const taxAmt = Math.round(subtotal * (inv.tax / 100));
  const total = subtotal + taxAmt;

  return (
    <div className="grid2">
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>
          Generate Invoice
        </div>
        <label className="label">Client</label>
        <select
          className="input"
          value={inv.client}
          onChange={(e) => setInv({ ...inv, client: e.target.value })}
        >
          <option value="">Select client...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name} — {c.company}
            </option>
          ))}
        </select>
        <label className="label">Project / Service</label>
        <input
          className="input"
          placeholder="e.g. Website Redesign"
          value={inv.project}
          onChange={(e) => setInv({ ...inv, project: e.target.value })}
        />
        <label className="label">Amount (₹)</label>
        <input
          className="input"
          type="number"
          placeholder="0"
          value={inv.amount}
          onChange={(e) => setInv({ ...inv, amount: e.target.value })}
        />
        <label className="label">GST Rate (%)</label>
        <div className="chip-row">
          {[0, 5, 12, 18, 28].map((t) => (
            <button
              key={t}
              className={`chip${inv.tax === t ? ' active' : ''}`}
              onClick={() => setInv({ ...inv, tax: t })}
            >
              {t}%
            </button>
          ))}
        </div>
        <label className="label">Notes</label>
        <textarea
          className="input"
          rows={3}
          placeholder="Payment terms, bank details..."
          value={inv.notes}
          onChange={(e) => setInv({ ...inv, notes: e.target.value })}
        />
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
          onClick={() => setPreview(true)}
        >
          Preview Invoice →
        </button>
      </div>

      {preview && (
        <div
          className="card"
          style={{ fontFamily: 'serif', position: 'relative' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#6366F1',
                  letterSpacing: '-0.02em',
                }}
              >
                TAXPAL
              </div>
              <div
                style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}
              >
                Professional Invoice
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{invNum}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                Date: {today}
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: '2px solid #6366F1',
              borderBottom: '1px solid var(--border)',
              padding: '14px 0',
              marginBottom: 16,
            }}
          >
            <div
              style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}
            >
              BILLED TO
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {inv.client || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {clients.find((c) => c.name === inv.client)?.company}
            </div>
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(99,102,241,0.07)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontWeight: 600,
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '8px 10px',
                    fontWeight: 600,
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px' }}>{inv.project || 'Service'}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {fmt(subtotal)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>
                  GST @ {inv.tax}%
                </td>
                <td
                  style={{
                    padding: '10px',
                    textAlign: 'right',
                    color: 'var(--text2)',
                  }}
                >
                  {fmt(taxAmt)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                background: '#6366F1',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              Total: {fmt(total)}
            </div>
          </div>
          {inv.notes && (
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: 'var(--text2)',
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
              }}
            >
              {inv.notes}
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
            onClick={() => window.print()}
          >
            ⬇ Download / Print
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TAX PAGE ─────────────────────────────────────────────────────────────────
function TaxPage({
  totalIncome,
  totalExpenses,
  netProfit,
  taxEstimate,
}: {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  taxEstimate: number;
}) {
  const slabs = [
    {
      label: 'Up to ₹2.5L',
      rate: '0%',
      applies: Math.min(250000, netProfit),
      tax: 0,
    },
    {
      label: '₹2.5L – ₹5L',
      rate: '5%',
      applies: Math.max(0, Math.min(netProfit, 500000) - 250000),
      tax: Math.max(0, Math.min(netProfit, 500000) - 250000) * 0.05,
    },
    {
      label: '₹5L – ₹10L',
      rate: '20%',
      applies: Math.max(0, Math.min(netProfit, 1000000) - 500000),
      tax: Math.max(0, Math.min(netProfit, 1000000) - 500000) * 0.2,
    },
    {
      label: 'Above ₹10L',
      rate: '30%',
      applies: Math.max(0, netProfit - 1000000),
      tax: Math.max(0, netProfit - 1000000) * 0.3,
    },
  ];

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Gross Income', value: fmtK(totalIncome), color: '#10B981' },
          {
            label: 'Deductible Expenses',
            value: fmtK(totalExpenses),
            color: '#6366F1',
          },
          {
            label: 'Taxable Income',
            value: fmtK(Math.max(netProfit - 0, 0)),
            color: '#F59E0B',
          },
          {
            label: 'Tax Liability',
            value: fmtK(taxEstimate),
            color: '#EF4444',
          },
        ].map((k, i) => (
          <div
            className="kpi"
            key={i}
            style={{ borderTop: `3px solid ${k.color}` }}
          >
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            Tax Slab Breakdown (Old Regime)
          </div>
          {slabs.map((s, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text2)',
                      marginLeft: 8,
                    }}
                  >
                    @ {s.rate}
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: s.tax > 0 ? '#EF4444' : 'var(--text2)',
                  }}
                >
                  {fmt(Math.round(s.tax))}
                </span>
              </div>
              <ProgressBar
                value={s.applies}
                max={totalIncome}
                color={
                  i === 0
                    ? '#10B981'
                    : i === 1
                    ? '#F59E0B'
                    : i === 2
                    ? '#F97316'
                    : '#EF4444'
                }
              />
            </div>
          ))}
          <div
            style={{
              borderTop: '2px solid var(--border)',
              paddingTop: 14,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total Tax</span>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#EF4444' }}>
              {fmt(Math.round(taxEstimate))}
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            Tax Saving Tips
          </div>
          {[
            {
              title: 'Section 80C',
              desc: 'Invest up to ₹1.5L in PPF, ELSS, LIC to save up to ₹46,800',
              saving: '₹46,800',
            },
            {
              title: 'Section 80D',
              desc: 'Health insurance premium deduction up to ₹25,000',
              saving: '₹7,750',
            },
            {
              title: 'Home Loan 24(b)',
              desc: 'Interest on home loan up to ₹2L deductible',
              saving: '₹62,400',
            },
            {
              title: 'NPS 80CCD(1B)',
              desc: 'Additional ₹50,000 investment over 80C',
              saving: '₹15,600',
            },
          ].map((tip, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                background: 'rgba(16,185,129,0.05)',
                borderRadius: 10,
                marginBottom: 10,
                borderLeft: '3px solid #10B981',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {tip.title}
                </span>
                <Badge
                  label={`Save ${tip.saving}`}
                  color="#059669"
                  bg="#D1FAE5"
                />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                {tip.desc}
              </div>
            </div>
          ))}
          <div
            style={{
              padding: 14,
              background: 'rgba(99,102,241,0.06)',
              borderRadius: 10,
              marginTop: 4,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 4,
                color: '#6366F1',
              }}
            >
              Advance Tax Reminder
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              If tax exceeds ₹10,000, pay advance tax in 4 installments. Next
              due: <strong>Sep 15</strong>.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── GOALS PAGE ───────────────────────────────────────────────────────────────
function GoalsPage({
  goals,
  setGoals,
  showModal,
  setShowModal,
  form,
  setForm,
}: {
  goals: GoalItem[];
  setGoals: Dispatch<SetStateAction<GoalItem[]>>;
  showModal: ModalKey;
  setShowModal: Dispatch<SetStateAction<ModalKey>>;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  const save = () => {
    if (typeof form.name !== 'string' || !form.name || !form.target) return;
    const formId = typeof form.id === 'number' ? form.id : undefined;
    const formIcon = typeof form.icon === 'string' ? form.icon : undefined;
    if (formId) {
      setGoals(
        goals.map((g) =>
          g.id === formId
            ? {
                ...g,
                ...form,
                id: formId,
                target: +form.target,
                saved: +form.saved,
              }
            : g
        )
      );
    } else {
      setGoals([
        ...goals,
        {
          ...form,
          id: Date.now(),
          target: +form.target,
          saved: +form.saved || 0,
          icon: formIcon || '🎯',
        } as GoalItem,
      ]);
    }
    setShowModal(null);
    setForm({});
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 20,
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({});
            setShowModal('goal');
          }}
        >
          + New Goal
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {goals.map((g) => {
          const pct = Math.round((g.saved / g.target) * 100);
          const remaining = g.target - g.saved;
          const colors = ['#6366F1', '#10B981', '#F59E0B', '#8B5CF6'];
          const c = colors[g.id % colors.length] || '#6366F1';
          return (
            <div
              className="card"
              key={g.id}
              style={{ borderTop: `3px solid ${c}` }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 28 }}>{g.icon}</div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => {
                    setForm(g);
                    setShowModal('goal');
                  }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {g.name}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text2)',
                  marginBottom: 14,
                }}
              >
                Target: {fmt(g.target)} · Due {g.deadline}
              </div>
              <ProgressBar
                value={g.saved}
                max={g.target}
                color={c}
                height={10}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: c }}>
                  {pct}% saved
                </span>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {fmt(remaining)} left
                </span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12.5,
                  color: 'var(--text2)',
                  background: 'rgba(99,102,241,0.05)',
                  padding: '8px 12px',
                  borderRadius: 8,
                }}
              >
                Save ~{fmt(Math.ceil(remaining / 6))}/mo to reach by deadline
              </div>
            </div>
          );
        })}
      </div>
      {showModal === 'goal' && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>
              {form.id ? 'Edit' : 'New'} Goal
            </div>
            <label className="label">Goal Name</label>
            <input
              className="input"
              value={String(form.name ?? '')}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label className="label">Target Amount (₹)</label>
            <input
              className="input"
              type="number"
              value={String(form.target ?? '')}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
            <label className="label">Amount Saved (₹)</label>
            <input
              className="input"
              type="number"
              value={String(form.saved ?? '')}
              onChange={(e) => setForm({ ...form, saved: e.target.value })}
            />
            <label className="label">Deadline</label>
            <input
              className="input"
              type="date"
              value={String(form.deadline ?? '')}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
            <label className="label">Icon (emoji)</label>
            <div className="chip-row">
              {['🎯', '💻', '🚗', '🏖️', '🏠', '📱', '🛡️', '🎓'].map((ic) => (
                <button
                  key={ic}
                  className={`chip${form.icon === ic ? ' active' : ''}`}
                  style={{ fontSize: 16, padding: '4px 10px' }}
                  onClick={() => setForm({ ...form, icon: ic })}
                >
                  {ic}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={save}
              >
                Save
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowModal(null);
                  setForm({});
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── AI ADVISOR PAGE ─────────────────────────────────────────────────────────
function AIAdvisorPage({
  totalIncome,
  totalExpenses,
  netProfit,
  taxEstimate,
  healthScore,
  clients,
}: {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  taxEstimate: number;
  healthScore: number;
  clients: ClientItem[];
}) {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const topClient =
    clients.length > 0
      ? [...clients].sort((a, b) => b.revenue - a.revenue)[0]
      : null;
  const dependency = topClient
    ? totalIncome > 0
      ? Math.round((topClient.revenue / totalIncome) * 100)
      : 0
    : 0;

  const ask = async (q: string) => {
    if (!q.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: q };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setQuestion('');
    setLoading(true);

    try {
      const systemPrompt = `You are TaxPal AI, a smart financial advisor for Indian freelancers. The user's financial data:
- Total Income: ₹${totalIncome.toLocaleString('en-IN')}
- Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- Net Profit: ₹${netProfit.toLocaleString('en-IN')}
- Estimated Tax: ₹${taxEstimate.toLocaleString('en-IN')}
- Financial Health Score: ${healthScore}/100
${topClient ? `- Top Client: ${topClient.name} (${dependency}% of revenue)` : '- Top Client: None'}
Give specific, actionable financial advice. Be concise (3-5 sentences). Use ₹ for amounts. Reference actual user numbers when relevant.`;

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: newHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      let data: { text?: string } = {};

      try {
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          data = (await res.json()) as { text?: string };
        } else {
          const text = await res.text();
          data = { text: text || 'Unable to get response.' };
        }
      } catch {
        data = { text: 'Unable to get response.' };
      }

      if (!res.ok) {
        throw new Error(data.text || 'AI request failed.');
      }

      const aiText = data.text || 'Unable to get response.';
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: aiText },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Connection error. Please try again.';
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: message },
      ]);
    }
    setLoading(false);
  };

  const suggestions = [
    'How can I reduce my tax liability?',
    'Should I switch to the new tax regime?',
    'How to improve my financial health score?',
    "What's my client risk exposure?",
  ];

  return (
    <>
      <div className="grid2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            Financial Risk Analysis
          </div>
          {[
            {
              label: 'Revenue Dependency',
              desc: topClient
                ? `${topClient.name} contributes ${dependency}% of revenue`
                : 'Add clients to analyze revenue dependency',
              status: topClient && dependency > 50 ? 'high' : 'ok',
              value: dependency,
            },
            {
              label: 'Expense Ratio',
              desc: `${
                totalIncome > 0
                  ? Math.round((totalExpenses / totalIncome) * 100)
                  : 0
              }% of income spent`,
              status:
                totalIncome > 0 && totalExpenses / totalIncome > 0.5
                  ? 'high'
                  : 'ok',
              value:
                totalIncome > 0
                  ? Math.round((totalExpenses / totalIncome) * 100)
                  : 0,
            },
            {
              label: 'Tax Readiness',
              desc: `₹${Math.round(taxEstimate / 12).toLocaleString(
                'en-IN'
              )}/mo needed`,
              status: 'info',
              value: 60,
            },
            {
              label: 'Savings Rate',
              desc: `${
                totalIncome > 0
                  ? Math.round((netProfit / totalIncome) * 100)
                  : 0
              }% of income saved`,
              status:
                totalIncome > 0 && netProfit / totalIncome > 0.3
                  ? 'ok'
                  : 'warn',
              value:
                totalIncome > 0
                  ? Math.round((netProfit / totalIncome) * 100)
                  : 0,
            },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {m.desc}
                  </div>
                </div>
                <Badge
                  label={
                    m.status === 'high'
                      ? 'Risk'
                      : m.status === 'warn'
                      ? 'Watch'
                      : m.status === 'info'
                      ? 'Info'
                      : 'Good'
                  }
                  color={
                    m.status === 'high'
                      ? '#DC2626'
                      : m.status === 'warn'
                      ? '#D97706'
                      : m.status === 'info'
                      ? '#0284C7'
                      : '#059669'
                  }
                  bg={
                    m.status === 'high'
                      ? '#FEE2E2'
                      : m.status === 'warn'
                      ? '#FEF3C7'
                      : m.status === 'info'
                      ? '#E0F2FE'
                      : '#D1FAE5'
                  }
                />
              </div>
              <ProgressBar
                value={m.value}
                max={100}
                color={
                  m.status === 'high'
                    ? '#EF4444'
                    : m.status === 'warn'
                    ? '#F59E0B'
                    : '#10B981'
                }
              />
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            Smart Recommendations
          </div>
          {[
            {
              icon: '⚡',
              title: 'Diversify Clients',
              desc: topClient
                ? `${topClient.name} is ${dependency}% of income — add 2 more clients to reduce dependency risk.`
                : 'Add at least 2 clients to reduce dependency risk.',
              color: '#F59E0B',
            },
            {
              icon: '🛡',
              title: 'Emergency Fund',
              desc: `You need ${fmt(
                totalExpenses * 6
              )} for 6 months cover. Currently saving for it?`,
              color: '#6366F1',
            },
            {
              icon: '📊',
              title: 'Quarterly Advance Tax',
              desc: `Pay ₹${fmt(
                Math.round(taxEstimate / 4)
              )} per quarter to avoid interest under section 234B.`,
              color: '#EF4444',
            },
            {
              icon: '💹',
              title: '80C Investment',
              desc: 'Invest ₹1.5L in ELSS/PPF to save up to ₹46,800 in taxes this FY.',
              color: '#10B981',
            },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 0',
                borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${r.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {r.icon}
              </div>
              <div>
                <div
                  style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text2)',
                    lineHeight: 1.5,
                  }}
                >
                  {r.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Chat */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              AI Financial Advisor
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Powered by Claude · Knows your finances
            </div>
          </div>
        </div>

        {chatHistory.length === 0 && (
          <div>
            <div
              style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}
            >
              Ask me anything about your finances:
            </div>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="chip"
                  style={{ fontSize: 12.5 }}
                  onClick={() => ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
          {chatHistory.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 14,
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius:
                    m.role === 'user'
                      ? '12px 12px 2px 12px'
                      : '12px 12px 12px 2px',
                  background: m.role === 'user' ? '#6366F1' : 'var(--bg)',
                  border:
                    m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: '10px 14px',
                background: 'var(--bg)',
                borderRadius: '12px 12px 12px 2px',
                width: 'fit-content',
                border: '1px solid var(--border)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#6366F1',
                    animation: `pulse ${0.8 + i * 0.15}s infinite alternate`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <style>{`@keyframes pulse { from { opacity: 0.3; transform: scale(0.8); } to { opacity: 1; transform: scale(1.2); } }`}</style>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            placeholder="Ask about taxes, investments, savings..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(question)}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => ask(question)}
            disabled={loading}
          >
            {loading ? '...' : 'Ask →'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
function ProfilePage({
  user,
  onUserUpdate,
}: {
  user: User;
  onUserUpdate: (user: User) => void;
}) {
  const [profile, setProfile] = useState<Record<string, string>>({
    name: user.name,
    profession: user.profession || '',
    email: user.email,
    phone: user.phone || '',
    linkedin: user.linkedin || '',
    portfolio: user.portfolio || '',
    pan: user.pan || '',
    country: 'India',
    gst: '29ABCDE1234F1Z5',
    skills: 'React, Node.js, AWS, UI/UX',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="card" style={{ maxWidth: 680 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{profile.name}</div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>
            {profile.profession}
          </div>
          <Badge label="Pro Plan" color="#6366F1" bg="rgba(99,102,241,0.12)" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          ['name', 'Full Name'],
          ['profession', 'Profession'],
          ['email', 'Email Address'],
          ['phone', 'Phone Number'],
          ['linkedin', 'LinkedIn Profile'],
          ['portfolio', 'Portfolio URL'],
          ['pan', 'PAN Number'],
          ['country', 'Country'],
          ['skills', 'Skills'],
          ['pan', 'PAN Number'],
          ['gst', 'GST Number'],
          ['linkedin', 'LinkedIn URL'],
          ['portfolio', 'Portfolio URL'],
        ].map(([k, l]) => (
          <div key={k}>
            <label className="label">{l}</label>
            <input
              className="input"
              value={profile[k]}
              onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={saving}
          onClick={async () => {
            if (!user.id) return;
            setSaving(true);
            try {
              const updatedUser = await saveUserProfile(user.id, profile);
              sessionStorage.setItem('taxpal_user', JSON.stringify(updatedUser));
              onUserUpdate(updatedUser);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
