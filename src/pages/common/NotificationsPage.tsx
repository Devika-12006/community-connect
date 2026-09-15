import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  CheckCheck,
  Calendar,
  ExternalLink,
  Info,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    currentRole,
    activeResident,
    activeWorker,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();
  const navigate = useNavigate();

  const handleNotificationClick = async (notif: { id: string; complaintId?: string; readAt?: string }) => {
    if (!notif.readAt) {
      await markNotificationRead(notif.id);
    }
    if (notif.complaintId) {
      if (currentRole === 'Resident') {
        navigate(`/resident/complaints/${notif.complaintId}`);
      } else if (currentRole === 'Manager') {
        navigate(`/manager/complaints?selected=${notif.complaintId}`);
      } else if (currentRole === 'Worker') {
        navigate(`/worker/tasks/${notif.complaintId}`);
      }
    }
  };

  const getActorLabel = () => {
    if (currentRole === 'Resident') {
      return activeResident ? `Resident: ${activeResident.displayName}` : 'Resident';
    }
    if (currentRole === 'Worker') {
      return activeWorker ? `Worker: ${activeWorker.name}` : 'Worker';
    }
    return 'Community Manager';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Notifications</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Inbox for {getActorLabel()} • Local in-app alerts and updates
          </p>
        </div>

        {notifications.some((n) => !n.readAt) && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead()}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-teal-700" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">No notifications yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You will receive instant alerts here whenever tickets are submitted, assigned, updated, or completed.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const isUnread = !notif.readAt;
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isUnread
                    ? 'bg-teal-50/40 border-teal-300 shadow-xs ring-1 ring-teal-200/50'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-teal-700 shrink-0" />
                    )}
                    <h3 className={`text-xs sm:text-sm font-bold truncate ${isUnread ? 'text-teal-950' : 'text-slate-900'}`}>
                      {notif.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>
                      {new Date(notif.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    {notif.complaintId && (
                      <span className="text-teal-800 font-semibold flex items-center gap-1 ml-2">
                        <span>View Ticket</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markNotificationRead(notif.id);
                      }}
                      className="text-[11px] font-bold text-teal-800 hover:text-teal-950 bg-teal-100/80 px-2.5 py-1 rounded-lg"
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Read</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Honest Prototype Notice */}
      <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-700">Demonstration Scope:</span> In-app notifications run entirely within this local browser session. This prototype does not claim or simulate external SMS, push, email, or WhatsApp dispatch.
        </div>
      </div>
    </div>
  );
};
