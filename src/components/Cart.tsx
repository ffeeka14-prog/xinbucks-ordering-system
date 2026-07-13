import React, { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, CreditCard, ChevronRight, FileText } from 'lucide-react';
import { CartItem } from '../types';
import TimeDialPicker from './TimeDialPicker';

interface CartProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: (notes: string, pickupTime: string) => void;
  loading: boolean;
}

export default function Cart({ cart, onUpdateQuantity, onRemoveItem, onCheckout, loading }: CartProps) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [pickupTime, setPickupTime] = useState('');

  const cartTotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);

  const formatCustomization = (item: CartItem) => {
    const parts = [
      item.product.category !== 'bakery' && (item.customization.temperature === 'hot' ? '热' : item.customization.temperature === 'ice' ? '冰' : '去冰'),
      item.product.category !== 'bakery' && item.product.id !== 'peachoolong' && item.product.id !== 'espresso' && item.product.id !== 'americano' && (item.customization.milk === 'whole' ? '白小纯牛乳' : '悦鲜活鲜牛乳'),
      item.product.category !== 'bakery' && (item.customization.sweetness === 'regular' ? '标糖' : item.customization.sweetness === 'less' ? '少糖' : item.customization.sweetness === 'half' ? '半糖' : '无糖'),
      item.customization.shots === 'extra' && '多浓缩'
    ].filter(Boolean);
    return parts.join(' | ');
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    onCheckout(notes, pickupTime);
    setNotes('');
    setShowNotes(false);
  };

  return (
    <div className="bg-[#FDFCFB] rounded-none p-6 border border-[#EBE5DF] flex flex-col gap-6 lg:sticky lg:top-6 z-10">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#EBE5DF] pb-4">
        <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-[0.2em] flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#006241]" />
          您的购物袋 ({cart.reduce((s, i) => s + i.quantity, 0)})
        </h3>
        {cart.length > 0 && (
          <span className="text-[9px] text-[#006241] font-sans uppercase tracking-wider font-bold">
            实时更新
          </span>
        )}
      </div>

      {/* Cart Items List */}
      {cart.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-[#F5F2EF] rounded-none flex items-center justify-center mb-4 border border-[#EBE5DF]">
            <ShoppingBag className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs font-serif italic text-slate-500">您的购物袋还是空的</p>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-2">挑选一款您心仪的特调开始吧</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {cart.map((item) => (
            <div key={item.id} className="flex gap-4 pb-4 border-b border-[#EBE5DF] last:border-b-0 last:pb-0">
              <img 
                src={item.product.image} 
                alt={item.product.name} 
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-none object-cover bg-slate-150 flex-shrink-0 border border-[#EBE5DF]"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-serif font-bold text-sm text-[#1A1A1A] truncate">{item.product.name}</h4>
                  <button 
                    onClick={() => onRemoveItem(item.id)}
                    className="text-slate-400 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-500 mt-1 font-serif italic truncate">
                  {formatCustomization(item)}
                </p>

                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs font-mono font-bold text-[#1A1A1A]">¥{item.totalPrice.toFixed(2)}</span>
                  
                  {/* Quantity Control */}
                  <div className="flex items-center border border-[#EBE5DF] rounded-none bg-white p-0.5 scale-90 origin-right">
                    <button 
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="p-1 text-slate-500 hover:bg-[#F5F2EF] transition-colors cursor-pointer"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="w-6 text-center text-[10px] font-mono font-bold text-[#1A1A1A]">{item.quantity}</span>
                    <button 
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="p-1 text-slate-500 hover:bg-[#F5F2EF] transition-colors cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#EBE5DF]">
          
          {/* Notes area */}
          <div>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-[#006241] flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <FileText className="w-3.5 h-3.5" />
              {notes ? '已填写订单备注' : '添加备注 / 特殊需求'}
              <ChevronRight className={`w-3 h-3 transition-transform ${showNotes ? 'rotate-90' : ''}`} />
            </button>
            
            {showNotes && (
              <textarea
                placeholder="在此输入您的饮品调制特殊需求..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full mt-2 bg-[#F5F2EF] border border-[#EBE5DF] rounded-none p-2.5 text-xs focus:outline-none focus:border-[#1A1A1A] resize-none text-[#1A1A1A]"
              ></textarea>
            )}
          </div>

          {/* Time Picker */}
          <TimeDialPicker onTimeChange={setPickupTime} />

          {/* Pricing summary */}
          <div className="space-y-2 bg-[#F5F2EF] p-4 rounded-none text-xs text-slate-600 border border-[#EBE5DF]">
            <div className="flex justify-between font-sans">
              <span>商品小计</span>
              <span className="font-mono font-bold text-[#1A1A1A]">¥{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-sans">
              <span>包装与配送</span>
              <span className="text-[#006241] font-mono font-bold">¥0.00 (包邮免费)</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#E1DBD5] text-sm items-center">
              <span className="font-bold text-[#1A1A1A] uppercase tracking-wider text-[11px]">应付总额</span>
              <span className="text-2xl font-serif italic font-black text-[#1A1A1A]">¥{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckoutClick}
            disabled={loading}
            className="w-full bg-[#006241] hover:bg-emerald-800 disabled:opacity-40 text-white font-bold py-4.5 px-4 rounded-none text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg active:translate-y-0.5"
          >
            <CreditCard className="w-4 h-4 text-[#C5A880]" />
            {loading ? '正在提交订单云端数据...' : '确认下单，预约到店自取 ➔'}
          </button>
        </div>
      )}

    </div>
  );
}
