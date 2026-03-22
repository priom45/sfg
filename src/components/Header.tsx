import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Package, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { dropdownVariants } from '../lib/animations';

export default function Header() {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = location.pathname.startsWith('/admin');
  const isChef = location.pathname.startsWith('/chef');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isAdmin || isChef) return null;

  async function handleSignOut() {
    await signOut();
    setProfileOpen(false);
    navigate('/');
  }

  const displayName = profile?.full_name || profile?.email || user?.email || 'User';
  const displayPhone = profile?.phone || '';
  const displayEmail = profile?.email || user?.email || '';

  return (
    <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border">
      <div className="section-padding">
        <div className="flex items-center gap-3 h-[60px] lg:h-[68px]">
          <Link to="/" className="flex-shrink-0" aria-label="The Supreme Waffle home">
            <img
              src="https://res.cloudinary.com/dlkovvlud/image/upload/v1771590689/Screenshot_2026-02-20_175222-removebg-preview_ufalk6.png"
              alt="The Supreme Waffle - Premium Gourmet Waffles"
              fetchPriority="high"
              className="h-10 sm:h-12 lg:h-14 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.15)]"
            />
          </Link>

          <Link
            to="/menu"
            aria-label="Open menu search"
            className="flex-1 flex items-center gap-3 bg-brand-surface border border-brand-border rounded-xl px-4 py-3 hover:border-brand-border-strong transition-all group"
          >
            <Search size={18} className="text-brand-gold flex-shrink-0" strokeWidth={2.5} />
            <span className="text-[15px] font-medium text-brand-text-dim group-hover:text-brand-text-muted transition-colors">
              Search waffles...
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="hidden sm:flex items-center gap-2 text-[14px] font-semibold text-brand-text-muted hover:text-white px-3 py-2.5 rounded-xl hover:bg-brand-surface-light transition-all"
                >
                  <div className="w-9 h-9 bg-brand-gold/10 rounded-full flex items-center justify-center border border-brand-gold/20">
                    <User size={16} className="text-brand-gold" strokeWidth={2.5} />
                  </div>
                  <span className="max-w-[80px] truncate hidden lg:inline">{displayName}</span>
                  <ChevronDown size={14} className={`text-brand-text-dim transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 top-full mt-2 w-56 bg-brand-surface rounded-xl border border-brand-border shadow-elevated py-1.5 z-50"
                      style={{ transformOrigin: 'top right' }}
                    >
                      <div className="px-4 py-3 border-b border-brand-border">
                        <p className="font-bold text-[15px] text-white truncate">{displayName}</p>
                        {displayEmail && <p className="text-[13px] font-medium text-brand-text-dim truncate mt-0.5">{displayEmail}</p>}
                        {displayPhone && <p className="text-[12px] font-medium text-brand-text-dim truncate mt-0.5">Phone: {displayPhone}</p>}
                      </div>
                      <Link
                        to="/my-orders"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-brand-text-muted hover:text-white hover:bg-brand-surface-light/70 transition-colors"
                      >
                        <Package size={16} strokeWidth={2.2} />
                        My Orders
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-brand-text-muted hover:text-white hover:bg-brand-surface-light/70 transition-colors"
                      >
                        <LogOut size={16} strokeWidth={2.2} />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/auth"
                state={{ from: location.pathname }}
                className="hidden sm:flex items-center gap-1.5 text-[14px] font-bold text-brand-gold hover:text-brand-gold-soft transition-colors px-3 py-2.5"
              >
                <User size={16} strokeWidth={2.5} />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
