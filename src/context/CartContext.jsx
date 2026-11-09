import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { useAdmin } from './AdminContext';

const CartContext = createContext(null);

const STORAGE_KEY = 'suvarna_cart';
const MAX_CART_ITEM_QUANTITY = 10;

const normalizeProductId = (id) => String(id ?? '').trim();
const normalizeQuantity = (quantity) =>
  Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY, Math.floor(Number(quantity) || 0)));

const priceInPaise = (price) => Math.round((Number(price) || 0) * 100);
const isAvailableStock = (stock) => ['in stock', 'limited stock'].includes(String(stock || '').toLowerCase());
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
  unavailable: !isAvailableStock(product.stock),
  productIdentity: productIdentity(product),
});

const initialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { items: [] };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.items)) return { items: [] };
    const itemsById = new Map();
    parsed.items.forEach((item) => {
      const id = normalizeProductId(item.id);
      const qty = normalizeQuantity(item.qty);
      if (!id || !qty) return;
      const existing = itemsById.get(id);
      itemsById.set(id, existing
        ? { ...existing, qty: normalizeQuantity(existing.qty + qty) }
        : {
            ...item,
            id,
            qty,
            productIdentity: item.productIdentity || productIdentity(item),
          });
    });
    return { items: [...itemsById.values()] };
  } catch {
    return { items: [] };
  }
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, qty = 1 } = action;
      const quantity = normalizeQuantity(qty);
      if (!quantity) return state;
      const productData = productCartData(product);
      const id = normalizeProductId(product.id);
      if (!id) return state;
      const existing = state.items.find((item) => normalizeProductId(item.id) === id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            normalizeProductId(i.id) === id
              ? {
                  ...i,
                  id,
                  ...productData,
                  identityChanged: false,
                  qty: normalizeQuantity(i.qty + quantity),
                  priceChanged:
                    Boolean(i.priceChanged) || priceInPaise(i.price) !== priceInPaise(product.price),
                  previousPrice:
                    i.previousPrice ??
                    (priceInPaise(i.price) !== priceInPaise(product.price) ? i.price : undefined),
                }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            id,
            ...productData,
            qty: quantity,
            priceChanged: false,
          },
        ],
      };
    }
    case 'SYNC_PRODUCTS': {
      const productsById = new Map(action.products.map((product) => [normalizeProductId(product.id), product]));
      let changed = false;
      const items = state.items.map((item) => {
        const product = productsById.get(normalizeProductId(item.id));
        if (!product) {
          if (item.unavailable) return item;
          changed = true;
          return { ...item, unavailable: true };
        }

        const productData = productCartData(product);
        if (item.productIdentity && item.productIdentity !== productData.productIdentity) {
          if (item.unavailable && item.identityChanged) return item;
          changed = true;
          return { ...item, unavailable: true, identityChanged: true };
        }
        const priceChanged = priceInPaise(item.price) !== priceInPaise(productData.price);
        const nextItem = {
          ...item,
          id: normalizeProductId(product.id),
          ...productData,
          identityChanged: false,
          priceChanged: Boolean(item.priceChanged) || priceChanged,
          previousPrice: item.previousPrice ?? (priceChanged ? item.price : undefined),
          unavailable: productData.unavailable,
        };
        if (JSON.stringify(nextItem) !== JSON.stringify(item)) changed = true;
        return nextItem;
      });
      return changed ? { ...state, items } : state;
    }
    case 'ACKNOWLEDGE_PRICE_CHANGES':
      return {
        ...state,
        items: state.items.map((item) =>
          item.priceChanged ? { ...item, priceChanged: false, previousPrice: undefined } : item
        ),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => normalizeProductId(i.id) !== normalizeProductId(action.id)),
      };
    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items
          .map((i) =>
            normalizeProductId(i.id) === normalizeProductId(action.id) ? { ...i, qty: normalizeQuantity(action.qty) } : i
          )
          .filter((i) => i.qty > 0),
      };
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, initialState);
  const { storefrontProducts } = useAdmin();

  useEffect(() => {
    dispatch({ type: 'SYNC_PRODUCTS', products: storefrontProducts });
  }, [storefrontProducts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  const value = useMemo(
    () => ({
      items: state.items,
      addItem: (product, qty = 1) => dispatch({ type: 'ADD_ITEM', product, qty }),
      removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', id }),
      updateQty: (id, qty) => dispatch({ type: 'UPDATE_QTY', id, qty }),
      acknowledgePriceChanges: () => dispatch({ type: 'ACKNOWLEDGE_PRICE_CHANGES' }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    }),
    [state.items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within CartProvider');
  return ctx;
}
