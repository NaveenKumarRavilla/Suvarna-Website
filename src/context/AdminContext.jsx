import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { products as seedProducts } from '../data/products';
import { heroSlides as seedBanners, promoCards as seedPromoCards } from '../data/banners';
import { defaultManagedCategories, normalizeCategoryId } from '../data/categories';
import { defaultPolicies } from '../data/policies';
import { addSiteNotification } from '../utils/siteNotifications';
import { apiRequest } from '../utils/api';
import { isPublishableProduct } from '../utils/productQuality';

const AdminContext = createContext(null);
const STORAGE_KEY = 'suvarna_admin_store';
const SESSION_KEY = 'suvarna_admin_user';
const SHARED_DATA_KEYS = ['products', 'banners', 'promoCards', 'offers', 'videos', 'orders', 'enquiries', 'categories', 'settings', 'policies'];

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

const buildManagedCategories = (products = []) => {
  const knownIds = new Set(defaultManagedCategories.map((category) => category.id));
  const productCategoryIds = [
    ...new Set(products.map((product) => normalizeCategoryId(product.category)).filter(Boolean)),
  ].filter((id) => !knownIds.has(id));

  return [
    ...defaultManagedCategories,
    ...productCategoryIds.map((id) => ({
      id,
      label: id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      tagline: '',
      gradient: 'from-slate-600 to-slate-800',
      iconKey: 'Package',
    })),
  ];
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
  categories: buildManagedCategories(seedProducts),
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
      categories: Array.isArray(base.categories)
        ? base.categories
        : seedStore().categories,
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

const serializeSharedData = (data) =>
  JSON.stringify(Object.fromEntries(SHARED_DATA_KEYS.map((key) => [key, data[key]])));

const mergeSharedData = (store, data) => {
  const shared = Object.fromEntries(
    SHARED_DATA_KEYS
      .filter((key) => data && Object.prototype.hasOwnProperty.call(data, key))
      .map((key) => [key, data[key]])
  );
  if (Array.isArray(shared.categories) && shared.categories.length === 0) {
    const products = shared.products || store.products;
    if (products.some((product) => normalizeCategoryId(product.category))) {
      const categoriesById = new Map(
        [...buildManagedCategories(products), ...store.categories].map((category) => [category.id, category])
      );
      shared.categories = [...categoriesById.values()];
    }
  }
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
  const [sharedStoreSaving, setSharedStoreSaving] = useState(false);
  const [sharedStoreError, setSharedStoreError] = useState('');
  const [sharedStoreConflict, setSharedStoreConflict] = useState(false);
  const lastSharedDataRef = useRef('');
  const lastSharedRevisionRef = useRef(0);
  const sharedStoreConflictRef = useRef(false);
  const pendingSharedDataRef = useRef(null);
  const savingSharedDataRef = useRef(false);
  const savePromiseRef = useRef(Promise.resolve());
  const saveRetryTimeoutRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem(SESSION_KEY);
      return normalizeEmail(savedUser) === LEGACY_MASTER_ADMIN ? MASTER_ADMIN : savedUser || null;
    } catch {
      return null;
    }
  });
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const sharedStoreReadyRef = useRef(sharedStoreReady);
  sharedStoreReadyRef.current = sharedStoreReady;

  const flushSharedStore = (snapshot = getSharedData(storeRef.current)) => {
    pendingSharedDataRef.current = snapshot;
    if (sharedStoreConflictRef.current) {
      return Promise.reject(new Error('Reload the admin page to load the latest shared data before saving.'));
    }
    if (savingSharedDataRef.current) return savePromiseRef.current;
    if (serializeSharedData(snapshot) === lastSharedDataRef.current) {
      pendingSharedDataRef.current = null;
      return Promise.resolve();
    }

    savingSharedDataRef.current = true;
    setSharedStoreSaving(true);
    const savePromise = (async () => {
      try {
        while (pendingSharedDataRef.current) {
          const next = pendingSharedDataRef.current;
          pendingSharedDataRef.current = null;
          const body = { data: next, revision: lastSharedRevisionRef.current };
          const keepalive = new Blob([JSON.stringify(body)]).size < 60 * 1024;
          const result = await apiRequest('admin-data', { method: 'PUT', body, keepalive });
          lastSharedRevisionRef.current = Number(result.revision) || lastSharedRevisionRef.current + 1;
          lastSharedDataRef.current = serializeSharedData(next);
        }
        setSharedStoreError('');
        setSharedStoreConflict(false);
        sharedStoreConflictRef.current = false;
        window.clearTimeout(saveRetryTimeoutRef.current);
        saveRetryTimeoutRef.current = null;
      } catch (error) {
        pendingSharedDataRef.current = getSharedData(storeRef.current);
        if (error.status === 409 || error.status === 428) {
          sharedStoreConflictRef.current = true;
          setSharedStoreConflict(true);
        } else {
          setSharedStoreConflict(false);
        }
        setSharedStoreError(error.message);
        console.error('Could not save shared admin data.', error);
        const shouldRetry = !error.status || error.status >= 500;
        if (shouldRetry && !saveRetryTimeoutRef.current && currentUserRef.current && sharedStoreReadyRef.current) {
          saveRetryTimeoutRef.current = window.setTimeout(() => {
            saveRetryTimeoutRef.current = null;
            if (currentUserRef.current && sharedStoreReadyRef.current) {
              flushSharedStore().catch(() => {});
            }
          }, 10_000);
        }
        throw error;
      } finally {
        savingSharedDataRef.current = false;
        setSharedStoreSaving(false);
      }
    })();
    savePromiseRef.current = savePromise;
    return savePromise;
  };

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
    sharedStoreConflictRef.current = false;
    setSharedStoreConflict(false);
    setSharedStoreReady(false);
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
      sharedStoreConflictRef.current = false;
      setSharedStoreConflict(false);
      setSharedStoreReady(false);
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

  const logout = async () => {
    if (currentUser && !sharedStoreReady) {
      setSharedStoreError('Wait for the shared store to finish loading before logging out.');
      return;
    }
    if (currentUser && !sharedStoreConflictRef.current) {
      try {
        await flushSharedStore(getSharedData(storeRef.current));
      } catch {
        return;
      }
    }
    setSharedStoreReady(false);
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
    try {
      await apiRequest('admin-logout', { method: 'POST' });
    } catch (error) {
      console.error('Could not close the admin server session.', error);
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
        const { data, revision = 0 } = await apiRequest('admin-data');
        if (!active) return;
        lastSharedRevisionRef.current = Number(revision) || 0;
        sharedStoreConflictRef.current = false;
        setSharedStoreConflict(false);
        if (data) {
          lastSharedDataRef.current = serializeSharedData(data);
          setStore((current) => mergeSharedData(current, data));
        } else {
          const initialData = getSharedData(storeRef.current);
          const result = await apiRequest('admin-data', {
            method: 'PUT',
            body: { data: initialData, revision: lastSharedRevisionRef.current },
          });
          lastSharedRevisionRef.current = Number(result.revision) || 1;
          lastSharedDataRef.current = serializeSharedData(initialData);
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
    const serialized = serializeSharedData(getSharedData(store));
    if (serialized === lastSharedDataRef.current) return undefined;
    flushSharedStore(getSharedData(store)).catch(() => {});
    return undefined;
  }, [store, currentUser, sharedStoreReady]);

  useEffect(() => {
    if (!currentUser || !sharedStoreReady) return undefined;
    let active = true;
    const refreshAdminData = async () => {
      try {
        const { data, revision = 0 } = await apiRequest('admin-data');
        if (!active || !data) return;
        if (!sharedStoreConflictRef.current) setSharedStoreError('');
        const remoteSerialized = serializeSharedData(data);
        const localSerialized = serializeSharedData(getSharedData(storeRef.current));
        if (remoteSerialized === localSerialized) {
          lastSharedRevisionRef.current = Number(revision) || lastSharedRevisionRef.current;
          lastSharedDataRef.current = remoteSerialized;
          if (sharedStoreConflictRef.current) {
            sharedStoreConflictRef.current = false;
            setSharedStoreConflict(false);
            setSharedStoreError('');
          }
        } else if (localSerialized === lastSharedDataRef.current) {
          lastSharedRevisionRef.current = Number(revision) || lastSharedRevisionRef.current;
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
      sharedStoreReady,
      sharedStoreSaving,
      sharedStoreError,
      sharedStoreConflict,
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
      categories: store.categories,
      addCategory: (item) =>
        setStore((s) => {
          const id = normalizeCategoryId(item.id);
          if (!id || s.categories.some((category) => category.id === id)) return s;
          return { ...s, categories: [...s.categories, { ...item, id }] };
        }),
      updateCategory: (id, patch) =>
        setStore((s) => ({
          ...s,
          categories: s.categories.map((category) =>
            category.id === id ? { ...category, ...patch, id: category.id } : category
          ),
        })),
      deleteCategory: (id) => {
        if (storeRef.current.products.some((product) => normalizeCategoryId(product.category) === id)) return false;
        setStore((s) => ({
          ...s,
          categories: s.categories.filter((category) => category.id !== id),
        }));
        return true;
      },
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
  }, [store, currentUser, sharedStoreReady, sharedStoreSaving, sharedStoreError]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
