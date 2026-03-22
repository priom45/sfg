import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, Loader2, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, signInStaff } = useAuth();

  useEffect(() => {
    if (profile?.role === 'admin') navigate('/admin', { replace: true });
  }, [profile, navigate]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (normalizedEmail() !== 'admin@gmail.com') {
      setError('Only admin@gmail.com can access the admin portal.');
      return;
    }

    setLoading(true);
    const { error: loginError, role } = await signInStaff(normalizedEmail(), password);
    setLoading(false);

    if (loginError) {
      setError(loginError);
      return;
    }

    if (role !== 'admin') {
      setError('Access denied. Admin account required.');
      return;
    }

    navigate('/admin', { replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border border-brand-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Shield size={40} className="text-brand-gold" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Admin Login</h1>
          <p className="text-brand-text-dim text-sm mt-1.5">The Supreme Waffle Dashboard</p>
        </div>

        <div className="animate-fade-in">
          <form onSubmit={handleDirectLogin} className="bg-brand-surface rounded-2xl p-6 border border-brand-border space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20 font-medium">{error}</div>
            )}
            <div>
              <label className="block text-[13px] font-semibold text-brand-text-dim mb-1.5">Admin Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim" />
                <input
                  type="email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-brand-text-dim mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim" />
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !normalizedEmail() || !password}
              className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all bg-brand-gold text-brand-bg hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-brand-text-dim mt-6">
          Direct access is restricted to admin@gmail.com
        </p>
      </div>
    </div>
  );
}
