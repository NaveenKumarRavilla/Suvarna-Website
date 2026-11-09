import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'suvarna_wishlist';
const SEED_KEY = `${STORAGE_KEY}_seed`;
const OPERATION_PREFIX = `${STORAGE_KEY}:operation:`;

const loadWishlistItems = (serialized) => {
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getWishlistSeed = () => {
  try {
    const savedSeed = localStorage.getItem(SEED_KEY);
    if (savedSeed != null) return loadWishlistItems(savedSeed);
    const legacy = loadWishlistItems(localStorage.getItem(STORAGE_KEY));
    try {
      localStorage.setItem(SEED_KEY, JSON.stringify(legacy));
    } catch {
      /* storage unavailable */
    }
    return legacy;
  } catch {
    return null;
  }
};

const readOperations = () => {
  const operations = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(OPERATION_PREFIX)) continue;
      try {
        const operation = JSON.parse(localStorage.getItem(key));
        if (operation && Number.isFinite(operation.clock) && operation.id) operations.push(operation);
      } catch {
        // Ignore a malformed operation and keep the remaining shared state usable.
      }
    }
    return operations.sort((left, right) =>
      left.clock - right.clock || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    );
  } catch {
    return null;
  }
};

const applyWishlistOperation = (items, operation) => {
  switch (operation.type) {
    case 'ADD_ITEM':
      return items.some((item) => String(item.id) === String(operation.product.id))
        ? items
        : [...items, operation.product];
    case 'REMOVE_ITEM':
      return items.filter((item) => String(item.id) !== String(operation.id));
    case 'CLEAR_WISHLIST':
      return [];
    default:
      return items;
  }
};

const loadInitialState = () => {
  const seed = getWishlistSeed() || [];
  const operations = readOperations();
  return (operations || []).reduce(applyWishlistOperation, seed);
};

function wishlistReducer(state, action) {
  if (action.type === 'APPLY_OPERATION') {
    return applyWishlistOperation(state, action.operation);
  }
  if (action.type === 'REPLAY_OPERATIONS') {
    return action.operations.reduce(applyWishlistOperation, action.seed);
  }
  return state;
}

const createTabId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Fall through when the browser does not expose crypto in this context.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const savedWishlistProduct = (product) => ({
  ...product,
  image: product.images?.[0] || product.image,
});

export function WishlistProvider({ children }) {
  const [items, dispatch] = useReducer(wishlistReducer, undefined, loadInitialState);
  const itemsRef = useRef(items);
  const tabId = useRef(createTabId());
  const sequence = useRef(0);
  const logicalClock = useRef(0);
  itemsRef.current = items;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== null && !event.key.startsWith(OPERATION_PREFIX)) return;
      const operations = readOperations();
      if (!operations) return;
      const seed = getWishlistSeed();
      if (!seed) return;
      logicalClock.current = operations.reduce(
        (clock, operation) => Math.max(clock, operation.clock),
        logicalClock.current
      );
      itemsRef.current = operations.reduce(applyWishlistOperation, seed);
      dispatch({ type: 'REPLAY_OPERATIONS', seed, operations });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => {
    const commit = (type, details = {}) => {
      const seed = getWishlistSeed();
      const savedOperations = readOperations();
      if (seed && savedOperations) {
        const latestClock = savedOperations.reduce(
          (clockValue, operation) => Math.max(clockValue, operation.clock),
          logicalClock.current
        );
        logicalClock.current = latestClock;
        itemsRef.current = savedOperations.reduce(applyWishlistOperation, seed);
        dispatch({ type: 'REPLAY_OPERATIONS', seed, operations: savedOperations });
      }
      const clock = Math.max(Date.now(), logicalClock.current + 1);
      logicalClock.current = clock;
      sequence.current += 1;
      const id = `${tabId.current}-${sequence.current}`;
      const operation = { id, clock, type, ...details };
      itemsRef.current = applyWishlistOperation(itemsRef.current, operation);
      try {
        localStorage.setItem(`${OPERATION_PREFIX}${id}`, JSON.stringify(operation));
      } catch {
        /* storage unavailable */
      }
      dispatch({ type: 'APPLY_OPERATION', operation });
    };

    return {
      items,
      addItem: (product) => {
        if (itemsRef.current.some((item) => String(item.id) === String(product.id))) return;
        commit('ADD_ITEM', { product: savedWishlistProduct(product) });
      },
      removeItem: (id) => commit('REMOVE_ITEM', { id }),
      toggleItem: (product) => {
        const exists = itemsRef.current.some((item) => String(item.id) === String(product.id));
        if (exists) commit('REMOVE_ITEM', { id: product.id });
        else commit('ADD_ITEM', { product: savedWishlistProduct(product) });
      },
      isWishlisted: (id) => items.some((item) => String(item.id) === String(id)),
      clearWishlist: () => commit('CLEAR_WISHLIST'),
    };
  }, [items]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
