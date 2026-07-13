import React, { useState } from 'react';
import { X, ShoppingBag, Plus, Minus } from 'lucide-react';
import { Product, CustomizationOption } from '../types';
import ProductReviews from './ProductReviews';

interface CustomizationModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, custom: CustomizationOption, qty: number) => void;
  userName: string;
}

export default function CustomizationModal({ product, onClose, onAddToCart, userName }: CustomizationModalProps) {
  const [size, setSize] = useState<CustomizationOption['size']>('grande');
  const [temperature, setTemperature] = useState<CustomizationOption['temperature']>('ice');
  const [milk, setMilk] = useState<CustomizationOption['milk']>('whole');
  const [sweetness, setSweetness] = useState<CustomizationOption['sweetness']>('regular');
  const [shots, setShots] = useState<CustomizationOption['shots']>('standard');
  const [quantity, setQuantity] = useState(1);

  // Calculate customized unit price
  const calculateUnitPrice = (): number => {
    let base = product.price;
    
    // No size difference anymore

    // Milk markup: 悦鲜活 (mapped to oat) is +¥5.00, 白小纯 is +¥0.00
    if (milk === 'oat') base += 5;

    // Extra shot markup
    if (shots === 'extra') base += 4;

    return base;
  };

  const unitPrice = calculateUnitPrice();
  const totalPrice = unitPrice * quantity;

  // Handle Add to Cart
  const handleAddToCart = () => {
    onAddToCart(product, { size, temperature, milk, sweetness, shots }, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div 
        className="bg-[#FDFCFB] w-full max-w-2xl rounded-none overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in duration-200 border border-[#EBE5DF]"
        id="customization-modal"
      >
        {/* Modal Header */}
        <div className="relative h-48 bg-[#F5F2EF] flex-shrink-0 border-b border-[#EBE5DF]">
          <img 
            src={product.image} 
            alt={product.name} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/40 hover:bg-[#1A1A1A] text-white p-2 rounded-none backdrop-blur-md transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="absolute bottom-4 left-6 text-white">
            <h3 className="text-2xl font-serif font-black">{product.name}</h3>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* Customization Options */}
          <div className="space-y-6">

            {/* 1. Temperature */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3 font-mono">1. 选择饮品温度 / TEMPERATURE</span>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'ice', label: '冰 (标准冰)', desc: '标准制冰量' },
                  { id: 'no_ice', label: '去冰 (微凉)', desc: '温润微凉口感' },
                  { id: 'hot', label: '热 (热气腾腾)', desc: '现调热饮风味' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemperature(t.id as any)}
                    className={`border p-3 rounded-none text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                      temperature === t.id 
                        ? 'border-[#1A1A1A] bg-[#F5F2EF] ring-1 ring-[#1A1A1A]' 
                        : 'border-[#EBE5DF] hover:border-slate-400 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#1A1A1A]">{t.label}</span>
                    <span className="text-[9px] text-slate-500 mt-1.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Milk */}
            {product.id !== 'peachoolong' && product.id !== 'espresso' && product.id !== 'americano' && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3 font-mono">2. 专属调制奶类 / MILK BASE</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'whole', label: '白小纯牛乳', desc: '经典纯正口感', price: '免费' },
                    { id: 'oat', label: '悦鲜活鲜牛乳', desc: '高品质鲜奶', price: '+¥5.00' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMilk(m.id as any)}
                      className={`border p-3 rounded-none text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                        milk === m.id 
                          ? 'border-[#1A1A1A] bg-[#F5F2EF] ring-1 ring-[#1A1A1A]' 
                          : 'border-[#EBE5DF] hover:border-slate-400 bg-white'
                      }`}
                    >
                      <span className="text-xs font-bold text-[#1A1A1A] block truncate">{m.label}</span>
                      <span className="text-[9px] text-slate-500 font-mono mt-1.5 truncate">{m.desc} • {m.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Sweetness */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3 font-mono">3. 甜度口味调节 / SWEETNESS</span>
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { id: 'regular', label: '标准糖 (推荐)' },
                  { id: 'less', label: '少糖 (七分甜)' },
                  { id: 'half', label: '半糖 (五分甜)' },
                  { id: 'none', label: '无糖 (不加糖)' }
                ].map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => setSweetness(sw.id as any)}
                    className={`border py-3 px-1 rounded-none text-center text-xs font-bold transition-all duration-150 cursor-pointer ${
                      sweetness === sw.id 
                        ? 'border-[#1A1A1A] bg-[#F5F2EF] ring-1 ring-[#1A1A1A]' 
                        : 'border-[#EBE5DF] hover:border-slate-400 text-slate-700 bg-white'
                    }`}
                  >
                    {sw.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Espresso Shots */}
            {product.category === 'coffee' && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3 font-mono">4. 意式浓缩特调份数 / ESPRESSO SHOTS</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'standard', label: '标准浓缩份数 (标准风味)', desc: '大师原配方' },
                    { id: 'extra', label: '多加一份精选浓缩 (+¥4.00)', desc: '咖啡香愈发浓烈' }
                  ].map((sh) => (
                    <button
                      key={sh.id}
                      onClick={() => setShots(sh.id as any)}
                      className={`border p-3 rounded-none text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                        shots === sh.id 
                          ? 'border-[#1A1A1A] bg-[#F5F2EF] ring-1 ring-[#1A1A1A]' 
                          : 'border-[#EBE5DF] hover:border-slate-400 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#1A1A1A]">{sh.label}</span>
                    <span className="text-[9px] text-slate-500 mt-1.5">{sh.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Connected Firestore reviews inside the scrollable container */}
        <div className="border-t border-[#EBE5DF] pt-4 px-6 pb-6">
          <ProductReviews productId={product.id} userName={userName} />
        </div>

      </div>

        {/* Modal Footer (Price summary & checkout button inside customization-modal) */}
        <div className="border-t border-[#EBE5DF] p-6 bg-[#F5F2EF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-baseline gap-1 text-[#1A1A1A]">
              <span className="text-xs font-mono font-medium">¥</span>
              <span className="text-2xl font-serif italic font-black ml-0.5">{totalPrice.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500 font-mono ml-2">({quantity} 杯)</span>
            </div>
            
            {/* Config summary string */}
            <p className="text-[10px] text-slate-500 font-serif italic mt-1 truncate max-w-[220px] md:max-w-[320px]">
              当前定制方案: {temperature === 'hot' ? '热' : temperature === 'ice' ? '冰' : '去冰'}
              {product.id !== 'peachoolong' && product.id !== 'espresso' && product.id !== 'americano' && ` • ${milk === 'whole' ? '白小纯牛乳' : '悦鲜活鲜牛乳'}`}
              {` • ${sweetness === 'regular' ? '标糖' : sweetness === 'less' ? '少糖' : sweetness === 'half' ? '半糖' : '无糖'}`}
              {product.category === 'coffee' && ` • ${shots === 'extra' ? '多一份浓缩' : '标准浓缩'}`}
            </p>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* Quantity Selector */}
            <div className="flex items-center border border-[#EBE5DF] rounded-none bg-white p-1">
              <button 
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="p-1 rounded-none text-slate-500 hover:bg-[#F5F2EF] transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-mono font-bold text-[#1A1A1A]">{quantity}</span>
              <button 
                onClick={() => setQuantity((prev) => prev + 1)}
                className="p-1 rounded-none text-slate-500 hover:bg-[#F5F2EF] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="bg-[#006241] hover:bg-emerald-800 text-white py-3.5 px-6 rounded-none text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-all duration-150 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              加入购物车
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
