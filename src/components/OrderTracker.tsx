import React from 'react';
import { Clock, CheckCircle, Package, Compass, Volume2, VolumeX, Star, MessageSquare } from 'lucide-react';
import { Order } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { addOrderReviewInFirestore } from '../data/dbHelper';

interface OrderTrackerProps {
  orders: Order[];
  onRefresh: () => void;
}

// Custom sound synthesizer using Web Audio API
const playStatusUpdateSound = (status: Order['status']) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (status === 'preparing') {
      // Gentle warm synth chime (espresso machine starting!)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.exponentialRampToValueAtTime(392.00, now + 0.15); // G4
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (status === 'ready') {
      // Elegant multi-tone success chime (ready at pickup counter!)
      const now = ctx.currentTime;
      
      // Note 1 (A5 - 880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.1, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);
      
      // Note 2 (C#6 - 1109Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1109, now + 0.12);
      gain2.gain.setValueAtTime(0.1, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.8);
      
      // Note 3 (E6 - 1318Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1318, now + 0.24);
      gain3.gain.setValueAtTime(0.12, now + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.24);
      osc3.stop(now + 1.2);
    } else if (status === 'completed') {
      // Gentle cash register / coffee handoff ring
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (error) {
    console.warn('Audio feedback blocked or failed:', error);
  }
};

export default function OrderTracker({ orders, onRefresh }: OrderTrackerProps) {
  const activeOrders = (orders || []).filter((o) => o && o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = (orders || []).filter((o) => o && (o.status === 'completed' || o.status === 'cancelled'));

  // State for active order reviews
  const [reviewingOrderId, setReviewingOrderId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<number>(5);
  const [comment, setComment] = React.useState<string>('');
  const [submittingReviewId, setSubmittingReviewId] = React.useState<string | null>(null);
  const [reviewError, setReviewError] = React.useState<string | null>(null);

  const handleSubmitReview = async (orderId: string) => {
    if (!comment.trim()) return;
    setSubmittingReviewId(orderId);
    setReviewError(null);
    try {
      await addOrderReviewInFirestore(orderId, rating, comment.trim());
      setReviewingOrderId(null);
      setComment('');
      setRating(5);
      onRefresh();
    } catch (err: any) {
      console.error('Error submitting order review:', err);
      setReviewError(err?.message || '提交评价失败，请重试。');
    } finally {
      setSubmittingReviewId(null);
    }
  };

  // Read sound preference from localStorage
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('xinbucks_sound_enabled');
      return stored !== 'false';
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('xinbucks_sound_enabled', String(next));
      } catch {}
      return next;
    });
  };

  // Monitor status updates for audio notifications
  const prevStatusesRef = React.useRef<{ [orderId: string]: Order['status'] }>({});

  React.useEffect(() => {
    const currentStatuses: { [orderId: string]: Order['status'] } = {};
    let soundPlayedThisBatch = false;

    (orders || []).forEach((order) => {
      if (!order || !order.id) return;
      currentStatuses[order.id] = order.status;

      const prevStatus = prevStatusesRef.current[order.id];
      // Play audio notification if status changed (and it's not the initial load)
      if (prevStatus !== undefined && prevStatus !== order.status) {
        if (!soundPlayedThisBatch && soundEnabled) {
          playStatusUpdateSound(order.status);
          soundPlayedThisBatch = true;
        }
      }
    });

    prevStatusesRef.current = currentStatuses;
  }, [orders, soundEnabled]);

  const handlePickUp = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, { status: 'completed' }, { merge: true });
      onRefresh();
    } catch (e) {
      console.error('Error completing order pickup:', e);
    }
  };

  const getStatusInfo = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return { label: '已下单 ⏳', desc: '手作工坊正在安排，等待咖啡师确认...', color: 'text-amber-800 bg-[#FDFCFB] border-amber-300', step: 1 };
      case 'preparing':
        return { label: '特调调制中 ☕', desc: '咖啡师正在精心研磨、萃取并手工调制中...', color: 'text-emerald-800 bg-[#FDFCFB] border-emerald-300 animate-pulse', step: 2 };
      case 'ready':
        return { label: '请到柜台取杯 🎉', desc: '您的专属手调饮品已制作完毕，在吧台静候您。', color: 'text-[#1A1A1A] bg-[#FDFCFB] border-[#1A1A1A] border-2', step: 3 };
      case 'completed':
        return { label: '已取杯 ✅', desc: '美味到手，开启优雅的午后时光。', color: 'text-slate-600 bg-slate-50 border-slate-100', step: 4 };
      default:
        return { label: '已取消 ❌', desc: '该订单已取消。', color: 'text-rose-800 bg-[#FDFCFB] border-rose-300', step: 0 };
    }
  };

  return (
    <div className="bg-[#FDFCFB] rounded-none p-6 border border-[#EBE5DF] flex flex-col gap-6">
      
      {/* Active Orders Trackers */}
      <div>
        <div className="flex justify-between items-center mb-4 border-b border-[#F5F2EF] pb-3">
          <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-[0.2em] flex items-center gap-2 font-sans">
            <Clock className="w-4 h-4 text-[#006241]" />
            实时订单制作进度跟踪
          </h3>
          <button
            onClick={toggleSound}
            title={soundEnabled ? "关闭声音提示" : "开启声音提示"}
            className="p-1.5 rounded-none hover:bg-[#F5F2EF] text-slate-500 hover:text-[#1A1A1A] transition-all flex items-center gap-1 cursor-pointer"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#006241]" />
                <span className="text-[9px] font-mono uppercase text-[#006241] font-bold">音效开启</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">静音</span>
              </>
            )}
          </button>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-[#F5F2EF] p-8 rounded-none text-center border border-[#EBE5DF]">
            <Compass className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-xs font-serif italic text-slate-600">当前没有制作中的订单</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">点击上方菜单，定制专属饮品</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {activeOrders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                return (
                  <motion.div 
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className={`p-5 rounded-none border transition-colors duration-500 ${statusInfo.color}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs bg-[#1A1A1A] text-white px-2.5 py-1 rounded-none font-mono">
                            #{order.orderNumber || '无单号'}
                          </span>
                          <span className="text-xs font-serif font-bold">{statusInfo.label}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-sans mt-1.5 uppercase">
                          下单时间: {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '未知时间'}
                        </p>
                        {order.pickupTime && (
                          <p className="text-[9px] text-[#006241] font-sans mt-1 uppercase font-bold">
                            预约自取: {order.pickupTime}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-mono font-bold text-[#1A1A1A]">¥{(order.totalAmount || 0).toFixed(2)}</span>
                    </div>

                    {/* Modern Static 2-Step Progress Tracker */}
                    <div className="my-5 bg-[#F5F2EF] border border-[#EBE5DF] p-4 relative flex flex-col justify-center h-[96px] select-none">
                      {/* Progress Line Track */}
                      <div className="relative h-1 bg-slate-200/80 mx-10">
                        {/* Smooth Filling Bar */}
                        <motion.div 
                          className="absolute h-full left-0 bg-[#006241]"
                          initial={{ width: '0%' }}
                          animate={{ 
                            width: (order.status === 'ready') ? '100%' : '50%' 
                          }}
                          transition={{ type: 'spring', stiffness: 100, damping: 18 }}
                        />

                        {/* Nodes */}
                        <div className="absolute inset-0 flex justify-between items-center -mt-3.5">
                          {/* Node 1: 已接单 */}
                          <div className="flex flex-col items-center relative -ml-8 w-16">
                            <motion.div
                              animate={{
                                scale: (order.status === 'pending' || order.status === 'preparing') ? [1, 1.05, 1] : 1,
                              }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 relative z-10 ${
                                (order.status === 'pending' || order.status === 'preparing')
                                  ? 'bg-[#006241] text-white border-[#006241] shadow-[0_0_8px_rgba(0,98,65,0.3)]'
                                  : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                              }`}
                            >
                              {order.status === 'ready' ? '✓' : '☕'}
                            </motion.div>
                            <span className={`text-[10px] font-bold mt-1 font-sans ${order.status !== 'ready' ? 'text-[#006241]' : 'text-slate-500'}`}>
                              已接单
                            </span>
                            <span className="text-[8px] text-slate-400 font-sans mt-0.5 whitespace-nowrap">
                              {order.status === 'pending' ? '订单已确认' : order.status === 'preparing' ? '饮品调制中' : '调制完成'}
                            </span>
                          </div>

                          {/* Node 2: 待取餐 */}
                          <div className="flex flex-col items-center relative -mr-8 w-16">
                            <motion.div
                              animate={{
                                scale: order.status === 'ready' ? [1, 1.1, 1] : 1,
                              }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 relative z-10 ${
                                order.status === 'ready'
                                  ? 'bg-[#C5A880] text-white border-[#C5A880] shadow-[0_0_10px_rgba(197,168,128,0.5)]'
                                  : 'bg-white text-slate-300 border-slate-200'
                              }`}
                            >
                              {order.status === 'ready' ? '🔔' : '📦'}
                            </motion.div>
                            <span className={`text-[10px] font-bold mt-1 font-sans ${order.status === 'ready' ? 'text-[#C5A880]' : 'text-slate-400'}`}>
                              待取餐
                            </span>
                            <span className="text-[8px] text-slate-400 font-sans mt-0.5 whitespace-nowrap">
                              {order.status === 'ready' ? '请凭号取杯' : '准备就绪后提示'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 font-serif italic leading-relaxed mt-2 mb-4">
                      {statusInfo.desc}
                    </p>

                    {/* Details summary */}
                    <div className="bg-white p-3 rounded-none border border-[#EBE5DF] text-xs text-slate-700 space-y-1.5">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="font-sans">
                            {item?.productName || '欣巴克特调'} 
                            <span className="text-[9px] text-slate-500 ml-2 font-serif italic">
                              ({[
                                item?.customization?.temperature === 'hot' ? '热' : item?.customization?.temperature === 'ice' ? '冰' : '去冰',
                                item?.customization?.milk && item.productId !== 'peachoolong' && item.productId !== 'espresso' && item.productId !== 'americano' && (item.customization.milk === 'whole' ? '白小纯' : '悦鲜活'),
                                item?.customization?.sweetness === 'regular' ? '标糖' : item?.customization?.sweetness === 'less' ? '少糖' : item?.customization?.sweetness === 'half' ? '半糖' : '无糖',
                                item?.customization?.shots === 'extra' && '加浓缩'
                              ].filter(Boolean).join(' • ')})
                            </span>
                          </span>
                          <span className="font-mono font-semibold text-slate-600">x{item?.quantity || 1}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions (Pick up) */}
                    <button
                      onClick={() => handlePickUp(order.id)}
                      className={`mt-4 w-full font-bold py-3.5 px-4 rounded-none text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer border ${
                        order.status === 'ready'
                          ? 'bg-[#006241] border-[#006241] hover:bg-emerald-800 text-white animate-pulse'
                          : 'bg-[#1A1A1A] border-[#1A1A1A] hover:bg-[#2D2926] text-white'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4 text-[#C5A880]" />
                      我已拿到饮品，确认已取杯
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Historical Orders */}
      <div>
        <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 font-sans border-t border-[#EBE5DF] pt-6">
          <Package className="w-4 h-4 text-slate-500" />
          历史消费账单记录
        </h3>

        {pastOrders.length === 0 ? (
          <p className="text-xs font-serif italic text-slate-400 text-center py-4">无历史消费订单</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
            <AnimatePresence initial={false}>
              {pastOrders.map((order) => (
                <motion.div 
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-white rounded-none border border-[#EBE5DF] text-xs flex flex-col gap-2 hover:border-[#1A1A1A] transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#1A1A1A]">#{order.orderNumber || '无单号'}</span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '未知日期'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#1A1A1A]">¥{(order.totalAmount || 0).toFixed(2)}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-serif italic line-clamp-1 border-b border-dashed border-[#EBE5DF] pb-2">
                    {(order.items || []).map(it => `${it?.productName || '特调咖啡'}x${it?.quantity || 1}`).join(', ')}
                  </div>
                  
                  <div className="flex justify-between items-center text-[9px] font-mono mt-0.5">
                    <span className="text-slate-500 font-bold flex items-center gap-1 bg-[#F5F2EF] border border-[#EBE5DF] px-2 py-0.5">
                      {order.pickupTime ? `📅 预约: ${order.pickupTime}` : '⚡ 现场即取'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`uppercase tracking-wider font-semibold ${order.status === 'completed' ? 'text-[#006241]' : 'text-rose-500'}`}>
                        {order.status === 'completed' ? '已完成取餐' : '已取消'}
                      </span>
                      {order.status === 'completed' && !order.review && (
                        <button
                          onClick={() => {
                            setReviewingOrderId(order.id);
                            setRating(5);
                            setComment('');
                            setReviewError(null);
                          }}
                          className="bg-[#006241] text-white font-bold px-2.5 py-0.5 border border-[#006241] hover:bg-[#004d32] transition-colors flex items-center gap-0.5 cursor-pointer text-[9px]"
                        >
                          <Star className="w-2.5 h-2.5 fill-white text-white" />
                          评价
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Review Form */}
                  <AnimatePresence>
                    {reviewingOrderId === order.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#F5F2EF] p-3 mt-1.5 border border-[#EBE5DF] flex flex-col gap-2.5 overflow-hidden"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-600 font-sans uppercase">给本单咖啡打个分吧</span>
                          {/* Star rating selector */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className="p-0.5 hover:scale-115 transition-transform cursor-pointer"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    star <= rating
                                      ? 'fill-[#C5A880] text-[#C5A880]'
                                      : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="relative">
                          <textarea
                            rows={2}
                            placeholder="和大家分享您的咖啡口感、温度或定制搭配建议吧..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full bg-white border border-[#EBE5DF] rounded-none px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#1A1A1A] pr-12 resize-none text-[#1A1A1A] font-sans"
                          />
                          <button
                            type="button"
                            disabled={submittingReviewId === order.id || !comment.trim()}
                            onClick={() => handleSubmitReview(order.id)}
                            className="absolute right-2 bottom-2 bg-[#1A1A1A] text-white p-1.5 rounded-none hover:bg-[#006241] transition-colors disabled:opacity-40 cursor-pointer text-[9px] font-bold font-sans uppercase tracking-wider"
                          >
                            {submittingReviewId === order.id ? '提交中' : '发布'}
                          </button>
                        </div>
                        
                        {reviewError && (
                          <p className="text-[10px] text-rose-600 font-sans">{reviewError}</p>
                        )}
                        
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingOrderId(null);
                              setComment('');
                              setReviewError(null);
                            }}
                            className="text-[9px] text-slate-400 hover:text-black font-mono uppercase cursor-pointer"
                          >
                            [ 取消评价 ]
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Display existing review */}
                  {order.review && (
                    <div className="bg-[#FDFCFB] p-2.5 mt-2 border border-dashed border-[#EBE5DF]">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-2.5 h-2.5 ${s <= order.review!.rating ? 'fill-[#C5A880] text-[#C5A880]' : 'text-slate-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(order.review.createdAt).toLocaleDateString()} 已评价
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-serif italic border-l border-[#C5A880] pl-2 py-0.5 leading-relaxed">
                        "{order.review.comment}"
                      </p>
                    </div>
                  )}

                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}

