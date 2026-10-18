import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { RoleSwitcher } from '../common/RoleSwitcher';
import { WhatsAppSimulatorModal } from '../whatsapp/WhatsAppSimulatorModal';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Bell,
  Menu,
  X,
  Building2,
  LogOut,
  Bot,
  BookUser,
  MessageSquare,
  Sliders,
} from 'lucide-react';

export const ManagerLayout: React.FC = () => {
  const { settings, unreadNotificationCount, logout, refreshAll } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true, state: { loggedOut: true, message: 'You have been logged out successfully.' } });
  };

  const navItems = [
    { to: '/manager/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/manager/ai-agent', label: 'AI Complaint Agent', icon: Bot, isNew: true },
    { to: '/manager/complaints', label: 'Complaints', icon: ClipboardList },
    { to: '/manager/contacts', label: 'Contact Directory', icon: BookUser },
    { to: '/manager/group-messages', label: 'Group Notices', icon: MessageSquare },
    { to: '/manager/workers', label: 'Workers', icon: Users },
    { to: '/manager/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/manager/integrations', label: 'AI & WhatsApp Settings', icon: Sliders },
    { to: '/manager/settings', label: 'Settings', icon: Settings },
  ];

  const getPageTitle = () => {
    const current = navItems.find((item) => location.pathname.startsWith(item.to));
    if (location.pathname.includes('/manager/notifications')) return 'Manager Notifications';
    return current ? current.label : 'Management Workspace';
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-teal-950 text-slate-100 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-teal-900/60">
          <Link to="/manager/overview" className="flex items-center gap-2.5 font-bold text-white text-base">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black">
              CC
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">Community Connect</div>
              <div className="text-[11px] text-teal-400 font-normal">Manager Workspace</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-teal-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Community Info badge */}
        <div className="p-4 border-b border-teal-900/40">
          <div className="p-2.5 rounded-lg bg-teal-900/40 border border-teal-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-teal-300 font-medium truncate">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{settings.name}</span>
            </div>
            <div className="text-[11px] text-teal-400/80 truncate mt-0.5">{settings.address}</div>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs font-semibold'
                      : 'text-teal-200 hover:bg-teal-900/60 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.isNew && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500 text-emerald-950 uppercase tracking-wider">
                    AI
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Logout Button */}
        <div className="p-3 border-t border-teal-900/60">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-teal-200 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
            aria-label="Log out of manager workspace"
          >
            <LogOut className="w-4 h-4 shrink-0 text-teal-300" />
            <span>Logout</span>
          </button>
        </div>

        {/* Sidebar Footer Notice */}
        <div className="p-4 border-t border-teal-900/40 text-[11px] text-teal-400/70">
          Simulated management portal. Changes persist to local IndexedDB.
        </div>
      </aside>

      {/* Main Content Wrap */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick WhatsApp Simulator trigger in top bar */}
            <button
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Launch WhatsApp Complaint Simulator"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Simulator</span>
            </button>

            <RoleSwitcher />
            <Link
              to="/manager/notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="View manager notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white" />
              )}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer"
              title="Sign out of Manager Workspace"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4 shrink-0 text-slate-500 hover:text-red-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Simulator Modal */}
      <WhatsAppSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => {
          setIsSimulatorOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
};
