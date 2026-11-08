import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { products as seedProducts } from '../data/products';
import { heroSlides as seedBanners, promoCards as seedPromoCards } from '../data/banners';
import { defaultManagedCategories, normalizeCategoryId } from '../data/categories';
import { defaultPolicies } from '../data/policies';
import { addSiteNotification } from '../utils/siteNotifications';
import { apiRequest } from '../utils/api';
import { isPublishableProduct } from '../utils/productQuality';

const AdminContext = createContext(null);
const STORAGE_KEY = 'suvarna_admin_store';
const SHARED_DRAFT_STORAGE_KEY = 'suvarna_admin_shared_draft';
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

const createPermanentProductId = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure product ID generation is unavailable in this browser.');
  const suffix = cryptoApi.randomUUID
    ? cryptoApi.randomUUID()
    : [...cryptoApi.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  return `PRD-${suffix}`;
};

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
    shared.settings = {
      ...store.settings,
      ...sharedSettings,
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
  const [storefrontReady, setStorefrontReady] = useState(false);
  const [storefrontDataAvailable, setStorefrontDataAvailable] = useState(false);
  const [storefrontError, setStorefrontError] = useState('');
  const [sharedStoreSaving, setSharedStoreSaving] = useState(false);
  const [sharedStoreError, setSharedStoreError] = useState('');
  const [sharedStoreConflict, setSharedStoreConflict] = useState(false);
  const [adminFormDirty, setAdminFormDirty] = useState(false);
  const lastSharedDataRef = useRef('');
  const lastSharedRevisionRef = useRef(0);
  const sharedStoreConflictRef = useRef(false);
  const pendingSharedDataRef = useRef(null);
  const pendingImportIdsRef = useRef(new Map());
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
  const authGenerationRef = useRef(0);
  const sharedStoreReadyRef = useRef(sharedStoreReady);
  sharedStoreReadyRef.current = sharedStoreReady;
  const getPendingImportIds = useCallback((kind, fingerprint) => {
    const pending = pendingImportIdsRef.current.get(kind);
    return pending?.fingerprint === fingerprint ? pending : null;
  }, []);
  const rememberPendingImportIds = useCallback((kind, pending) => pendingImportIdsRef.current.set(kind, pending), []);
  const clearPendingImportIds = useCallback((kind, fingerprint) => {
    const pending = pendingImportIdsRef.current.get(kind);
    if (pending?.fingerprint === fingerprint) pendingImportIdsRef.current.delete(kind);
  }, []);
  const persistSharedDraft = (data) => {
    try {
      localStorage.setItem(SHARED_DRAFT_STORAGE_KEY, JSON.stringify({
        data,
        baseRevision: lastSharedRevisionRef.current,
        baseData: lastSharedDataRef.current,
      }));
    } catch (error) {
      console.error('Could not preserve the unsaved admin draft.', error);
    }
  };

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
          const responseRevision = Number(result.revision);
          if (Number.isSafeInteger(responseRevision) && responseRevision >= lastSharedRevisionRef.current) {
            lastSharedRevisionRef.current = responseRevision;
            lastSharedDataRef.current = serializeSharedData(next);
          }
        }
        setSharedStoreError('');
        setSharedStoreConflict(false);
        sharedStoreConflictRef.current = false;
        try {
          localStorage.removeItem(SHARED_DRAFT_STORAGE_KEY);
        } catch (error) {
          console.error('Could not clear the saved admin draft.', error);
        }
        window.clearTimeout(saveRetryTimeoutRef.current);
        saveRetryTimeoutRef.current = null;
      } catch (error) {
        pendingSharedDataRef.current = getSharedData(storeRef.current);
        persistSharedDraft(pendingSharedDataRef.current);
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

  const refreshSharedStoreSnapshot = async (minimumRevision) => {
    try {
      const { data, revision } = await apiRequest('admin-data');
      const responseRevision = Number(revision);
      if (
        !data ||
        !Number.isSafeInteger(responseRevision) ||
        responseRevision < lastSharedRevisionRef.current ||
        (minimumRevision != null && responseRevision < Number(minimumRevision))
      ) {
        throw new Error('The latest shared store snapshot could not be confirmed.');
      }

      if (!lastSharedDataRef.current) {
        sharedStoreConflictRef.current = true;
        setSharedStoreConflict(true);
        setSharedStoreError('The shared store changed during an update. Reload the admin page before making more changes.');
        return;
      }

      const baseline = JSON.parse(lastSharedDataRef.current);
      const localData = getSharedData(storeRef.current);
      const locallyChangedKeys = SHARED_DATA_KEYS.filter(
        (key) => JSON.stringify(localData[key]) !== JSON.stringify(baseline[key])
      );
      const remotelyChangedKeys = SHARED_DATA_KEYS.filter(
        (key) => JSON.stringify(data[key]) !== JSON.stringify(baseline[key])
      );
      const hasConflictingChanges = locallyChangedKeys.some((key) => remotelyChangedKeys.includes(key));

      if (hasConflictingChanges) {
        sharedStoreConflictRef.current = true;
        setSharedStoreConflict(true);
        setSharedStoreError('The shared store changed in another admin session while you had local edits. Your edits are still in this tab; reload only after recovering them.');
        return;
      }

      const mergedData = {
        ...data,
        ...Object.fromEntries(locallyChangedKeys.map((key) => [key, localData[key]])),
      };
      lastSharedRevisionRef.current = responseRevision;
      lastSharedDataRef.current = serializeSharedData(data);
      sharedStoreConflictRef.current = false;
      setSharedStoreConflict(false);
      setSharedStoreError('');
      setStore((current) => mergeSharedData(current, mergedData));
    } catch (error) {
      setSharedStoreError(error.message);
      console.error('Could not refresh the shared admin data snapshot.', error);
    }
  };

  const login = async (email, password) => {
    const clean = email.trim().toLowerCase();
    let result;
    try {
      result = await apiRequest('admin-login', { method: 'POST', body: { email: clean, password } });
    } catch (error) {
      return { ok: false, error: error.message };
    }
    if (result.admin) {
      setStore((current) => ({
        ...current,
        admins: [...current.admins.filter((admin) => normalizeEmail(admin.email) !== clean), result.admin],
      }));
    }
    sharedStoreConflictRef.current = false;
    setSharedStoreConflict(false);
    setSharedStoreReady(false);
    authGenerationRef.current += 1;
    currentUserRef.current = clean;
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
      if (result.admin) {
        setStore((current) => ({
          ...current,
          admins: [...current.admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(result.email)), result.admin],
        }));
      }
      sharedStoreConflictRef.current = false;
      setSharedStoreConflict(false);
      setSharedStoreReady(false);
      authGenerationRef.current += 1;
      currentUserRef.current = result.email;
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
    authGenerationRef.current += 1;
    currentUserRef.current = null;
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

  const invalidateAdminSession = () => {
    authGenerationRef.current += 1;
    currentUserRef.current = null;
    setCurrentUser(null);
    setSharedStoreReady(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const refreshStorefrontData = async () => {
    if (currentUserRef.current && sharedStoreReadyRef.current) {
      return refreshSharedStoreSnapshot(lastSharedRevisionRef.current);
    }
    const requestGeneration = authGenerationRef.current;
    if (currentUserRef.current) return false;
    const { data } = await apiRequest('storefront-data');
    if (requestGeneration !== authGenerationRef.current || currentUserRef.current) return false;
    setStorefrontReady(true);
    setStorefrontDataAvailable(Boolean(data));
    setStorefrontError(data ? '' : 'Storefront data is not initialized yet. Please try again later.');
    if (data) setStore((current) => mergeSharedData(current, data));
    return Boolean(data);
  };

  const commitSharedMutation = async (updateStore) => {
    if (!currentUserRef.current || !sharedStoreReadyRef.current) {
      setSharedStoreError('Wait for the shared store to finish loading before saving.');
      return false;
    }
    if (sharedStoreConflictRef.current) {
      setSharedStoreError('Reload the latest shared data and resolve the save conflict before saving.');
      return false;
    }
    let nextStore;
    try {
      nextStore = updateStore(storeRef.current);
    } catch (error) {
      setSharedStoreError(error.message || 'The shared store update could not be prepared.');
      console.error('Could not prepare shared store update.', error);
      return false;
    }
    storeRef.current = nextStore;
    setStore(nextStore);
    persistStore(nextStore);
    const snapshot = getSharedData(nextStore);
    persistSharedDraft(snapshot);
    try {
      await flushSharedStore(snapshot);
      return true;
    } catch {
      return false;
    }
  };

  const saveProductBatch = async (operations) => commitSharedMutation((current) => {
    const products = [...current.products];
    for (const operation of operations) {
      if (operation.id != null) {
        const index = products.findIndex((product) => String(product.id) === String(operation.id));
        if (index >= 0) products[index] = { ...products[index], ...operation.product };
        else products.push({ ...operation.product, id: operation.id });
        continue;
      }
      products.push({ ...operation.product, id: createPermanentProductId() });
    }
    return { ...current, products };
  });

  const saveBannerBatch = async (operations) => commitSharedMutation((current) => {
    let banners = [...current.banners];
    for (const operation of operations) {
      if (operation.id != null) {
        const index = banners.findIndex((banner) => String(banner.id) === String(operation.id));
        if (index >= 0) banners[index] = { ...banners[index], ...operation.banner };
        else banners.push({ ...operation.banner, id: operation.id });
      } else {
        banners.push({ ...operation.banner, id: nextId(banners) });
      }
    }
    return { ...current, banners: dedupeBanners(banners) };
  });

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    let retryTimeoutId;
    setSharedStoreReady(false);
    const loadAdminStore = async () => {
      try {
        const session = await apiRequest('admin-session');
        const { email } = session;
        if (normalizeEmail(email) !== normalizeEmail(currentUser)) {
          throw Object.assign(new Error('The active server admin does not match this browser session.'), { status: 401 });
        }
        if (session.admin) {
          setStore((current) => ({
            ...current,
            admins: [...current.admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(email)), session.admin],
          }));
        }
        if (session.admin?.master) {
          const { admins } = await apiRequest('admin-invites');
          if (!Array.isArray(admins)) throw new Error('The server returned an invalid admin list.');
          setStore((current) => ({ ...current, admins }));
        }
        const mediaPermissions = ['products', 'banners', 'promo-cards', 'videos', 'offers'];
        if (
          session.admin?.master ||
          session.admin?.permissions?.some((permission) => mediaPermissions.includes(permission))
        ) {
          await apiRequest('admin-media-migrate', { method: 'POST', body: {} });
        }
        const { data, revision = 0 } = await apiRequest('admin-data');
        if (!active) return;
        lastSharedRevisionRef.current = Number(revision) || 0;
        sharedStoreConflictRef.current = false;
        setSharedStoreConflict(false);
        if (data) {
          lastSharedDataRef.current = serializeSharedData(data);
          let recoveredData = data;
          try {
            const draft = JSON.parse(localStorage.getItem(SHARED_DRAFT_STORAGE_KEY) || 'null');
            if (draft?.data) {
              const serverBaseline = serializeSharedData(data);
              if (serializeSharedData(draft.data) === serverBaseline) {
                localStorage.removeItem(SHARED_DRAFT_STORAGE_KEY);
              } else {
                recoveredData = { ...data, ...draft.data };
                if (
                  Number(draft.baseRevision) !== Number(revision) ||
                  draft.baseData !== serverBaseline
                ) {
                  sharedStoreConflictRef.current = true;
                  setSharedStoreConflict(true);
                  setSharedStoreError('Recovered unsaved changes are preserved in this tab, but the server changed since this draft was created. Resolve the save conflict before editing further.');
                }
              }
            }
          } catch (draftError) {
            console.error('Could not restore the saved admin draft.', draftError);
          }
          setStore((current) => mergeSharedData(current, recoveredData));
        } else {
          const initialData = getSharedData(storeRef.current);
          const result = await apiRequest('admin-data', {
            method: 'PUT',
            body: { data: initialData, revision: lastSharedRevisionRef.current },
          });
          lastSharedRevisionRef.current = Number(result.revision) || 1;
          lastSharedDataRef.current = serializeSharedData(initialData);
        }
        if (!sharedStoreConflictRef.current) setSharedStoreError('');
        setSharedStoreReady(true);
        // The authenticated snapshot is the same authoritative catalogue used by
        // the storefront. Mark it ready so restored sessions do not spin forever.
        setStorefrontReady(true);
        setStorefrontDataAvailable(Boolean(data));
        setStorefrontError(data ? '' : 'Storefront data is not initialized yet. Please try again later.');
      } catch (error) {
        if (!active) return;
        if (error.status === 401 && active) {
          invalidateAdminSession();
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
        if (active) await refreshStorefrontData();
      } catch (error) {
        if (active && !currentUserRef.current) {
          setStorefrontReady(true);
          setStorefrontDataAvailable(false);
          setStorefrontError(error.message);
          console.error('Could not refresh shared storefront data.', error);
        }
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
    persistSharedDraft(getSharedData(store));
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
        const responseRevision = Number(revision);
        if (!Number.isSafeInteger(responseRevision) || responseRevision < lastSharedRevisionRef.current) return;
        if (!sharedStoreConflictRef.current) setSharedStoreError('');
        const remoteSerialized = serializeSharedData(data);
        const localSerialized = serializeSharedData(getSharedData(storeRef.current));
        if (remoteSerialized === localSerialized) {
          lastSharedRevisionRef.current = responseRevision;
          lastSharedDataRef.current = remoteSerialized;
          if (sharedStoreConflictRef.current) {
            sharedStoreConflictRef.current = false;
            setSharedStoreConflict(false);
            setSharedStoreError('');
          }
        } else if (localSerialized === lastSharedDataRef.current) {
          lastSharedRevisionRef.current = responseRevision;
          lastSharedDataRef.current = remoteSerialized;
          setStore((current) => mergeSharedData(current, data));
        } else if (responseRevision > lastSharedRevisionRef.current) {
          sharedStoreConflictRef.current = true;
          setSharedStoreConflict(true);
          setSharedStoreError('The shared store changed in another admin session. Your edits are still in this tab; do not refresh or close it before recovering them.');
        }
      } catch (error) {
        if (active && error.status === 401) {
          invalidateAdminSession();
        } else if (active) {
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
      if (currentUserRef.current) return;
      setStore(loadStore());
    };

    window.addEventListener('storage', syncStore);
    return () => window.removeEventListener('storage', syncStore);
  }, []);

  useEffect(() => {
    if (!currentUser || !sharedStoreReady) return undefined;
    const handleBeforeUnload = (event) => {
      const currentData = serializeSharedData(getSharedData(storeRef.current));
      const unsaved = currentData !== lastSharedDataRef.current || savingSharedDataRef.current || sharedStoreConflictRef.current || adminFormDirty;
      if (!unsaved) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, sharedStoreReady, store, sharedStoreSaving, sharedStoreError, adminFormDirty]);

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
      getPendingImportIds,
      rememberPendingImportIds,
      clearPendingImportIds, 
      currentUser,
      sharedStoreReady,
      storefrontReady,
      storefrontDataAvailable,
      storefrontError,
      sharedStoreSaving,
      sharedStoreDirty: Boolean(currentUser) && (
        serializeSharedData(getSharedData(store)) !== lastSharedDataRef.current ||
        sharedStoreSaving ||
        sharedStoreConflict ||
        adminFormDirty
      ),
      setAdminFormDirty,
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
      addAdmin: async ({ email, name = '', role = 'Editor', permissions = ['products', 'offers'] }) => {
        try {
          const result = await apiRequest('admin-invite', {
            method: 'POST',
            body: { email, name, role, permissions },
          });
          setStore((current) => ({
            ...current,
            admins: [...current.admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(email)), result.admin],
          }));
          return { ok: true, inviteCode: result.inviteCode };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
      completeInvitation: async ({ email, inviteCode, password, name }) => {
        try {
          await apiRequest('admin-invitation-complete', {
            method: 'POST',
            body: { email, inviteCode, password, name },
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
      updateAdmin: async (email, patch) => {
        try {
          const result = await apiRequest('admin-update', {
            method: 'POST',
            body: { email, role: patch.role || 'Editor', permissions: patch.permissions || [] },
          });
          setStore((current) => ({
            ...current,
            admins: [...current.admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(email)), result.admin],
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
      removeAdmin: async (email) => {
        try {
          await apiRequest('admin-remove', { method: 'POST', body: { email } });
          setStore((current) => ({
            ...current,
            admins: current.admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(email)),
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },

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
      saveProductBatch,
      addProduct: (item) => saveProductBatch([{ product: item }]),
      updateProduct: (id, patch) => saveProductBatch([{ id, product: patch }]),
      deleteProduct: (id) =>
        setStore((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) })),

      banners: store.banners,
      saveBannerBatch,
      addBanner: (item) => saveBannerBatch([{ banner: item }]),
      updateBanner: (id, patch) => saveBannerBatch([{ id, banner: patch }]),
      deleteBanner: (id) =>
        setStore((s) => ({ ...s, banners: dedupeBanners(s.banners.filter((b) => b.id !== id)) })),

      promoCards: store.promoCards,
      addPromoCard: (item) => commitSharedMutation((s) => {
        const id = item.id ?? nextId(s.promoCards);
        const existing = s.promoCards.findIndex((card) => String(card.id) === String(id));
        const promoCard = { ...item, id, active: item.active ?? true };
        const promoCards = [...s.promoCards];
        if (existing >= 0) promoCards[existing] = { ...promoCards[existing], ...promoCard };
        else promoCards.push(promoCard);
        return { ...s, promoCards };
      }),
      updatePromoCard: (id, patch) =>
        commitSharedMutation((s) => ({ ...s, promoCards: s.promoCards.map((item) => (item.id === id ? { ...item, ...patch } : item)) })),
      deletePromoCard: (id) =>
        setStore((s) => ({ ...s, promoCards: s.promoCards.filter((item) => item.id !== id) })),

      offers: store.offers,
      addOffer: (item) => commitSharedMutation((s) => {
        const id = item.id ?? nextId(s.offers);
        const existing = s.offers.findIndex((offer) => String(offer.id) === String(id));
        const offer = { ...item, id };
        const offers = [...s.offers];
        if (existing >= 0) offers[existing] = { ...offers[existing], ...offer };
        else offers.push(offer);
        return { ...s, offers };
      }),
      updateOffer: (id, patch) =>
        commitSharedMutation((s) => ({ ...s, offers: s.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
      deleteOffer: (id) =>
        setStore((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== id) })),

      videos: store.videos,
      addVideo: (item) => commitSharedMutation((s) => {
        const id = item.id ?? nextId(s.videos);
        const existing = s.videos.findIndex((video) => String(video.id) === String(id));
        const video = { ...item, id };
        const videos = [...s.videos];
        if (existing >= 0) videos[existing] = { ...videos[existing], ...video };
        else videos.push(video);
        return { ...s, videos };
      }),
      updateVideo: (id, patch) =>
        commitSharedMutation((s) => ({ ...s, videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      deleteVideo: (id) =>
        setStore((s) => ({ ...s, videos: s.videos.filter((v) => v.id !== id) })),

      orders: store.orders,
      refreshStorefrontData,
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
          if (currentUserRef.current) await refreshSharedStoreSnapshot(result.revision);
          if (result.duplicate) {
            setStore((s) => {
              const nextOrders = [savedOrder, ...s.orders.filter((item) => item.id !== savedOrder.id)];
              return {
                ...s,
                orders: nextOrders,
                customers: syncCustomerOrderCounts(s.customers, nextOrders),
              };
            });
            return { ok: true, order: savedOrder, duplicate: true };
          }
        } catch (error) {
          return { ok: false, error: error.message, status: error.status };
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
          if (currentUserRef.current) await refreshSharedStoreSnapshot(result.revision);
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
      updateSettings: async (patch) => {
        const saved = await commitSharedMutation((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        return saved ? storeRef.current.settings : false;
      },

      policies: store.policies,
      addPolicy: (id, policy) =>
        commitSharedMutation((s) => ({ ...s, policies: s.policies[id] ? s.policies : { ...s.policies, [id]: policy } })),
      updatePolicy: (id, patch) =>
        commitSharedMutation((s) => ({ ...s, policies: { ...s.policies, [id]: { ...s.policies[id], ...patch } } })),
      deletePolicy: (id) =>
        setStore((s) => {
          const policies = { ...s.policies };
          delete policies[id];
          return { ...s, policies };
        }),
    };
  }, [
    store,
    currentUser,
    sharedStoreReady,
    storefrontReady,
    storefrontDataAvailable,
    storefrontError,
    sharedStoreSaving,
    sharedStoreError,
    sharedStoreConflict,
    adminFormDirty,
    getPendingImportIds,
    rememberPendingImportIds,
    clearPendingImportIds,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
