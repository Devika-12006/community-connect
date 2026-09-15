import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { RoleSwitcher } from '../common/RoleSwitcher';
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
} from 'lucide-react';

export const ManagerLayout: React.FC = () => {
  const { settings, unreadNotificationCount } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/manager/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/manager/complaints', label: 'Complaints', icon: ClipboardList },
    { to: '/manager/workers', label: 'Workers', icon: Users },
    { to: '/manager/reports', label: 'Reports & Analytics', icon: BarChart3 },
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs font-semibold'
                      : 'text-teal-200 hover:bg-teal-900/60 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

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

          <div className="flex items-center gap-3">
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
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
