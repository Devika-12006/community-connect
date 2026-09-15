import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { RoleSwitcher } from '../common/RoleSwitcher';
import {
  LayoutDashboard,
  PlusCircle,
  ListOrdered,
  MapPin,
  Bell,
  User,
  Building2,
} from 'lucide-react';

export const ResidentLayout: React.FC = () => {
  const { settings, unreadNotificationCount } = useApp();

  const navItems = [
    { to: '/resident/home', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/resident/report', label: 'Report Issue', icon: PlusCircle },
    { to: '/resident/complaints', label: 'My Complaints', icon: ListOrdered },
    { to: '/resident/map', label: 'Community Map', icon: MapPin },
    {
      to: '/resident/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
    },
    { to: '/resident/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 pb-20 md:pb-0">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/resident/home" className="flex items-center gap-2.5 text-teal-800 font-bold text-base sm:text-lg">
              <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center font-black shadow-xs">
                CC
              </div>
              <span className="hidden sm:inline tracking-tight font-extrabold text-teal-900">Community Connect</span>
            </Link>
            {settings && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 text-teal-900 text-xs font-medium border border-teal-100">
                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                <span>{settings.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <Link
              to="/resident/notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white" />
              )}
            </Link>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:block border-t border-slate-100 bg-slate-50/75">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-teal-700 text-teal-900 bg-white font-semibold'
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
                `flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors relative ${
                  isActive ? 'text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-800'
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
              <span className="truncate max-w-[56px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
