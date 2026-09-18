import { useMemo } from 'react';
import { useCartContext } from '../context/CartContext';

export const FREE_DELIVERY_THRESHOLD = 50000;
export const DELIVERY_FEE = 499;

export default function useCart() {
  const { items, addItem, removeItem, updateQty, clearCart } = useCartContext();

  const totals = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const savings = items.reduce(
      (sum, i) => sum + (i.oldPrice && i.oldPrice > i.price ? (i.oldPrice - i.price) * i.qty : 0),
      0
    );
    const delivery =
      subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const total = subtotal + delivery;
    return { count, subtotal, savings, delivery, total };
  }, [items]);

  return { items, addItem, removeItem, updateQty, clearCart, ...totals };
}
