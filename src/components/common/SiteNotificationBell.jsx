import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export default function SiteNotificationBell({ className = '' }) {
  const navigate = useNavigate();
  const { isAdmin, currentUser, refreshAdminProfile } = useAdmin();
  const { user, isLoggedIn, refreshSession } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [notificationsOwner, setNotificationsOwner] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasOlderNotifications, setHasOlderNotifications] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [notificationError, setNotificationError] = useState('');
  const rootRef = useRef(null);
  const refreshVersionRef = useRef(0);
  const refreshNotificationsRef = useRef(null);
  const owner = isAdmin
    ? `admin:${normalizeEmail(currentUser)}`
    : isLoggedIn ? `customer:${normalizeEmail(user?.email)}` : '';
  const visibleNotifications = notificationsOwner === owner && owner ? notifications : [];

  useEffect(() => {
    if (isAdmin || isLoggedIn) {
      setNotifications([]);
      setNotificationsOwner('');
      setUnreadCount(0);
      setHasOlderNotifications(false);
      setNotificationError('');
      let active = true;
      let knownIds = null;
      let toastTimer;
      const listAction = isAdmin ? 'admin-notifications' : 'customer-notifications';
      const expectedEmail = isAdmin ? undefined : normalizeEmail(user?.email);

      const refresh = async (before) => {
        const requestVersion = ++refreshVersionRef.current;
        try {
          const result = await apiRequest(listAction, {
            query: {
              ...(isAdmin ? { expectedAdminEmail: normalizeEmail(currentUser) } : { expectedEmail }),
              ...(before ? { before } : {}),
            },
          });
          if (!active) return;
          if (requestVersion !== refreshVersionRef.current) return;
          const next = Array.isArray(result.notifications) ? result.notifications : [];
          const olderPage = Boolean(before);
          const incoming = !olderPage && knownIds && next.find((notification) => !knownIds.has(notification.id));
          knownIds = new Set([...(knownIds || []), ...next.map((notification) => notification.id)]);
          setNotifications((current) => {
            const merged = olderPage
              ? [...current, ...next.filter((notification) => !current.some((item) => item.id === notification.id))]
              : [...next, ...current.filter((notification) => !next.some((item) => item.id === notification.id))];
            return merged.sort((left, right) => Number(right.id) - Number(left.id));
          });
          setNotificationsOwner(owner);
          setUnreadCount(Number.isFinite(Number(result.unreadCount)) ? Number(result.unreadCount) : next.filter((item) => !item.read).length);
          setHasOlderNotifications(Boolean(result.hasOlder));
          setNotificationError('');
          if (incoming) {
            setToast(incoming);
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => setToast(null), 6000);
          }
        } catch (error) {
          if (!active) return;
          if (error.status === 401 || error.status === 403 || error.status === 409) {
            setNotifications([]);
            setNotificationsOwner('');
            setUnreadCount(0);
            knownIds = new Set();
            setToast(null);
            if (error.status === 409) {
              if (isAdmin) refreshAdminProfile().catch((profileError) => {
                console.error('Could not refresh admin identity after a notification account mismatch.', profileError);
              });
              else refreshSession?.().catch((sessionError) => {
                console.error('Could not refresh customer identity after a notification account mismatch.', sessionError);
              });
            }
          }
          setNotificationError(error.message || 'Notifications could not be refreshed.');
        }
      };
      const refreshWhenVisible = () => {
        if (document.visibilityState === 'visible') refresh();
      };

      refreshNotificationsRef.current = (before) => refresh(before);
      refresh();
      const intervalId = window.setInterval(() => refresh(), 15_000);
      document.addEventListener('visibilitychange', refreshWhenVisible);
      return () => {
        active = false;
        window.clearInterval(intervalId);
        document.removeEventListener('visibilitychange', refreshWhenVisible);
        window.clearTimeout(toastTimer);
        refreshNotificationsRef.current = null;
      };
    }

    refreshNotificationsRef.current = null;
    setNotifications([]);
    setNotificationsOwner('');
    setUnreadCount(0);
    setHasOlderNotifications(false);
    setNotificationError('');
    setToast(null);
    return undefined;
  }, [isAdmin, isLoggedIn, owner, user?.email]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const openNotification = async (notification) => {
    if (isAdmin || isLoggedIn) {
      refreshVersionRef.current += 1;
      try {
        await apiRequest(isAdmin ? 'admin-notifications-read' : 'customer-notifications-read', {
          method: 'POST',
          body: {
            ids: [notification.id],
            ...(isAdmin ? { expectedAdminEmail: normalizeEmail(currentUser) } : { expectedEmail: normalizeEmail(user?.email) }),
          },
        });
        setNotifications((current) => current.map((item) => (
          item.id === notification.id ? { ...item, read: true } : item
        )));
        await refreshNotificationsRef.current?.();
        setNotificationError('');
      } catch (error) {
        if (error.status === 409) {
          setNotifications([]);
          setNotificationsOwner('');
          setUnreadCount(0);
          setToast(null);
          if (isAdmin) await refreshAdminProfile().catch((profileError) => {
            console.error('Could not refresh admin identity after a notification account mismatch.', profileError);
          });
          else await refreshSession?.().catch((sessionError) => {
            console.error('Could not refresh customer identity after a notification account mismatch.', sessionError);
          });
        }
        setNotificationError(error.message || 'The notification could not be marked as read.');
        return;
      }
    }
    setOpen(false);
    setToast(null);
    if (notification.href) navigate(notification.href);
  };

  const markAllRead = async () => {
    if (isAdmin || isLoggedIn) {
      refreshVersionRef.current += 1;
      try {
        await apiRequest(isAdmin ? 'admin-notifications-read' : 'customer-notifications-read', {
          method: 'POST',
          body: {
            all: true,
            ...(isAdmin ? { expectedAdminEmail: normalizeEmail(currentUser) } : { expectedEmail: normalizeEmail(user?.email) }),
          },
        });
        setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
        setUnreadCount(0);
        await refreshNotificationsRef.current?.();
        setNotificationError('');
      } catch (error) {
        if (error.status === 409) {
          setNotifications([]);
          setNotificationsOwner('');
          setUnreadCount(0);
          setToast(null);
          if (isAdmin) await refreshAdminProfile().catch((profileError) => {
            console.error('Could not refresh admin identity after a notification account mismatch.', profileError);
          });
          else await refreshSession?.().catch((sessionError) => {
            console.error('Could not refresh customer identity after a notification account mismatch.', sessionError);
          });
        }
        setNotificationError(error.message || 'Notifications could not be marked as read.');
      }
      return;
    }
  };

  const loadOlderNotifications = async () => {
    const oldestId = visibleNotifications.reduce(
      (oldest, notification) => Math.min(oldest, Number(notification.id) || oldest),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(oldestId) || !refreshNotificationsRef.current) return;
    setLoadingOlder(true);
    try {
      await refreshNotificationsRef.current(oldestId);
    } finally {
      setLoadingOlder(false);
    }
  };

  const visibleToast = toast && visibleNotifications.some((notification) => notification.id === toast.id);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-controls="site-notification-panel"
        title="Notifications"
        className="relative flex items-center justify-center rounded-lg p-2 text-white transition hover:bg-white/10"
      >
        <Bell size={21} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-navy-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="site-notification-panel"
          aria-label="Notifications"
          className="absolute right-0 top-full z-[70] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg bg-white text-left shadow-2xl ring-1 ring-slate-200 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-primary">Notifications</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          {notificationError && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{notificationError}</p>}
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {visibleNotifications.length ? visibleNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.read ? '' : 'bg-secondary/[0.04]'}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-transparent' : 'bg-secondary'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-primary">{notification.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.summary}</span>
                  <span className="mt-1.5 block text-[10px] text-slate-400">{formatTime(notification.createdAt)}</span>
                </span>
              </button>
            )) : (
              <div className="px-5 py-8 text-center">
                <Bell size={22} className="mx-auto text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-600">No notifications yet</p>
                <p className="mt-1 text-[11px] text-slate-400">Order and delivery updates will appear here.</p>
              </div>
            )}
          </div>
          {hasOlderNotifications && visibleNotifications.length > 0 && (
            <button
              type="button"
              onClick={loadOlderNotifications}
              disabled={loadingOlder}
              className="w-full border-t border-slate-100 px-4 py-2.5 text-xs font-semibold text-secondary hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older notifications'}
            </button>
          )}
        </section>
      )}

      {visibleToast && (
        <div role="status" aria-live="polite" className="fixed right-4 top-20 z-[80] flex w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-lg bg-white p-4 text-left shadow-2xl ring-1 ring-slate-200">
          <Bell size={17} className="mt-0.5 shrink-0 text-secondary" />
          <button type="button" onClick={() => openNotification(toast)} className="min-w-0 flex-1 text-left">
            <span className="block text-xs font-bold text-primary">{toast.title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{toast.summary}</span>
          </button>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="h-fit rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}