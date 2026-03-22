import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, LogOut, Package, ChevronRight, Shield, Pencil, Check, X, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name || '');
  const [emailVal, setEmailVal] = useState(profile?.email || '');
  const [saving, setSaving] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: name.trim(),
      email: emailVal.trim(),
    }).eq('id', user.id);

    if (error) {
      showToast('Failed to update profile', 'error');
    } else {
      await refreshProfile();
      showToast('Profile updated!');
      setEditing(false);
    }
    setSaving(false);
  }

  if (!user || !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-brand-bg">
        <div className="w-20 h-20 bg-brand-surface rounded-full flex items-center justify-center mb-5">
          <User size={32} className="text-brand-text-dim" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1.5">Sign in to your account</h2>
        <p className="text-brand-text-muted text-[14px] mb-6 text-center">View your profile, track orders, and more</p>
        <Link to="/auth" className="btn-primary">Sign In</Link>
      </div>
    );
  }

  const initial = (profile.full_name || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24 animate-fade-in">
        <h1 className="text-xl font-extrabold text-white mb-5">Profile</h1>

        <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-black text-brand-gold">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              {!editing ? (
                <>
                  <h2 className="text-[16px] font-bold text-white truncate">{profile.full_name || 'No name set'}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} className="text-brand-text-dim" />
                    <span className="text-[13px] text-brand-text-dim">{profile.phone || 'No phone added yet'}</span>
                  </div>
                  {profile.email && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail size={12} className="text-brand-text-dim" />
                      <span className="text-[13px] text-brand-text-dim">{profile.email}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="input-field text-[14px] py-2"
                  />
                  <input
                    type="email"
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                    placeholder="Email (optional)"
                    className="input-field text-[14px] py-2"
                  />
                  <div className="flex items-center gap-1.5 px-1">
                    <Phone size={12} className="text-brand-text-dim" />
                    <span className="text-[12px] text-brand-text-dim">{profile.phone || 'Add phone during checkout or later'}</span>
                  </div>
                </div>
              )}
            </div>
            {!editing ? (
              <button
                onClick={() => {
                  setName(profile.full_name || '');
                  setEmailVal(profile.email || '');
                  setEditing(true);
                }}
                className="p-2 rounded-lg text-brand-text-dim hover:text-brand-gold hover:bg-brand-gold/10 transition-colors flex-shrink-0"
              >
                <Pencil size={16} />
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="p-2 rounded-lg bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="p-2 rounded-lg text-brand-text-dim hover:bg-brand-surface-light/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <Link
            to="/my-orders"
            className="flex items-center justify-between bg-brand-surface rounded-xl px-4 py-3.5 border border-brand-border transition-all active:scale-[0.98] hover:border-brand-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                <Package size={18} className="text-brand-gold" />
              </div>
              <div>
                <span className="text-[14px] font-semibold text-white block">My Orders</span>
                <span className="text-[12px] text-brand-text-dim">View order history & track active orders</span>
              </div>
            </div>
            <ChevronRight size={18} className="text-brand-text-dim" />
          </Link>

          <Link
            to="/about"
            className="flex items-center justify-between bg-brand-surface rounded-xl px-4 py-3.5 border border-brand-border transition-all active:scale-[0.98] hover:border-brand-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-surface-light flex items-center justify-center">
                <Shield size={18} className="text-brand-text-muted" />
              </div>
              <div>
                <span className="text-[14px] font-semibold text-white block">About</span>
                <span className="text-[12px] text-brand-text-dim">About The Supreme Waffle</span>
              </div>
            </div>
            <ChevronRight size={18} className="text-brand-text-dim" />
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-red-500/20 bg-red-500/5 text-red-400 font-bold text-[14px] hover:bg-red-500/10 transition-all active:scale-[0.98]"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
