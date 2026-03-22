import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ChefHat, Loader2, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ChefLogin() {
  const [email, setEmail] = useState('chef@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, signInStaff } = useAuth();

  useEffect(() => {
    if (profile && (profile.role === 'chef' || profile.role === 'admin')) {
      navigate('/chef', { replace: true });
    }
  }, [profile, navigate]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (normalizedEmail() !== 'chef@gmail.com') {
      setError('Only chef@gmail.com can access the kitchen portal.');
      return;
    }

    setLoading(true);
    const { error: loginError, role } = await signInStaff(normalizedEmail(), password);
    setLoading(false);

    if (loginError) {
      setError(loginError);
      return;
    }

    if (role !== 'chef') {
      setError('Access denied. Chef account required.');
      return;
    }

    navigate('/chef', { replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ChefHat size={40} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Kitchen Login</h1>
          <p className="text-brand-text-dim text-sm mt-1.5">The Supreme Waffle - Chef Portal</p>
        </div>

        <div className="animate-fade-in">
          <form onSubmit={handleDirectLogin} className="bg-brand-surface rounded-2xl p-6 border border-brand-border space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20 font-medium">{error}</div>
            )}
            <div>
              <label className="block text-[13px] font-semibold text-brand-text-dim mb-1.5">Chef Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim" />
                <input
                  type="email"
                  placeholder="chef@gmail.com"
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
                  placeholder="Enter chef password"
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
              className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
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
          Direct access is restricted to chef@gmail.com
        </p>
      </div>
    </div>
  );
}
