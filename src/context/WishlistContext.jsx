import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'suvarna_wishlist';

const loadWishlist = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(loadWishlist);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  const value = useMemo(() => ({
    items,
    addItem: (product) => {
      setItems((current) => {
        if (current.some((item) => String(item.id) === String(product.id))) {
          return current;
        }

        return [
          ...current,
          {
            ...product,
            image: product.images?.[0] || product.image,
          },
        ];
      });
    },
    removeItem: (id) => {
      setItems((current) => current.filter((item) => String(item.id) !== String(id)));
    },
    toggleItem: (product) => {
      setItems((current) => {
        const exists = current.some((item) => String(item.id) === String(product.id));
        if (exists) {
          return current.filter((item) => String(item.id) !== String(product.id));
        }

        return [
          ...current,
          {
            ...product,
            image: product.images?.[0] || product.image,
          },
        ];
      });
    },
    isWishlisted: (id) => items.some((item) => String(item.id) === String(id)),
    clearWishlist: () => setItems([]),
  }), [items]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
