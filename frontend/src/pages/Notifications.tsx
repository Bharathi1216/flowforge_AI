import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, RefreshCw, Terminal, MessageSquare, ShieldAlert, BadgeAlert } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const fetchNotifs = async () => {
    try {
      const data = await notificationService.getNotifications();
      // Shallow copy to force react update since service updates values in-place
      setNotifications([...data]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAsRead = async (notif: Notification) => {
    try {
      await notificationService.markAsRead(notif.id);
      await fetchNotifs(); // refresh
      
      // Navigate to relevant route
      if (notif.runId) {
        navigate(`/repositories/${notif.repoName}/workflows/${notif.runId}`);
      } else if (notif.discussionId) {
        navigate(`/repositories/${notif.repoName}/discussions`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      await fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifs = React.useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.isRead);
    }
    if (filter === 'read') {
      return notifications.filter(n => n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'failure':
        return <Terminal className="h-4.5 w-4.5 text-rose-500" />;
      case 'mention':
        return <MessageSquare className="h-4.5 w-4.5 text-blue-500" />;
      case 'assignment':
        return <BadgeAlert className="h-4.5 w-4.5 text-amber-500" />;
      default:
        return <Bell className="h-4.5 w-4.5 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">Notifications</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Stay updated with code pipeline integrations and peer workspace comments.</p>
        </div>

        {notifications.some(n => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
            filter === 'all'
              ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
            filter === 'unread'
              ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Unread ({notifications.filter(n => !n.isRead).length})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
            filter === 'read'
              ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Read
        </button>
      </div>

      {/* Notifications list */}
      {filteredNotifs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
          <Bell className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">You're all caught up</h3>
          <p className="mt-1 text-xs text-slate-500">There are no notifications matching your selected filter.</p>
        </div>
      ) : (
        <div className="card-main overflow-hidden p-0">
          <div className="divide-y divide-slate-150 dark:divide-slate-850">
            {filteredNotifs.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif)}
                className={`flex items-start gap-4 p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/15 cursor-pointer transition-colors ${
                  !notif.isRead ? 'bg-primary/5 dark:bg-primary/5 border-l-4 border-primary pl-3.5' : ''
                }`}
              >
                <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800/60 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-xs font-extrabold text-slate-950 dark:text-white">{notif.title}</h4>
                    <span className="text-[10px] text-slate-400">{notif.createdAt}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{notif.message}</p>
                  <span className="inline-block rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-500 mt-2.5">
                    {notif.repoName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
