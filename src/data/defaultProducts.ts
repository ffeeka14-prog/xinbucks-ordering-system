import { Product } from '../types';

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'espresso',
    name: '意式浓缩',
    nameEn: 'Espresso',
    price: 8,
    description: '经典浓郁、极具张力的意式精粹，每一滴都散发着经典深度烘焙咖啡豆的纯正坚果与焦糖甜香。',
    category: 'coffee',
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'americano',
    name: '美式咖啡',
    nameEn: 'Caffè Americano',
    price: 10,
    description: '手作意式浓缩咖啡注入纯净热水，保留咖啡本真的醇厚口感与坚果风味，口感清爽回甘。',
    category: 'coffee',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'latte',
    name: '拿铁咖啡',
    nameEn: 'Caffè Latte',
    price: 15,
    description: '香醇意式浓缩咖啡完美融合新鲜高品质蒸牛奶，顶部覆以细致连绵的奶泡，温润香甜。',
    category: 'coffee',
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600'
  }
];
