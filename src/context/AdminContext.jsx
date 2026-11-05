import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { products as seedProducts } from '../data/products';
import { heroSlides as seedBanners, promoCards as seedPromoCards } from '../data/banners';
import { defaultPolicies } from '../data/policies';
import { addSiteNotification } from '../utils/siteNotifications';
import { apiRequest } from '../utils/api';
import { isPublishableProduct } from '../utils/productQuality';

const AdminContext = createContext(null);
const STORAGE_KEY = 'suvarna_admin_store';
const SESSION_KEY = 'suvarna_admin_user';
const SHARED_DATA_KEYS = ['products', 'banners', 'promoCards', 'offers', 'videos', 'orders', 'enquiries', 'settings', 'policies'];

export const MASTER_ADMIN = 'enterprisessuvarnait@gmail.com';
const LEGACY_MASTER_ADMIN = 'ravillanaveen1996@gmail.com';

export const ADMIN_PERMISSIONS = [
  { id: 'categories', label: 'Manage Categories' },
  { id: 'products', label: 'Manage Products' },
  { id: 'banners', label: 'Manage Banners / Sliders' },
  { id: 'promo-cards', label: 'Manage Promo Cards' },
  { id: 'videos', label: 'Manage Videos' },
  { id: 'orders', label: 'Manage Orders' },
  { id: 'customers', label: 'Manage Customers' },
  { id: 'enquiries', label: 'Manage Enquiries' },
  { id: 'offers', label: 'Manage Offers' },
  { id: 'settings', label: 'Manage Settings' },
  { id: 'policies', label: 'Manage Policies' },
];

export const ALL_ADMIN_PERMISSIONS = ADMIN_PERMISSIONS.map((permission) => permission.id);

const seedOffers = [
  {
    id: 1,
    title: 'Festive Laptop Sale',
    description: 'Up to 20% off on business laptops',
    discount: '20%',
    category: 'laptops',
    active: true,
  },
  {
    id: 2,
    title: 'CCTV Combo Deal',
    description: 'Free installation on 4-channel CCTV kits',
    discount: 'Free Install',
    category: 'cctv',
    active: true,
  },
];

const seedCustomers = [
  {
    id: 1,
    name: 'Rahul Mehta',
    email: 'rahul.mehta@example.com',
    phone: '+91 98123 45670',
    orders: 3,
    joined: '2026-05-12',
  },
  {
    id: 2,
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 99456 78123',
    orders: 1,
    joined: '2026-06-28',
  },
  {
    id: 3,
    name: 'Anand Kumar',
    email: 'anand.kumar@example.com',
    phone: '+91 90876 54321',
    orders: 5,
    joined: '2026-03-15',
  },
];

const seedVideos = [
  {
    id: 1,
    title: 'Dell Latitude 5440 Unboxing & Review',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'laptops',
    active: true,
  },
];

const defaultSettings = {
  storeName: 'Suvarna IT Enterprises',
  email: 'sales@suvarnait.com',
  phone: '+91 99664 47099',
  whatsapp: '919966447099',
  address: 'Shop #179, C Block, 1st Floor, beside Parklane Hotel, upstairs of Golden Dragon Restaurant, Kalasiguda, Secunderabad, Telangana 500003',
  announcement: '',
};

const seedStore = () => ({
  admins: [{
    email: MASTER_ADMIN,
    name: 'Master Admin',
    addedAt: '2026-01-01',
    master: true,
    role: 'Master Admin',
    permissions: ALL_ADMIN_PERMISSIONS,
    password: '',
    status: 'Active',
  }],
  products: seedProducts,
  banners: seedBanners,
  promoCards: seedPromoCards,
  offers: seedOffers,
  videos: seedVideos,
  orders: [],
  customers: seedCustomers,
  enquiries: [],
  settings: defaultSettings,
  policies: defaultPolicies,
});

const loadStore = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const base = saved ? JSON.parse(saved) : seedStore();
    const admins = (base.admins || []).map((admin) => ({
      ...admin,
      email: admin.master ? MASTER_ADMIN : admin.email,
      name: admin.name || admin.email.split('@')[0],
      role: admin.master ? 'Master Admin' : admin.role || 'Editor',
      permissions: admin.master ? ALL_ADMIN_PERMISSIONS : admin.permissions || ['products', 'offers'],
      password: admin.master ? '' : admin.password || '',
      status: admin.master ? 'Active' : admin.status || 'Invited',
    }));

    return {
      ...seedStore(),
      ...base,
      admins,
      products: Array.isArray(base.products) ? base.products : seedStore().products,
      banners: dedupeBanners(Array.isArray(base.banners) ? base.banners : seedStore().banners),
      promoCards: Array.isArray(base.promoCards) ? base.promoCards : seedPromoCards,
      offers: Array.isArray(base.offers) ? base.offers : seedStore().offers,
      videos: Array.isArray(base.videos) ? base.videos : seedStore().videos,
      orders: Array.isArray(base.orders) ? base.orders : [],
      customers: Array.isArray(base.customers) ? base.customers : seedCustomers,
      enquiries: Array.isArray(base.enquiries) ? base.enquiries : [],
      settings: { ...seedStore().settings, ...(base.settings || {}) },
      policies: { ...defaultPolicies, ...(base.policies || {}) },
    };
  } catch {
    return seedStore();
  }
};

const nextId = (list) =>
  list.length ? Math.max(...list.map((i) => Number(i.id) || 0)) + 1 : 1;

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const dedupeBanners = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    const key = item.id ? `id:${item.id}` : `title:${item.title || ''}|link:${item.link || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const syncCustomerOrderCounts = (customers = [], orders = []) =>
  customers.map((customer) => ({
    ...customer,
    orders: orders.filter((order) => normalizeEmail(order.email) === normalizeEmail(customer.email)).length,
  }));

const getSharedData = (store) =>
  Object.fromEntries(SHARED_DATA_KEYS.map((key) => [key, store[key]]));

const mergeSharedData = (store, data) => {
  const shared = Object.fromEntries(
    SHARED_DATA_KEYS
      .filter((key) => data && Object.prototype.hasOwnProperty.call(data, key))
      .map((key) => [key, data[key]])
  );
  const sharedSettings = shared.settings;
  if (sharedSettings) {
    const phoneDigits = String(sharedSettings.phone || '').replace(/\D/g, '');
    const whatsappDigits = String(sharedSettings.whatsapp || '').replace(/\D/g, '');
    const address = String(sharedSettings.address || '');
    shared.settings = {
      ...store.settings,
      ...sharedSettings,
      ...(phoneDigits === '919182301422' || phoneDigits === '9182301422'
        ? { phone: defaultSettings.phone }
        : {}),
      ...(whatsappDigits === '919182301422'
        ? { whatsapp: defaultSettings.whatsapp }
        : {}),
      ...(/beaide|secundrabad/i.test(address)
        ? { address: defaultSettings.address }
        : {}),
    };
  }
  return { ...store, ...shared };
};

const persistStore = (storeSnapshot) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storeSnapshot));
  } catch {
    /* storage unavailable */
  }
};

export function AdminProvider({ children }) {
  const [store, setStore] = useState(loadStore);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [sharedStoreReady, setSharedStoreReady] = useState(false);
  const [sharedStoreError, setSharedStoreError] = useState('');
  const lastSharedDataRef = useRef('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem(SESSION_KEY);
      return normalizeEmail(savedUser) === LEGACY_MASTER_ADMIN ? MASTER_ADMIN : savedUser || null;
    } catch {
      return null;
    }
  });

  const login = async (email, password) => {
    const clean = email.trim().toLowerCase();
    const admin = store.admins.find((item) => item.email === clean);
    if (!admin) return { ok: false, error: 'This email does not have admin access.' };
    if (admin.status !== 'Active') return { ok: false, error: 'Complete the invitation setup before logging in.' };
    try {
      await apiRequest('admin-login', { method: 'POST', body: { email: clean, password } });
    } catch (error) {
      return { ok: false, error: error.message };
    }
    setCurrentUser(clean);
    try {
      sessionStorage.setItem(SESSION_KEY, clean);
    } catch {
      /* storage unavailable */
    }
    return { ok: true };
  };

  const setupMasterAdmin = async (email, password, setupKey) => {
    try {
      const result = await apiRequest('admin-setup', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password, setupKey },
      });
      setCurrentUser(result.email);
      try {
        sessionStorage.setItem(SESSION_KEY, result.email);
      } catch {
        /* Server-side session remains active for this browser. */
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    apiRequest('admin-logout', { method: 'POST' }).catch((error) => {
      console.error('Could not close the admin server session.', error);
    });
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    let retryTimeoutId;
    setSharedStoreReady(false);
    const loadAdminStore = async () => {
      try {
        const { email } = await apiRequest('admin-session');
        if (normalizeEmail(email) !== normalizeEmail(currentUser)) {
          throw Object.assign(new Error('The active server admin does not match this browser session.'), { status: 401 });
        }
        const { data } = await apiRequest('admin-data');
        if (!active) return;
        if (data) {
          lastSharedDataRef.current = JSON.stringify(data);
          setStore((current) => mergeSharedData(current, data));
        } else {
          const initialData = getSharedData(storeRef.current);
          await apiRequest('admin-data', { method: 'PUT', body: { data: initialData } });
          lastSharedDataRef.current = JSON.stringify(initialData);
        }
        setSharedStoreError('');
        setSharedStoreReady(true);
      } catch (error) {
        if (!active) return;
        if (error.status === 401 && active) {
          setCurrentUser(null);
          setSharedStoreReady(false);
          try {
            sessionStorage.removeItem(SESSION_KEY);
          } catch {
            /* storage unavailable */
          }
          return;
        }
        setSharedStoreError(error.message);
        console.error('Could not load shared admin data; retrying.', error);
        retryTimeoutId = window.setTimeout(loadAdminStore, 10_000);
      }
    };
    loadAdminStore();
    return () => {
      active = false;
      window.clearTimeout(retryTimeoutId);
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) return undefined;
    let active = true;
    const refreshStorefront = async () => {
      try {
        const { data } = await apiRequest('storefront-data');
        if (active && data) setStore((current) => mergeSharedData(current, data));
      } catch (error) {
        if (active) console.error('Could not refresh shared storefront data.', error);
      }
    };
    refreshStorefront();
    const intervalId = window.setInterval(refreshStorefront, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !sharedStoreReady) return undefined;
    const serialized = JSON.stringify(getSharedData(store));
    if (serialized === lastSharedDataRef.current) return undefined;
    const timeoutId = window.setTimeout(async () => {
      try {
        await apiRequest('admin-data', { method: 'PUT', body: { data: getSharedData(storeRef.current) } });
        lastSharedDataRef.current = JSON.stringify(getSharedData(storeRef.current));
        setSharedStoreError('');
      } catch (error) {
        setSharedStoreError(error.message);
        console.error('Could not save shared admin data.', error);
      }
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [store, currentUser, sharedStoreReady]);

  useEffect(() => {
    if (!currentUser || !sharedStoreReady) return undefined;
    let active = true;
    const refreshAdminData = async () => {
      try {
        const { data } = await apiRequest('admin-data');
        if (!active || !data) return;
        setSharedStoreError('');
        const remoteSerialized = JSON.stringify(data);
        const localSerialized = JSON.stringify(getSharedData(storeRef.current));
        if (remoteSerialized !== localSerialized && localSerialized === lastSharedDataRef.current) {
          lastSharedDataRef.current = remoteSerialized;
          setStore((current) => mergeSharedData(current, data));
        }
      } catch (error) {
        if (active && error.status !== 401) {
          setSharedStoreError(error.message);
          console.error('Could not refresh shared admin data.', error);
        }
      }
    };
    const intervalId = window.setInterval(refreshAdminData, 15_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [currentUser, sharedStoreReady]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(store);
      if (serialized.length > 4_800_000) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [store]);

  useEffect(() => {
    const syncStore = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      setStore(loadStore());
    };

    window.addEventListener('storage', syncStore);
    return () => window.removeEventListener('storage', syncStore);
  }, []);

  const value = useMemo(() => {
    const currentAdmin = store.admins.find(
      (admin) => admin.email.toLowerCase() === (currentUser || '').toLowerCase()
    );
    const isAdmin =
      !!currentUser &&
      !!currentAdmin &&
      currentAdmin.status === 'Active';
    const isMaster = isAdmin && !!currentAdmin.master;
    const hasPermission = (permission) => isMaster || !!currentAdmin?.permissions?.includes(permission);

    return {
      currentUser,
      sharedStoreError,
      isAdmin,
      isMaster,
      currentAdmin,
      hasPermission,
      login,
      setupMasterAdmin,
      logout,
      changeAdminPassword: async (currentPassword, newPassword) => {
        const clean = normalizeEmail(currentUser);
        const admin = store.admins.find((item) => normalizeEmail(item.email) === clean);
        if (!admin || admin.status !== 'Active') {
          return { ok: false, error: 'An active admin session is required to change this password.' };
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
          return { ok: false, error: 'Password must be at least 8 characters.' };
        }
        if (newPassword === currentPassword) {
          return { ok: false, error: 'Choose a password different from your current password.' };
        }

        try {
          await apiRequest('admin-change-password', {
            method: 'POST',
            body: { currentPassword, newPassword },
          });
        } catch (error) {
          return { ok: false, error: error.message };
        }

        return { ok: true };
      },

      /* Admins */
      admins: store.admins,
      addAdmin: ({ email, name = '', role = 'Editor', permissions = ['products', 'offers'] }) => {
        const clean = email.trim().toLowerCase();
        const inviteCode = `SIE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        setStore((s) => {
          if (!clean || s.admins.some((a) => a.email === clean)) return s;
          return {
            ...s,
            admins: [
              ...s.admins,
              {
                email: clean,
                name: name.trim() || clean.split('@')[0],
                addedAt: new Date().toISOString().slice(0, 10),
                master: false,
                role,
                permissions,
                password: '',
                inviteCode,
                status: 'Invited',
              },
            ],
          };
        });
        return inviteCode;
      },
      completeInvitation: ({ email, inviteCode, password, name }) => {
        const clean = email.trim().toLowerCase();
        const admin = store.admins.find((item) => item.email === clean);
        if (!admin || admin.status !== 'Invited' || admin.inviteCode !== inviteCode.trim().toUpperCase()) {
          return { ok: false, error: 'Invalid invitation email or code.' };
        }
        if (!password || password.length < 8) {
          return { ok: false, error: 'Password must be at least 8 characters.' };
        }
        setStore((s) => ({
          ...s,
          admins: s.admins.map((item) => item.email === clean
            ? { ...item, name: name?.trim() || item.name, password, status: 'Active', inviteCode: '' }
            : item),
        }));
        return { ok: true };
      },
      updateAdmin: (email, patch) =>
        setStore((s) => ({
          ...s,
          admins: s.admins.map((admin) => admin.email === email && !admin.master
            ? { ...admin, ...patch, permissions: patch.permissions || admin.permissions }
            : admin),
        })),
      removeAdmin: (email) =>
        setStore((s) => ({
          ...s,
          admins: s.admins.filter((a) => a.master || a.email !== email),
        })),

      /* Generic collection CRUD helpers */
      products: store.products,
      storefrontProducts: store.products.filter(isPublishableProduct),
      addProduct: (item) =>
        setStore((s) => ({
          ...s,
          products: [...s.products, { ...item, id: nextId(s.products) }],
        })),
      updateProduct: (id, patch) =>
        setStore((s) => ({
          ...s,
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProduct: (id) =>
        setStore((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) })),

      banners: store.banners,
      addBanner: (item) =>
        setStore((s) => ({
          ...s,
          banners: dedupeBanners([...s.banners, { ...item, id: nextId(s.banners) }]),
        })),
      updateBanner: (id, patch) =>
        setStore((s) => ({
          ...s,
          banners: dedupeBanners(s.banners.map((b) => (b.id === id ? { ...b, ...patch } : b))),
        })),
      deleteBanner: (id) =>
        setStore((s) => ({ ...s, banners: dedupeBanners(s.banners.filter((b) => b.id !== id)) })),

      promoCards: store.promoCards,
      addPromoCard: (item) =>
        setStore((s) => ({
          ...s,
          promoCards: [...s.promoCards, { ...item, id: nextId(s.promoCards), active: true }],
        })),
      updatePromoCard: (id, patch) =>
        setStore((s) => ({
          ...s,
          promoCards: s.promoCards.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      deletePromoCard: (id) =>
        setStore((s) => ({ ...s, promoCards: s.promoCards.filter((item) => item.id !== id) })),

      offers: store.offers,
      addOffer: (item) =>
        setStore((s) => ({
          ...s,
          offers: [...s.offers, { ...item, id: nextId(s.offers) }],
        })),
      updateOffer: (id, patch) =>
        setStore((s) => ({
          ...s,
          offers: s.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      deleteOffer: (id) =>
        setStore((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== id) })),

      videos: store.videos,
      addVideo: (item) =>
        setStore((s) => ({
          ...s,
          videos: [...s.videos, { ...item, id: nextId(s.videos) }],
        })),
      updateVideo: (id, patch) =>
        setStore((s) => ({
          ...s,
          videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      deleteVideo: (id) =>
        setStore((s) => ({ ...s, videos: s.videos.filter((v) => v.id !== id) })),

      orders: store.orders,
      addOrder: async (order) => {
        const nextOrder = {
          ...order,
          id: order.id || '',
          status: 'Pending',
        };

        let savedOrder;
        try {
          const result = await apiRequest('order-create', {
            method: 'POST',
            body: nextOrder,
          });
          savedOrder = result.order;
        } catch (error) {
          return { ok: false, error: error.message };
        }

        addSiteNotification({
          audience: 'admin',
          type: 'order',
          title: 'New order received',
          summary: `${savedOrder.customer || 'A guest'} placed order #${savedOrder.id}.`,
          href: '/admin/orders',
        });
        if (savedOrder.email) {
          addSiteNotification({
            audience: 'customer',
            recipientEmail: normalizeEmail(savedOrder.email),
            type: 'order',
            title: 'Order confirmed',
            summary: `Order #${savedOrder.id} has been received.`,
            href: '/account?tab=orders',
          });
        }

        setStore((s) => {
          const nextOrders = [savedOrder, ...s.orders.filter((item) => item.id !== savedOrder.id)];
          const nextStore = {
            ...s,
            orders: nextOrders,
            customers: syncCustomerOrderCounts(s.customers, nextOrders),
          };

          persistStore(nextStore);
          return nextStore;
        });
        return { ok: true, order: savedOrder };
      },
      updateOrderStatus: async (id, status) => {
        const order = store.orders.find((item) => item.id === id);
        if (!order) return { ok: false, error: 'Order not found.' };
        let updatedOrder;
        try {
          const result = await apiRequest('admin-order-status', {
            method: 'POST',
            body: { id, status },
          });
          updatedOrder = result.order;
        } catch (error) {
          return { ok: false, error: error.message };
        }

        if (order.status !== status && updatedOrder.email) {
          addSiteNotification({
            audience: 'customer',
            recipientEmail: normalizeEmail(updatedOrder.email),
            type: 'order-status',
            title: `Order ${status.toLowerCase()}`,
            summary: `Order #${updatedOrder.id} is now ${status.toLowerCase()}.`,
            href: '/account?tab=orders',
          });
        }

        setStore((s) => {
          const nextStore = {
            ...s,
            orders: s.orders.map((o) => (o.id === id ? { ...o, status: updatedOrder.status } : o)),
          };

          persistStore(nextStore);
          return nextStore;
        });
        return { ok: true };
      },

      customers: store.customers,
      syncCustomers: (registered) =>
        setStore((s) => {
          const existingByEmail = new Map(s.customers.map((c) => [normalizeEmail(c.email), c]));
          const mergedCustomers = [...s.customers];

          for (const user of registered) {
            const email = normalizeEmail(user.email);
            const existing = existingByEmail.get(email);

            if (existing) {
              existing.name = user.name || existing.name;
              existing.phone = user.phone || existing.phone || '-';
              existing.providers = [...new Set([
                ...(existing.providers || (existing.provider ? [existing.provider] : [])),
                ...(user.providers || (user.provider ? [user.provider] : [])),
              ])];
              existing.provider = existing.providers.includes('email') ? 'email' : existing.providers[0] || 'email';
              existing.joined = user.joined || existing.joined;
            } else {
              mergedCustomers.push({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone || '-',
                orders: s.orders.filter((o) => normalizeEmail(o.email) === email).length,
                joined: user.joined,
                provider: user.provider || 'email',
                providers: user.providers || [user.provider || 'email'],
              });
            }
          }

          return {
            ...s,
            customers: syncCustomerOrderCounts(mergedCustomers, s.orders),
          };
        }),
      deleteCustomer: (id) =>
        setStore((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) })),

      enquiries: store.enquiries,
      addEnquiry: async (enquiry) => {
        const nextEnquiry = {
          ...enquiry,
        };

        let savedEnquiry;
        try {
          const result = await apiRequest('enquiry-create', { method: 'POST', body: nextEnquiry });
          savedEnquiry = result.enquiry;
        } catch (error) {
          return { ok: false, error: error.message };
        }

        addSiteNotification({
          audience: 'admin',
          type: 'enquiry',
          title: 'New enquiry received',
          summary: `New enquiry from ${savedEnquiry.name || 'a guest'}.`,
          href: '/admin/enquiries',
        });
        setStore((s) => {
          return {
            ...s,
            enquiries: [savedEnquiry, ...s.enquiries.filter((item) => item.id !== savedEnquiry.id)],
          };
        });
        return { ok: true, enquiry: savedEnquiry };
      },
      updateEnquiryStatus: (id, status) =>
        setStore((s) => ({
          ...s,
          enquiries: s.enquiries.map((e) => (e.id === id ? { ...e, status } : e)),
        })),
      deleteEnquiry: (id) =>
        setStore((s) => ({ ...s, enquiries: s.enquiries.filter((e) => e.id !== id) })),

      settings: store.settings,
      updateSettings: (patch) =>
        setStore((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

      policies: store.policies,
      addPolicy: (id, policy) =>
        setStore((s) => ({
          ...s,
          policies: s.policies[id]
            ? s.policies
            : { ...s.policies, [id]: policy },
        })),
      updatePolicy: (id, patch) =>
        setStore((s) => ({
          ...s,
          policies: { ...s.policies, [id]: { ...s.policies[id], ...patch } },
        })),
      deletePolicy: (id) =>
        setStore((s) => {
          const policies = { ...s.policies };
          delete policies[id];
          return { ...s, policies };
        }),
    };
  }, [store, currentUser, sharedStoreError]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
