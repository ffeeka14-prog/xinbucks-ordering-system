import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Star } from 'lucide-react';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { fetchReviewsForProduct } from '../data/dbHelper';
import ProductReviews from './ProductReviews';

interface MenuProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  userName?: string;
}

// Sub-component to fetch and render rating summary dynamically
function ProductRatingSummary({ productId }: { productId: string }) {
  const [ratingInfo, setRatingInfo] = useState<{ avg: string; count: number } | null>(null);

  useEffect(() => {
    async function loadRating() {
      try {
        const reviews = await fetchReviewsForProduct(productId);
        if (reviews && reviews.length > 0) {
          const avg = (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);
          setRatingInfo({ avg, count: reviews.length });
        } else {
          setRatingInfo({ avg: '5.0', count: 0 });
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadRating();

    // Poll every 5s to keep ratings fresh when reviews are submitted
    const interval = setInterval(loadRating, 5000);
    return () => clearInterval(interval);
  }, [productId]);

  if (!ratingInfo) return <div className="h-4 w-24 bg-[#F5F2EF] animate-pulse mt-1.5"></div>;

  return (
    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-sans mt-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-2.5 h-2.5 ${
              s <= Math.round(parseFloat(ratingInfo.avg))
                ? 'fill-[#C5A880] text-[#C5A880]'
                : 'text-slate-200'
            }`}
          />
        ))}
      </div>
      <span className="font-bold text-[#1A1A1A] ml-1">{ratingInfo.avg}</span>
      <span>({ratingInfo.count}条熟客点评)</span>
    </div>
  );
}

export default function Menu({ products, onSelectProduct, userName }: MenuProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Filter products based on search query
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.nameEn && p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="flex-1">
      {/* Search Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#EBE5DF] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-[#1A1A1A] flex items-center gap-2">
            点单推荐 <Sparkles className="w-5 h-5 text-[#C5A880] fill-[#C5A880]/10" />
          </h2>
          <p className="text-xs text-slate-500 font-serif italic mt-1.5">
            挑选您的专属手作特调咖啡。您的订单数据将实时同步至商家后台。
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="搜索咖啡..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FDFCFB] border border-[#EBE5DF] rounded-none py-2.5 pl-10 pr-4 text-xs font-sans placeholder-slate-400 focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-all duration-200 text-[#1A1A1A]"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-[#FDFCFB] rounded-none p-12 text-center border border-[#EBE5DF]">
          <p className="text-slate-400 font-serif italic mb-4">未找到符合搜索条件的商品</p>
          <button 
            onClick={() => { setSearchQuery(''); }} 
            className="text-xs text-[#006241] uppercase tracking-widest font-bold hover:underline"
          >
            重置筛选条件
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              onClick={() => onSelectProduct(prod)}
              className="group bg-[#FDFCFB] rounded-none overflow-hidden border border-[#EBE5DF] hover:border-[#1A1A1A] transition-all duration-250 flex flex-col cursor-pointer"
            >
              {/* Image Container with Badges */}
              <div className="relative aspect-[4/3] overflow-hidden bg-[#F5F2EF] flex-shrink-0 border-b border-[#EBE5DF]">
                <img
                  src={prod.image}
                  alt={prod.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                
                {/* Category pill */}
                <span className="absolute top-3 left-3 bg-[#1A1A1A] text-white text-[9px] font-sans uppercase tracking-[0.15em] px-3 py-1 rounded-none shadow-xs">
                  ☕ 手作咖啡系列
                </span>
              </div>

              {/* Product Info */}
              <div className="p-5 flex flex-col flex-1 justify-between bg-[#FDFCFB]">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1A1A1A] group-hover:text-[#006241] transition-colors duration-150 line-clamp-1">
                    {prod.name}
                  </h3>
                  {/* Rating summary below product name */}
                  <ProductRatingSummary productId={prod.id} />
                  
                  <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed min-h-[32px] font-sans">
                    {prod.description}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#EBE5DF]">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xs font-mono font-medium text-[#1A1A1A]">¥</span>
                    <span className="text-xl font-serif font-black text-[#1A1A1A] ml-0.5">{prod.price.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedProductId(expandedProductId === prod.id ? null : prod.id);
                      }}
                      className="bg-[#F5F2EF] hover:bg-[#EBE5DF] text-[#1A1A1A] text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 border border-[#EBE5DF] cursor-pointer transition-colors"
                    >
                      {expandedProductId === prod.id ? '收起点评' : '查看点评'}
                    </button>
                    <span className="bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-none group-hover:bg-[#006241] transition-colors duration-150">
                      开始定制
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Reviews Panel */}
              <AnimatePresence>
                {expandedProductId === prod.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={(e) => e.stopPropagation()} // Prevent card click trigger
                    className="border-t border-[#EBE5DF] bg-[#FDFCFB] px-5 pb-5 overflow-hidden"
                  >
                    <ProductReviews productId={prod.id} userName={userName || '欣会员'} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
