import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'suvarna_cart';
const MAX_CART_ITEM_QUANTITY = 10;

const normalizeQuantity = (quantity) =>
  Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY, Math.floor(Number(quantity) || 0)));

const initialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { items: [] };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.items)) return { items: [] };
    return {
      items: parsed.items
        .map((item) => ({ ...item, qty: normalizeQuantity(item.qty) }))
        .filter((item) => item.qty > 0),
    };
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
      const existing = state.items.find((i) => i.id === product.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === product.id ? { ...i, qty: normalizeQuantity(i.qty + quantity) } : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            id: product.id,
            name: product.name,
            brand: product.brand,
            price: product.price,
            oldPrice: product.oldPrice,
            image: product.images?.[0] || product.image,
            qty: quantity,
          },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.id),
      };
    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items
          .map((i) =>
            i.id === action.id ? { ...i, qty: normalizeQuantity(action.qty) } : i
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
