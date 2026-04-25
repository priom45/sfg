import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, Package, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { dropdownVariants } from '../lib/animations';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/offers', label: 'Offers' },
  { to: '/track', label: 'Track Order' },
  { to: '/about', label: 'About' },
];

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

  function isActiveNavItem(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <header className="sticky top-0 z-50 pt-3">
      <div className="section-padding">
        <div className="gloss-shell glow-border flex h-[60px] items-center justify-between gap-3 rounded-[24px] px-4 sm:px-5 lg:h-[72px]">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link
              to="/"
              className="flex flex-shrink-0 items-center rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02]"
              aria-label="The Supreme Waffle home"
            >
              <img
                src="https://res.cloudinary.com/dlkovvlud/image/upload/v1771590689/Screenshot_2026-02-20_175222-removebg-preview_ufalk6.png"
                alt="The Supreme Waffle - Premium Gourmet Waffles"
                fetchPriority="high"
                className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.15)] sm:h-12 lg:h-14"
              />
            </Link>

            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:flex">
              {navItems.map((item) => {
                const active = isActiveNavItem(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                      active
                        ? 'bg-[linear-gradient(135deg,#F0D487_0%,#D8B24E_58%,#B88629_100%)] text-brand-bg shadow-[0_12px_26px_rgba(216,178,78,0.22),inset_0_1px_0_rgba(255,255,255,0.32)]'
                        : 'text-brand-text-muted hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="hidden items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] font-semibold text-brand-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-0.5 hover:border-brand-gold/25 hover:text-white sm:flex"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gold/25 bg-brand-gold/10 shadow-[0_0_24px_rgba(216,178,78,0.1)]">
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
                      className="gloss-shell absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl py-1.5 shadow-elevated"
                      style={{ transformOrigin: 'top right' }}
                    >
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="font-bold text-[15px] text-white truncate">{displayName}</p>
                        {displayEmail && <p className="text-[13px] font-medium text-brand-text-dim truncate mt-0.5">{displayEmail}</p>}
                        {displayPhone && <p className="text-[12px] font-medium text-brand-text-dim truncate mt-0.5">Phone: {displayPhone}</p>}
                      </div>
                      <Link
                        to="/my-orders"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-brand-text-muted transition-colors hover:bg-white/[0.05] hover:text-white"
                      >
                        <Package size={16} strokeWidth={2.2} />
                        My Orders
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-3 text-[14px] font-semibold text-brand-text-muted transition-colors hover:bg-white/[0.05] hover:text-white"
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
                className="hidden items-center gap-1.5 rounded-[18px] border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-[14px] font-bold text-brand-gold shadow-[0_12px_28px_rgba(216,178,78,0.08),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:border-brand-gold/55 hover:bg-brand-gold/15 hover:text-brand-gold-soft sm:flex"
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
