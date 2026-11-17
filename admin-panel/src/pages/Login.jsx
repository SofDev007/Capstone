import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, errorMessage } from '../lib/api';
import { Field } from '../components/ui/dialog';
import { motion } from 'motion/react';
import { StageStrip, RouteBadge } from '../components/ticket';
import { Aurora } from '../components/Layout';
import { stocks } from '@shared/theme/tokens.js';

const DEMO_STOPS = ['Mhow Naka', 'Ranjit Hanuman', 'Sethi Gate', 'Footi Kothi', 'Hawa Bangla', 'CAT'].map((name, i) => ({ id: String(i), name }));

export default function Login({ setIsAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setIsAuthenticated(true);
      navigate('/');
    } catch (err) {
      setError(err.response?.status === 401 ? 'That email and password don’t match an admin account.' : errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid place-items-center p-6 bg-deep overflow-hidden">
      <Aurora />
      <motion.form onSubmit={handleSubmit} noValidate
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative w-full max-w-[420px] p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-8">
          <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
            <path fill="#EAF0FF" d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v6a3 3 0 0 0 0 6v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 0 0-6z" />
            <circle cx="21" cy="16" r="3.2" fill="#04060C" />
            <path stroke="#04060C" strokeWidth="2.4" strokeLinecap="round" d="M9 11h7M9 16h5M9 21h7" />
          </svg>
          <span className="font-bold text-[20px]">Depot</span>
          <span className="ml-auto serial text-neon-lime flex items-center gap-1.5"><span className="live-dot" /> Control room</span>
        </div>

        <h1 className="text-[28px] font-bold leading-tight">Sign in to the depot</h1>
        <p className="text-ink-soft mt-1 mb-6">Every bus, every stop, every alert, as it happens. Admin accounts are created by your system administrator.</p>

        <div className="glass-card p-4 mb-7" aria-hidden="true">
          <div className="flex items-center justify-between mb-3">
            <RouteBadge route={{ number: '1', color: stocks.mint.ink }} size="sm" />
            <span className="stamp" style={{ color: '#B6FF5C' }}>Live</span>
          </div>
          <StageStrip stops={DEMO_STOPS} nextIndex={3} route={{ color: stocks.mint.ink }} showLabels />
        </div>

        {error && (
          <div role="alert" className="mb-5 p-3 rounded-[12px] bg-signal-stock border border-signal/50 text-ink font-medium text-[14.5px]">{error}</div>
        )}

          <div className="space-y-4">
            <Field label="Email">
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label="Password">
              <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </div>

        <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading || !email || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-[12px] text-ink-faint mt-6 text-center">Map data © OpenStreetMap contributors</p>
      </motion.form>
    </div>
  );
}
