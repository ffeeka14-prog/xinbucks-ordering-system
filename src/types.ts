export interface Product {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  description: string;
  category: string;
  image: string;
}

export interface CustomizationOption {
  size: 'tall' | 'grande' | 'venti';
  temperature: 'hot' | 'ice' | 'no_ice';
  milk: 'whole' | 'skim' | 'oat' | 'almond';
  sweetness: 'regular' | 'less' | 'half' | 'none';
  shots: 'standard' | 'extra';
}

export interface CartItem {
  id: string; // unique ID for this cart line (product id + config hash)
  product: Product;
  quantity: number;
  customization: CustomizationOption;
  totalPrice: number; // calculated item price * quantity
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: {
    productId: string;
    productName: string;
    productNameEn: string;
    quantity: number;
    price: number;
    customization: CustomizationOption;
    image: string;
  }[];
  totalAmount: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: string; // ISO date-time string
  orderNumber: string; // e.g., XBK-101
  notes?: string;
  pickupTime?: string; // scheduled pickup date/time (e.g. "明天 14:35")
  review?: {
    rating: number;
    comment: string;
    createdAt: string;
  };
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // ISO date-time string
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  stars: number; // 15 stars can redeem a mid-grade coffee!
  createdAt: string;
}
