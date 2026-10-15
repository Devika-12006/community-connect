import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { RoleSwitcher } from '../common/RoleSwitcher';
import {
  Wrench,
  CheckCircle2,
  Bell,
  User,
  LogOut,
} from 'lucide-react';

export const WorkerLayout: React.FC = () => {
  const { activeWorker, unreadNotificationCount, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true, state: { loggedOut: true, message: 'You have been logged out successfully.' } });
  };

  const navItems = [
    { to: '/worker/tasks', label: 'My Tasks', icon: Wrench },
    { to: '/worker/completed', label: 'Completed Work', icon: CheckCircle2 },
    {
      to: '/worker/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
    },
    { to: '/worker/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/worker/tasks" className="flex items-center gap-2 text-amber-700 font-bold text-base sm:text-lg">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black shadow-xs">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline font-extrabold text-slate-900">Worker Portal</span>
            </Link>
            {activeWorker && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 text-xs font-semibold border border-amber-200">
                <span>{activeWorker.name}</span>
                <span className="text-amber-700/80 font-normal">({activeWorker.specialty})</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <RoleSwitcher />
            <Link
              to="/worker/notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="View worker notifications"
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
              title="Sign out of Worker Portal"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4 shrink-0 text-slate-500 hover:text-red-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:block border-t border-slate-100 bg-slate-50/75">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-amber-600 text-amber-900 bg-white font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around h-16 px-2 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors relative ${
                  isActive ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 rounded-full text-[9px] font-bold bg-red-600 text-white min-w-[14px] text-center leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
