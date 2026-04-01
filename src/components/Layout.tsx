import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Package, FileText, Settings, LogOut, Menu, X, Bell, Search, User as UserIcon, Disc } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, role: 'customer' },
  { name: 'Clientes', path: '/customers', icon: Users, role: 'sales' },
  { name: 'Catálogo', path: '/items', icon: Package, role: 'sales' },
  { name: 'Orçamentos', path: '/quotes', icon: FileText, role: 'customer' },
  { name: 'Configurações', path: '/settings', icon: Settings, role: 'admin' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, isSales, isManager, isAdmin, isTechnician, isCustomer } = useFirebase();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const checkRole = (itemRole: string) => {
    if (itemRole === 'admin') return isAdmin;
    if (itemRole === 'manager') return isManager;
    if (itemRole === 'sales') return isSales || isTechnician;
    if (itemRole === 'customer') return isCustomer || isSales || isTechnician;
    return true;
  };

  const activeItem = navItems.find((item) => item.path === location.pathname);

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-[#1A1A1A]">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="relative flex flex-col border-r border-[#E5E7EB] bg-martins-blue shadow-sm"
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-white shadow-lg">
              <Disc className="h-7 w-7 animate-spin-slow" />
            </div>
            {isSidebarOpen && (
              <span className="text-2xl font-black tracking-tighter text-[#111827]">MARTINS</span>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {navItems.map((item) => {
            if (!checkRole(item.role)) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-200",
                  isActive
                    ? "bg-[#111827] text-white shadow-lg shadow-black/10"
                    : "text-[#111827]/70 hover:bg-white/50 hover:text-[#111827]"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-[#111827]/50")} />
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E5E7EB] p-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {isSidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-white px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-lg p-2 hover:bg-[#F3F4F6]"
            >
              <Menu className="h-5 w-5 text-[#6B7280]" />
            </button>
            <h1 className="text-lg font-semibold text-[#111827]">
              {activeItem?.name || 'Página'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Buscar..."
                className="h-9 w-64 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>
            <button className="relative rounded-lg p-2 hover:bg-[#F3F4F6]">
              <Bell className="h-5 w-5 text-[#6B7280]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#EF4444] border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-[#E5E7EB] mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-[#111827]">{profile?.displayName}</p>
                <p className="text-xs text-[#6B7280] capitalize">{profile?.role}</p>
              </div>
              <img
                src={profile?.photoURL || 'https://picsum.photos/seed/user/40/40'}
                alt="Avatar"
                className="h-9 w-9 rounded-full border border-[#E5E7EB] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
