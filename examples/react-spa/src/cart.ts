import { useState, useEffect } from 'react';
import { products } from './products';

// ================================================================
// Cart State (localStorage-backed with React subscriptions)
// ================================================================

export type CartItem = {
  productId: string;
  quantity: number;
};

type Listener = (cart: CartItem[]) => void;

const CART_KEY = 'relevaltech-cart';

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

let cart: CartItem[] = loadCart();
let listeners: Listener[] = [];

function notify() {
  const snapshot = [...cart];
  listeners.forEach(l => l(snapshot));
}

export function subscribeToCart(listener: Listener): () => void {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

export function getCart(): CartItem[] {
  return [...cart];
}

export function addToCart(productId: string, qty = 1): void {
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId, quantity: qty });
  }
  saveCart();
  notify();
}

export function removeFromCart(productId: string): void {
  cart = cart.filter(item => item.productId !== productId);
  saveCart();
  notify();
}

export function updateQuantity(productId: string, qty: number): void {
  const item = cart.find(i => i.productId === productId);
  if (item) {
    item.quantity = Math.max(1, Math.min(99, qty));
    saveCart();
    notify();
  }
}

export function clearCart(): void {
  cart = [];
  localStorage.removeItem(CART_KEY);
  notify();
}

export function getCartCount(): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
  return cart.reduce((sum, item) => {
    const p = products.find(prod => prod.id === item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);
}

// React hook
export function useCart() {
  const [items, setItems] = useState<CartItem[]>(getCart());

  useEffect(() => {
    return subscribeToCart(setItems);
  }, []);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => {
    const p = products.find(prod => prod.id === item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);

  return { items, count, total };
}
