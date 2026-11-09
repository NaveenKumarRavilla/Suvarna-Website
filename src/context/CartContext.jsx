import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAdmin } from './AdminContext';

const CartContext = createContext(null);

const STORAGE_KEY = 'suvarna_cart';
const SEED_KEY = `${STORAGE_KEY}_seed`;
const OPERATION_PREFIX = `${STORAGE_KEY}:operation:`;
const MAX_CART_ITEM_QUANTITY = 10;

const normalizeProductId = (id) => String(id ?? '').trim();
const normalizeQuantity = (quantity) =>
  Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY, Math.floor(Number(quantity) || 0)));

const priceInPaise = (price) => Math.round((Number(price) || 0) * 100);
const isAvailableStock = (product) => {
  const stock = String(product.stock || '').toLowerCase();
  if (!['in stock', 'limited stock'].includes(stock)) return false;
  return stock !== 'limited stock' ||
    (Number.isInteger(Number(product.stockQuantity)) && Number(product.stockQuantity) > 0);
};
const productIdentity = (product) => [product.name, product.brand, product.category]
  .map((value) => String(value || '').trim().toLowerCase())
  .join('|');

const productCartData = (product) => ({
  name: product.name,
  brand: product.brand,
  category: product.category,
  price: Number(product.price),
  oldPrice: Number(product.oldPrice) || Number(product.price),
  image: product.images?.[0] || product.image || '',
  stock: product.stock || '',
  stockQuantity: product.stockQuantity == null
    ? null
    : Number.isInteger(Number(product.stockQuantity)) ? Number(product.stockQuantity) : null,
  productIdentity: productIdentity(product),
});

const isUnavailable = (item, quantity) =>
  !isAvailableStock(item) ||
  (item.stockQuantity != null && quantity > item.stockQuantity);

const normalizeCartItems = (items) => {
  if (!Array.isArray(items)) return [];
  const itemsById = new Map();
  items.forEach((item) => {
    const id = normalizeProductId(item.id);
    const qty = normalizeQuantity(item.qty);
    if (!id || !qty) return;
    const existing = itemsById.get(id);
    itemsById.set(id, existing
      ? { ...existing, qty: normalizeQuantity(existing.qty + qty) }
      : (() => {
          const removedFromCatalogue = Boolean(item.removedFromCatalogue || item.identityChanged);
          return {
            ...item,
            id,
            qty,
            productIdentity: item.productIdentity || productIdentity(item),
            removedFromCatalogue,
            unavailable: Boolean(item.unavailable || removedFromCatalogue),
          };
        })());
  });
  return [...itemsById.values()].map(({ identityChanged, ...item }) => item);
};

const parseCart = (serialized) => {
  try {
    const parsed = JSON.parse(serialized);
    return normalizeCartItems(parsed?.items);
  } catch {
    return [];
  }
};

const getCartSeed = () => {
  try {
    const savedSeed = localStorage.getItem(SEED_KEY);
    if (savedSeed != null) return parseCart(savedSeed);
    const legacy = parseCart(localStorage.getItem(STORAGE_KEY));
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

const applyCartOperation = (items, operation) => {
  switch (operation.type) {
    case 'ADD_ITEM': {
      const { product, qty = 1 } = operation;
      const quantity = normalizeQuantity(qty);
      const id = normalizeProductId(product?.id);
      if (!quantity || !id) return items;
      const existing = items.find((item) => normalizeProductId(item.id) === id);
      if (existing?.removedFromCatalogue) return items;
      const productData = productCartData(product);
      if (existing) {
        return items.map((item) => {
          if (normalizeProductId(item.id) !== id) return item;
          const nextQty = normalizeQuantity(item.qty + quantity);
          const priceChanged = priceInPaise(item.price) !== priceInPaise(product.price);
          return {
            ...item,
            id,
            ...productData,
            qty: nextQty,
            unavailable: isUnavailable(productData, nextQty),
            removedFromCatalogue: false,
            priceChanged: Boolean(item.priceChanged) || priceChanged,
            previousPrice: item.previousPrice ?? (priceChanged ? item.price : undefined),
          };
        });
      }
      return [
        ...items,
        {
          id,
          ...productData,
          qty: quantity,
          unavailable: isUnavailable(productData, quantity),
          removedFromCatalogue: false,
          priceChanged: false,
        },
      ];
    }
    case 'REMOVE_ITEM':
      return items.filter((item) => normalizeProductId(item.id) !== normalizeProductId(operation.id));
    case 'UPDATE_QTY':
      return items
        .map((item) => {
          if (normalizeProductId(item.id) !== normalizeProductId(operation.id)) return item;
          const qty = normalizeQuantity(item.qty + Number(operation.delta || 0));
          return {
            ...item,
            qty,
            unavailable: item.removedFromCatalogue || isUnavailable(item, qty),
          };
        })
        .filter((item) => item.qty > 0);
    case 'ACKNOWLEDGE_PRICE_CHANGES':
      return items.map((item) =>
        item.priceChanged ? { ...item, priceChanged: false, previousPrice: undefined } : item
      );
    case 'CLEAR_CART':
      return [];
    default:
      return items;
  }
};

const loadInitialState = () => {
  const seed = getCartSeed() || [];
  const operations = readOperations();
  return {
    items: (operations || []).reduce(applyCartOperation, seed),
  };
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'APPLY_OPERATION':
      return { ...state, items: applyCartOperation(state.items, action.operation) };
    case 'REPLAY_OPERATIONS':
      return { ...state, items: action.operations.reduce(applyCartOperation, action.seed) };
    case 'SYNC_PRODUCTS': {
      const productsById = new Map(action.products.map((product) => [normalizeProductId(product.id), product]));
      let changed = false;
      const items = state.items.map((item) => {
        const product = productsById.get(normalizeProductId(item.id));
        if (!product) {
          if (item.removedFromCatalogue) return item;
          changed = true;
          return { ...item, removedFromCatalogue: true, unavailable: true };
        }

        const productData = productCartData(product);
        if (item.productIdentity && item.productIdentity !== productData.productIdentity) {
          if (item.removedFromCatalogue) return item;
          changed = true;
          return { ...item, removedFromCatalogue: true, unavailable: true };
        }
        const priceChanged = priceInPaise(item.price) !== priceInPaise(productData.price);
        const nextItem = {
          ...item,
          id: normalizeProductId(product.id),
          ...productData,
          removedFromCatalogue: false,
          priceChanged: Boolean(item.priceChanged) || priceChanged,
          previousPrice: item.previousPrice ?? (priceChanged ? item.price : undefined),
          unavailable: isUnavailable(productData, item.qty),
        };
        if (JSON.stringify(nextItem) !== JSON.stringify(item)) changed = true;
        return nextItem;
      });
      return changed ? { ...state, items } : state;
    }
    default:
      return state;
  }
}

const createTabId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Fall through when the browser does not expose crypto in this context.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadInitialState);
  const { storefrontProducts } = useAdmin();
  const itemsRef = useRef(state.items);
  const tabId = useRef(createTabId());
  const sequence = useRef(0);
  const logicalClock = useRef(0);
  const productsRef = useRef(storefrontProducts);
  itemsRef.current = state.items;
  productsRef.current = storefrontProducts;

  useEffect(() => {
    dispatch({ type: 'SYNC_PRODUCTS', products: storefrontProducts });
  }, [storefrontProducts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
    } catch {
      /* storage unavailable */
    }
  }, [state.items]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== null && !event.key.startsWith(OPERATION_PREFIX)) return;
      const operations = readOperations();
      if (!operations) return;
      const seed = getCartSeed();
      if (!seed) return;
      logicalClock.current = operations.reduce(
        (clock, operation) => Math.max(clock, operation.clock),
        logicalClock.current
      );
      dispatch({ type: 'REPLAY_OPERATIONS', seed, operations });
      dispatch({ type: 'SYNC_PRODUCTS', products: productsRef.current });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => {
    const commit = (type, details = {}, validate = null) => {
      const seed = getCartSeed();
      const savedOperations = readOperations();
      if (seed && savedOperations) {
        const latestClock = savedOperations.reduce(
          (clockValue, operation) => Math.max(clockValue, operation.clock),
          logicalClock.current
        );
        logicalClock.current = latestClock;
        itemsRef.current = savedOperations.reduce(applyCartOperation, seed);
        dispatch({ type: 'REPLAY_OPERATIONS', seed, operations: savedOperations });
      }
      if (validate && !validate(itemsRef.current)) return false;
      const clock = Math.max(Date.now(), logicalClock.current + 1);
      logicalClock.current = clock;
      sequence.current += 1;
      const id = `${tabId.current}-${sequence.current}`;
      const operation = { id, clock, type, ...details };
      itemsRef.current = applyCartOperation(itemsRef.current, operation);
      try {
        localStorage.setItem(`${OPERATION_PREFIX}${id}`, JSON.stringify(operation));
      } catch {
        /* storage unavailable */
      }
      dispatch({ type: 'APPLY_OPERATION', operation });
      return true;
    };

    return {
      items: state.items,
      addItem: (product, qty = 1) => {
        const id = normalizeProductId(product?.id);
        const currentProduct = productsRef.current.find(
          (candidate) => normalizeProductId(candidate.id) === id
        );
        const requestedQty = Math.floor(Number(qty) || 0);
        if (
          !currentProduct ||
          !isAvailableStock(currentProduct) ||
          productIdentity(currentProduct) !== productIdentity(product) ||
          requestedQty < 1 ||
          requestedQty > MAX_CART_ITEM_QUANTITY
        ) return false;
        return commit('ADD_ITEM', {
          product: { id, ...productCartData(currentProduct) },
          qty: requestedQty,
        }, (latestItems) => {
          const existing = latestItems.find((item) => normalizeProductId(item.id) === id);
          if (existing?.removedFromCatalogue) return false;
          const nextQuantity = (existing?.qty || 0) + requestedQty;
          return nextQuantity <= MAX_CART_ITEM_QUANTITY
            && (currentProduct.stockQuantity == null || nextQuantity <= Number(currentProduct.stockQuantity));
        });
      },
      removeItem: (id) => commit('REMOVE_ITEM', { id }),
      updateQty: (id, qty) => {
        const item = state.items.find((candidate) => normalizeProductId(candidate.id) === normalizeProductId(id));
        if (!item) return;
        const nextQty = normalizeQuantity(qty);
        const delta = nextQty - item.qty;
        if (delta) commit('UPDATE_QTY', { id, delta });
      },
      acknowledgePriceChanges: () => commit('ACKNOWLEDGE_PRICE_CHANGES'),
      clearCart: () => commit('CLEAR_CART'),
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within CartProvider');
  return ctx;
}
