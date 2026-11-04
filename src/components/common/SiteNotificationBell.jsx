import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import {
  markAllSiteNotificationsRead,
  markSiteNotificationRead,
  readSiteNotifications,
} from '../../utils/siteNotifications';

const notificationEvent = 'suvarna:site-notifications';
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function SiteNotificationBell({ className = '' }) {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { user, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState(readSiteNotifications);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const rootRef = useRef(null);
  const email = normalizeEmail(user?.email);

  const visibleNotifications = notifications.filter((notification) => (
    isAdmin
      ? notification.audience === 'admin'
      : isLoggedIn && notification.audience === 'customer' && normalizeEmail(notification.recipientEmail) === email
  ));
  const unreadCount = visibleNotifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    let knownIds = new Set(readSiteNotifications().map((notification) => notification.id));
    let toastTimer;

    const refresh = () => {
      const next = readSiteNotifications();
      const incoming = next.find((notification) => (
        !knownIds.has(notification.id)
        && (isAdmin
          ? notification.audience === 'admin'
          : isLoggedIn && notification.audience === 'customer' && normalizeEmail(notification.recipientEmail) === email)
      ));
      knownIds = new Set(next.map((notification) => notification.id));
      setNotifications(next);

      if (incoming) {
        setToast(incoming);
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => setToast(null), 6000);
      }
    };
    const onStorage = (event) => {
      if (event.key === 'suvarna_site_notifications' || event.key === null) refresh();
    };

    window.addEventListener(notificationEvent, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(notificationEvent, refresh);
      window.removeEventListener('storage', onStorage);
      window.clearTimeout(toastTimer);
    };
  }, [email, isAdmin, isLoggedIn]);

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

  const openNotification = (notification) => {
    markSiteNotificationRead(notification.id);
    setOpen(false);
    setToast(null);
    if (notification.href) navigate(notification.href);
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
                onClick={() => markAllSiteNotificationsRead(visibleNotifications.map((notification) => notification.id))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
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