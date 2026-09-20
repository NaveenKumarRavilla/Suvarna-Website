import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { products as seedProducts } from '../data/products';
import { heroSlides as seedBanners } from '../data/banners';
import { sendNotification } from '../utils/notifications';

const AdminContext = createContext(null);
const STORAGE_KEY = 'suvarna_admin_store';
const SESSION_KEY = 'suvarna_admin_user';

export const MASTER_ADMIN = 'ravillanaveen1996@gmail.com';
export const MASTER_ADMIN_PASSWORD = 'Suvarna@2026';

export const ADMIN_PERMISSIONS = [
  { id: 'categories', label: 'Manage Categories' },
  { id: 'products', label: 'Manage Products' },
  { id: 'banners', label: 'Manage Banners / Sliders' },
  { id: 'videos', label: 'Manage Videos' },
  { id: 'orders', label: 'Manage Orders' },
  { id: 'customers', label: 'Manage Customers' },
  { id: 'enquiries', label: 'Manage Enquiries' },
  { id: 'offers', label: 'Manage Offers' },
  { id: 'settings', label: 'Manage Settings' },
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
  phone: '+91 91823 01422',
  whatsapp: '919182301422',
  address:
    'Shop No. 12, Ground Floor, Tech Park Plaza, MG Road, Bengaluru, Karnataka 560001',
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
    password: MASTER_ADMIN_PASSWORD,
    status: 'Active',
  }],
  products: seedProducts,
  banners: seedBanners,
  offers: seedOffers,
  videos: seedVideos,
  orders: [],
  customers: seedCustomers,
  enquiries: [],
  settings: defaultSettings,
});

const loadStore = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const base = saved ? JSON.parse(saved) : seedStore();
    const admins = (base.admins || []).map((admin) => ({
      ...admin,
      name: admin.name || admin.email.split('@')[0],
      role: admin.master ? 'Master Admin' : admin.role || 'Editor',
      permissions: admin.master ? ALL_ADMIN_PERMISSIONS : admin.permissions || ['products', 'offers'],
      password: admin.master ? admin.password || MASTER_ADMIN_PASSWORD : admin.password || '',
      status: admin.master ? 'Active' : admin.status || 'Invited',
    }));

    return {
      ...seedStore(),
      ...base,
      admins,
      products: Array.isArray(base.products) ? base.products : seedStore().products,
      banners: dedupeBanners(Array.isArray(base.banners) ? base.banners : seedStore().banners),
      offers: Array.isArray(base.offers) ? base.offers : seedStore().offers,
      videos: Array.isArray(base.videos) ? base.videos : seedStore().videos,
      orders: Array.isArray(base.orders) ? base.orders : [],
      customers: Array.isArray(base.customers) ? base.customers : seedCustomers,
      enquiries: Array.isArray(base.enquiries) ? base.enquiries : [],
      settings: { ...seedStore().settings, ...(base.settings || {}) },
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

const persistStore = (storeSnapshot) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storeSnapshot));
  } catch {
    /* storage unavailable */
  }
};

export function AdminProvider({ children }) {
  const [store, setStore] = useState(loadStore);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  });

  const login = (email, password) => {
    const clean = email.trim().toLowerCase();
    const admin = store.admins.find((item) => item.email === clean);
    if (!admin) return { ok: false, error: 'This email does not have admin access.' };
    if (admin.status !== 'Active') return { ok: false, error: 'Complete the invitation setup before logging in.' };
    const masterPasswordAccepted = admin.master && password === MASTER_ADMIN_PASSWORD;
    if (admin.password !== password && !masterPasswordAccepted) return { ok: false, error: 'Incorrect admin password.' };
    setCurrentUser(clean);
    try {
      sessionStorage.setItem(SESSION_KEY, clean);
    } catch {
      /* storage unavailable */
    }
    return { ok: true };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  };

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
      isAdmin,
      isMaster,
      currentAdmin,
      hasPermission,
      login,
      logout,

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
      addOrder: (order) =>
        setStore((s) => {
          const nextOrder = {
            ...order,
            id: order.id || `SIE${Date.now().toString().slice(-8)}`,
            status: 'Pending',
          };

          const nextOrders = [nextOrder, ...s.orders];
          const nextStore = {
            ...s,
            orders: nextOrders,
            customers: syncCustomerOrderCounts(s.customers, nextOrders),
          };

          persistStore(nextStore);
          sendNotification('order', nextOrder);
          return nextStore;
        }),
      updateOrderStatus: (id, status) =>
        setStore((s) => {
          const nextStore = {
            ...s,
            orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
          };

          persistStore(nextStore);
          return nextStore;
        }),

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
              existing.provider = user.provider || existing.provider || 'email';
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
      addEnquiry: (enquiry) =>
        setStore((s) => {
          const nextEnquiry = {
            ...enquiry,
            id: nextId(s.enquiries),
            date: new Date().toISOString().slice(0, 10),
            status: 'New',
          };

          sendNotification('enquiry', nextEnquiry);

          return {
            ...s,
            enquiries: [nextEnquiry, ...s.enquiries],
          };
        }),
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
    };
  }, [store, currentUser]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
