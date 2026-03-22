import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, MapPin, Tag, LogOut, MessageCircle, Power } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Orders', end: false },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Menu', end: false },
  { to: '/admin/zones', icon: MapPin, label: 'Zones', end: false },
  { to: '/admin/offers', icon: Tag, label: 'Offers', end: false },
  { to: '/admin/messages', icon: MessageCircle, label: 'Messages', end: false },
  { to: '/admin/website', icon: Power, label: 'Website', end: false },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login');
  }

  return (
    <div className="min-h-screen bg-brand-bg flex">
      <aside className="hidden lg:flex flex-col w-56 bg-brand-bg text-white fixed inset-y-0 left-0">
        <div className="p-5 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-gold rounded-lg flex items-center justify-center">
              <span className="text-brand-bg font-black text-xs">SW</span>
            </div>
            <div>
              <span className="font-bold text-sm leading-none">Supreme Waffle</span>
              <span className="block text-brand-text-dim text-[10px]">Admin Panel</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-gold/10 text-brand-gold' : 'text-brand-text-dim hover:text-brand-gold hover:bg-brand-surface-light/60'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-brand-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text-dim hover:text-brand-gold hover:bg-brand-surface-light/60 w-full transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:ml-56 flex-1 flex flex-col">
        <header className="lg:hidden bg-brand-surface border-b border-brand-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-gold rounded-lg flex items-center justify-center">
                <span className="text-brand-bg font-black text-xs">SW</span>
              </div>
              <span className="font-bold text-sm text-white">Admin</span>
            </div>
            <button onClick={handleSignOut} className="text-brand-text-dim hover:text-brand-gold">
              <LogOut size={18} />
            </button>
          </div>
          <nav className="flex gap-1 mt-3 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive ? 'bg-brand-gold text-brand-bg' : 'bg-brand-surface-light text-brand-text-dim'
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
