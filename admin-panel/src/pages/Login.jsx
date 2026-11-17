import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, errorMessage } from '../lib/api';
import { Field } from '../components/ui/dialog';
import { StageStrip } from '../components/ticket';
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
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* The ticket rack: what this console runs */}
      <section className="hidden lg:flex flex-col justify-between bg-ink text-counterfoil p-12">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
            <path fill="#FBFBF8" d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v6a3 3 0 0 0 0 6v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 0 0-6z" />
            <circle cx="21" cy="16" r="3.2" fill="#16213E" />
            <path stroke="#16213E" strokeWidth="2.4" strokeLinecap="round" d="M9 11h7M9 16h5M9 21h7" />
          </svg>
          <span className="font-bold text-[20px]">Depot</span>
        </div>

        <div className="max-w-[520px]">
          <h1 className="text-[44px] font-bold leading-[1.05]">Every bus, every stop, every alert — as it happens.</h1>
          <p className="text-counterfoil/75 mt-4 text-[17px] max-w-[46ch]">
            Live positions from the drivers’ own phones, arrival times for every stop, and SOS alerts from drivers and passengers, routed here in seconds.
          </p>
          <div className="mt-12 rounded-md bg-counterfoil text-ink p-5 rotate-[-1.5deg] shadow-lifted max-w-[440px]" aria-hidden="true">
            <div className="flex items-center justify-between mb-4">
              <span className="num text-[30px] px-2 rounded-sm" style={{ background: stocks.mint.stock, color: stocks.mint.ink }}>1</span>
              <span className="stamp stamp-land" style={{ color: stocks.mint.ink }}>Live</span>
            </div>
            <StageStrip stops={DEMO_STOPS} nextIndex={3} route={{ color: stocks.mint.ink }} showLabels />
          </div>
        </div>

        <p className="text-[13px] text-counterfoil/50">Map data © OpenStreetMap contributors</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-[380px] rise-in" noValidate>
          <h2 className="text-[28px] font-bold">Sign in to the depot</h2>
          <p className="text-ink-soft mt-1 mb-8">Admin accounts are created by your system administrator.</p>

          {error && (
            <div role="alert" className="mb-5 p-3 rounded-md bg-signal-stock text-signal font-medium text-[14.5px]">{error}</div>
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
        </form>
      </section>
    </div>
  );
}
