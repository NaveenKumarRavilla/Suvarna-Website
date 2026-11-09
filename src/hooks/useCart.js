import { useMemo } from 'react';
import { useCartContext } from '../context/CartContext';

export const FREE_DELIVERY_THRESHOLD = 50000;
export const DELIVERY_FEE = 499;

export default function useCart() {
  const {
    items,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    acknowledgePriceChanges,
  } = useCartContext();

  const totals = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotalPaise = items.reduce((sum, item) => sum + Math.round((Number(item.price) || 0) * 100) * item.qty, 0);
    const savingsPaise = items.reduce(
      (sum, item) => sum + (item.oldPrice && item.oldPrice > item.price
        ? (Math.round((Number(item.oldPrice) || 0) * 100) - Math.round((Number(item.price) || 0) * 100)) * item.qty
        : 0),
      0
    );
    const deliveryPaise =
      subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_THRESHOLD * 100 ? 0 : DELIVERY_FEE * 100;
    const subtotal = subtotalPaise / 100;
    const savings = savingsPaise / 100;
    const delivery = deliveryPaise / 100;
    const total = (subtotalPaise + deliveryPaise) / 100;
    return { count, subtotal, savings, delivery, total };
  }, [items]);

  return { items, addItem, removeItem, updateQty, clearCart, acknowledgePriceChanges, ...totals };
}
