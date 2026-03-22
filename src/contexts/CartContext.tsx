import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { CartItem, MenuItem, SelectedCustomization } from '../types';

interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { menuItem: MenuItem; quantity: number; customizations: SelectedCustomization[] } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

function calculateItemTotal(item: MenuItem, quantity: number, customizations: SelectedCustomization[]): number {
  const customizationTotal = customizations.reduce((sum, c) => sum + c.price, 0);
  return (item.price + customizationTotal) * quantity;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  let newItems: CartItem[];

  switch (action.type) {
    case 'ADD_ITEM': {
      const { menuItem, quantity, customizations } = action.payload;
      const newItem: CartItem = {
        id: `${menuItem.id}-${Date.now()}`,
        menu_item: menuItem,
        quantity,
        customizations,
        total_price: calculateItemTotal(menuItem, quantity, customizations),
      };
      newItems = [...state.items, newItem];
      break;
    }
    case 'REMOVE_ITEM':
      newItems = state.items.filter((item) => item.id !== action.payload);
      break;
    case 'UPDATE_QUANTITY': {
      newItems = state.items.map((item) =>
        item.id === action.payload.id
          ? {
              ...item,
              quantity: action.payload.quantity,
              total_price: calculateItemTotal(item.menu_item, action.payload.quantity, item.customizations),
            }
          : item
      );
      break;
    }
    case 'CLEAR_CART':
      newItems = [];
      break;
    case 'LOAD_CART':
      newItems = action.payload;
      break;
    default:
      return state;
  }

  const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
  const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);

  return { items: newItems, subtotal, itemCount };
}

interface CartContextType extends CartState {
  addItem: (menuItem: MenuItem, quantity: number, customizations: SelectedCustomization[]) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], subtotal: 0, itemCount: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('supreme-waffle-cart');
    if (saved) {
      try {
        const items = JSON.parse(saved) as CartItem[];
        dispatch({ type: 'LOAD_CART', payload: items });
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('supreme-waffle-cart', JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (menuItem: MenuItem, quantity: number, customizations: SelectedCustomization[]) => {
    dispatch({ type: 'ADD_ITEM', payload: { menuItem, quantity, customizations } });
  };

  const removeItem = (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id });

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    }
  };

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  return (
    <CartContext.Provider value={{ ...state, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
