import React, { useState, useEffect } from 'react';
import { 
  Coffee, TrendingUp, Clock, Clipboard, XCircle, 
  CheckCircle2, Trash2, Search, Filter, AlertCircle 
} from 'lucide-react';
import { Order } from '../types';
import { subscribeAllOrders, updateOrderStatus } from '../data/dbHelper';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminBackend() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Live countdown ticker interval (triggers re-render every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to all orders
  useEffect(() => {
    const unsubscribe = subscribeAllOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Calculate high-fidelity stats with defensive checks
  const totalSales = orders
    .filter((o) => o && o.status === 'completed')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const pendingCount = orders.filter((o) => o && o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o && o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o && o.status === 'ready').length;
  const completedCount = orders.filter((o) => o && o.status === 'completed').length;

  // Filter orders based on state and search
  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    
    const orderNumber = o.orderNumber || '';
    const userName = o.userName || '';
    const items = o.items || [];

    const matchesSearch = 
      orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      items.some(it => it && (it.productName || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Action status changes
  const handleTransitionStatus = async (orderId: string, nextStatus: Order['status']) => {
    try {
      await updateOrderStatus(orderId, nextStatus);
    } catch (e) {
      console.error('Error transitioning order status:', e);
    }
  };

  // Delete/Cancel helper
  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('您确定要永久删除此订单的数据库记录吗？此操作不可撤销。')) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (e) {
        console.error('Failed to delete order:', e);
      }
    }
  };

  // Clean all past demo orders to keep the workspace clean
  const handleCleanCompletedOrders = async () => {
    const completedOrCancelled = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
    if (completedOrCancelled.length === 0) {
      alert('没有已完成或已取消的历史订单可以清理。');
      return;
    }
    if (window.confirm(`确定要批量清理 ${completedOrCancelled.length} 个历史归档订单吗？这会精简您的数据库。`)) {
      try {
        for (const order of completedOrCancelled) {
          await deleteDoc(doc(db, 'orders', order.id));
        }
      } catch (e) {
        console.error('Batch clean failed:', e);
      }
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-sans">等待确认</span>;
      case 'preparing':
        return <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-sans animate-pulse">正在制作</span>;
      case 'ready':
        return <span className="bg-[#1A1A1A] border border-[#1A1A1A] text-white text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-sans">待取餐</span>;
      case 'completed':
        return <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-sans">已完成</span>;
      default:
        return <span className="bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-sans">已取消</span>;
    }
  };

  const getRemainingTimeText = (pickupTime?: string) => {
    if (!pickupTime) return { text: '顾客期待尽快完成取餐 ➔', isUrgent: false, isOverdue: false };
    try {
      const parts = pickupTime.split(' ');
      if (parts.length < 2) return { text: `⏰ 预约: ${pickupTime}`, isUrgent: false, isOverdue: false };
      
      const dayStr = parts[0]; // 今天, 明天, 后天
      const timeStr = parts[1]; // HH:MM
      const timeParts = timeStr.split(':');
      if (timeParts.length < 2) return { text: `⏰ 预约: ${pickupTime}`, isUrgent: false, isOverdue: false };
      
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      
      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(hour, minute, 0, 0);
      
      if (dayStr === '明天') {
        targetDate.setDate(now.getDate() + 1);
      } else if (dayStr === '后天') {
        targetDate.setDate(now.getDate() + 2);
      }
      
      const diffMs = targetDate.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 0) {
        return { 
          text: `🚨 严重超时：已延迟 ${Math.abs(diffMins)} 分钟！请加急制作`, 
          isUrgent: true, 
          isOverdue: true 
        };
      } else if (diffMins <= 15) {
        return { 
          text: `⚡ 紧急出杯：距自取仅剩 ${diffMins} 分钟！优先准备`, 
          isUrgent: true, 
          isOverdue: false 
        };
      } else if (diffMins <= 45) {
        return { 
          text: `⏱️ 调制时间：距自取还有 ${diffMins} 分钟，安排排单`, 
          isUrgent: false, 
          isOverdue: false 
        };
      } else {
        return { 
          text: `📅 预约排单：自取时间为 ${dayStr} ${timeStr} (约 ${Math.round(diffMins / 60)} 小时后)`, 
          isUrgent: false, 
          isOverdue: false 
        };
      }
    } catch (e) {
      return { text: `⏰ 预约自取: ${pickupTime}`, isUrgent: false, isOverdue: false };
    }
  };

  const renderCustomizationBadges = (customization: any, productId?: string) => {
    if (!customization) return null;
    
    const hasMilk = productId !== 'peachoolong' && productId !== 'espresso' && productId !== 'americano';
    const tempMap: any = { hot: '🔥 烫热', ice: '❄️ 冰镇', no_ice: '🧊 去冰' };
    const milkMap: any = { whole: '🥛 白小纯', oat: '🥛 悦鲜活' };
    const sweetMap: any = { regular: '标准糖', less: '少糖(7分)', half: '半糖(5分)', none: '无糖(0分)' };
    
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {customization.temperature && (
          <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold border rounded-none ${
            customization.temperature === 'hot' 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {tempMap[customization.temperature] || customization.temperature}
          </span>
        )}

        {hasMilk && customization.milk && (
          <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold border rounded-none ${
            customization.milk === 'oat'
              ? 'bg-[#006241]/10 text-[#006241] border-[#006241]/20' 
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {milkMap[customization.milk] || customization.milk}
          </span>
        )}

        {customization.sweetness && (
          <span className={`px-1.5 py-0.5 text-[9px] font-sans border rounded-none ${
            customization.sweetness === 'none' 
              ? 'bg-slate-50 text-slate-400 border-slate-200 font-bold' 
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {sweetMap[customization.sweetness] || customization.sweetness}
          </span>
        )}

        {customization.shots === 'extra' && (
          <span className="px-1.5 py-0.5 text-[9px] font-sans font-extrabold bg-amber-500 text-white border border-amber-500 animate-pulse rounded-none">
            ➕ 加一份浓缩
          </span>
        )}
      </div>
    );
  };

  const formatCustomizationText = (customization: any, productId?: string) => {
    const hasMilk = productId !== 'peachoolong' && productId !== 'espresso' && productId !== 'americano';
    const parts = [
      customization.temperature === 'hot' ? '热' : customization.temperature === 'ice' ? '冰' : '去冰',
      hasMilk && (customization.milk === 'whole' ? '白小纯' : '悦鲜活'),
      customization.sweetness === 'regular' ? '标糖' : customization.sweetness === 'less' ? '少糖' : customization.sweetness === 'half' ? '半糖' : '无糖',
      customization.shots === 'extra' && '加浓缩'
    ].filter(Boolean);
    return parts.join(' | ');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Metrics Dashboard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales */}
        <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-5 rounded-none flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">已完成交易额</span>
            <h4 className="text-2xl font-serif font-black text-[#1A1A1A] mt-1">¥{totalSales.toFixed(2)}</h4>
            <p className="text-[9px] text-emerald-600 mt-1 font-serif italic">实时销售数据同步中</p>
          </div>
          <div className="p-3 bg-[#F5F2EF] border border-[#EBE5DF]">
            <TrendingUp className="w-5 h-5 text-[#006241]" />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-5 rounded-none flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">等待接单</span>
            <h4 className="text-2xl font-mono font-bold text-amber-800 mt-1">{pendingCount}</h4>
            <p className="text-[9px] text-slate-400 mt-1 font-serif italic">需要及时确认处理</p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
        </div>

        {/* Brewing */}
        <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-5 rounded-none flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">正在制作中</span>
            <h4 className="text-2xl font-mono font-bold text-emerald-800 mt-1">{preparingCount}</h4>
            <p className="text-[9px] text-emerald-600 mt-1 font-serif italic">吧台咖啡师正在拼配</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100">
            <Coffee className="w-5 h-5 text-emerald-700 animate-bounce" />
          </div>
        </div>

        {/* Ready to Pickup */}
        <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-5 rounded-none flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">等待取杯</span>
            <h4 className="text-2xl font-mono font-bold text-[#1A1A1A] mt-1">{readyCount}</h4>
            <p className="text-[9px] text-slate-400 mt-1 font-serif italic">已摆放至取杯餐台</p>
          </div>
          <div className="p-3 bg-[#F5F2EF] border border-[#EBE5DF]">
            <Clipboard className="w-5 h-5 text-[#1A1A1A]" />
          </div>
        </div>

      </div>

      {/* Control Filters bar */}
      <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-5 rounded-none space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search box */}
          <div className="relative w-full lg:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索订单编号、顾客昵称、咖啡名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F5F2EF] border border-[#EBE5DF] rounded-none pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-[#1A1A1A] text-[#1A1A1A]"
            />
          </div>

          {/* Action Batch Clean */}
          <button
            onClick={handleCleanCompletedOrders}
            className="w-full lg:w-auto text-rose-700 hover:text-rose-900 text-[10px] font-sans tracking-wider border border-rose-200 hover:border-rose-300 bg-rose-50/30 px-4 py-2.5 rounded-none uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清理历史归档 ({completedCount} 个订单)
          </button>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F5F2EF]">
          {[
            { id: 'all', label: '全部订单', count: orders.length },
            { id: 'pending', label: '待确认', count: pendingCount, color: 'text-amber-800' },
            { id: 'preparing', label: '调制中', count: preparingCount, color: 'text-emerald-800' },
            { id: 'ready', label: '可取杯', count: readyCount, color: 'text-neutral-800 font-bold' },
            { id: 'completed', label: '已完成', count: completedCount, color: 'text-slate-500' },
            { id: 'cancelled', label: '已取消', count: orders.filter(o => o.status === 'cancelled').length, color: 'text-rose-500' },
          ].map((btn) => {
            const isSelected = statusFilter === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setStatusFilter(btn.id as any)}
                className={`px-3.5 py-1.5 border text-xs transition-colors font-sans cursor-pointer rounded-none flex items-center gap-2 ${
                  isSelected 
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' 
                    : 'bg-white border-[#EBE5DF] text-[#1A1A1A] hover:bg-[#F5F2EF]'
                }`}
              >
                <span className={isSelected ? 'text-white' : btn.color}>{btn.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#F5F2EF] text-slate-500 border border-[#EBE5DF]'
                }`}>
                  {btn.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Catalog */}
      {loading ? (
        <div className="text-center py-24 bg-[#FDFCFB] border border-[#EBE5DF]">
          <div className="w-6 h-6 border-2 border-[#EBE5DF] border-t-[#1A1A1A] rounded-none animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-serif italic text-slate-500">正在同步商家订单云端数据...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-[#FDFCFB] border border-[#EBE5DF] p-6">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h4 className="text-sm font-serif font-bold text-[#1A1A1A]">没有匹配的订单</h4>
          <p className="text-xs text-slate-500 mt-1 font-sans">请调整过滤条件或检索词。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map((order) => {
            const timeInfo = getRemainingTimeText(order.pickupTime);
            const isCompletedOrCancelled = order.status === 'completed' || order.status === 'cancelled';
            
            return (
              <div 
                key={order.id} 
                className={`bg-[#FDFCFB] border rounded-none p-0 flex flex-col justify-between transition-colors relative overflow-hidden ${
                  !isCompletedOrCancelled && timeInfo.isOverdue
                    ? 'border-red-500 shadow-md ring-1 ring-red-500/20'
                    : !isCompletedOrCancelled && timeInfo.isUrgent
                      ? 'border-amber-500 shadow-sm'
                      : 'border-[#EBE5DF] hover:border-[#1A1A1A]'
                }`}
              >
                
                {/* 1. Target Completion/Pickup Countdown Header Banner */}
                <div className={`px-5 py-3 border-b text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  isCompletedOrCancelled
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : timeInfo.isOverdue
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : timeInfo.isUrgent
                        ? 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                        : 'bg-[#006241]/10 border-[#006241]/20 text-[#006241]'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>⏱️</span>
                    <span>预计完成自取时间：</span>
                    <span className="font-mono underline decoration-dotted underline-offset-2">{order.pickupTime || '尽快自取'}</span>
                  </div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wide">
                    {isCompletedOrCancelled ? (
                      <span>✓ 订单已归档</span>
                    ) : (
                      <span>{timeInfo.text}</span>
                    )}
                  </div>
                </div>

                {/* Card Content Interior Body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Order Meta Header */}
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs bg-[#1A1A1A] text-white px-2.5 py-1 rounded-none">
                            #{order.orderNumber || '无单号'}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-2 uppercase">
                          下单时间: {order.createdAt ? new Date(order.createdAt).toLocaleString() : '未知时间'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-mono font-bold text-[#1A1A1A]">¥{(order.totalAmount || 0).toFixed(2)}</span>
                        <p className="text-[9px] text-slate-400 font-serif italic mt-0.5">实付总额</p>
                      </div>
                    </div>

                    {/* Customer Nickname Row */}
                    <div className="border-b border-dashed border-[#EBE5DF] pb-2.5 mb-3.5 flex items-center gap-2">
                      <span className="text-[10px] font-sans text-slate-400">顾客姓名:</span>
                      <span className="text-xs font-serif font-black text-[#1A1A1A] underline decoration-[#006241]/40 decoration-2 underline-offset-2">
                        {order.userName || '匿名顾客'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono ml-auto bg-[#F5F2EF] px-1.5 py-0.2">
                        ID: {order.userId ? (order.userId.length > 8 ? order.userId.substring(0, 8) : order.userId) : 'GUEST'}
                      </span>
                    </div>

                    {/* Items details list */}
                    <div className="space-y-3 mb-4">
                      <span className="block text-[9px] font-sans font-extrabold uppercase tracking-wider text-slate-400">☕ 制作规格拼配指令:</span>
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex gap-3 bg-slate-50/70 p-3 border border-[#EBE5DF] relative">
                          <img 
                            src={item?.image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=120'} 
                            alt={item?.productName || '咖啡'} 
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover border border-[#EBE5DF] flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center font-bold text-xs text-[#1A1A1A]">
                              <span className="truncate font-serif text-sm text-[#006241]">{item?.productName || '欣巴克特调'}</span>
                              <span className="font-mono text-xs bg-slate-200/60 border border-slate-300 px-2 py-0.5">数量: x{item?.quantity || 1}</span>
                            </div>
                            
                            {/* Render recipe badges here */}
                            {renderCustomizationBadges(item?.customization, item?.productId)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes box */}
                    {order.notes && (
                      <div className="bg-amber-50/60 p-3 border-l-4 border-amber-400 rounded-none mb-4 text-xs">
                        <span className="font-bold text-amber-950 block text-[10px] font-sans mb-1 uppercase tracking-wide">✍️ 顾客自备要求备注:</span>
                        <p className="text-amber-900 italic font-serif leading-relaxed text-[11px]">{order.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Operations menu */}
                  <div className="mt-4 pt-4 border-t border-[#EBE5DF] flex flex-wrap gap-2 items-center justify-between">
                    
                    {/* Secondary Delete Button */}
                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="text-slate-400 hover:text-rose-700 p-2 hover:bg-rose-50 transition-colors duration-150 rounded-none cursor-pointer"
                      title="彻底从数据库抹去此记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex gap-2">
                      {/* Cancel helper */}
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleTransitionStatus(order.id, 'cancelled')}
                          className="bg-white hover:bg-rose-50 border border-rose-300 hover:border-rose-400 text-rose-800 font-sans text-[10px] px-3.5 py-2.5 rounded-none uppercase transition-colors cursor-pointer"
                        >
                          取消订单
                        </button>
                      )}

                      {/* Primary Progression action */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleTransitionStatus(order.id, 'preparing')}
                          className="bg-[#006241] hover:bg-emerald-800 text-white font-sans text-[10px] font-bold px-5 py-2.5 rounded-none uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Coffee className="w-3.5 h-3.5 animate-pulse" />
                          确认接单并开始制作
                        </button>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleTransitionStatus(order.id, 'ready')}
                          className="bg-[#006241] hover:bg-emerald-800 text-white font-sans text-[10px] font-bold px-5 py-2.5 rounded-none uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm animate-bounce-subtle"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A880]" />
                          制作完成，一键发送取杯通知（设为待取餐）
                        </button>
                      )}

                      {order.status === 'ready' && (
                        <button
                          onClick={() => handleTransitionStatus(order.id, 'completed')}
                          className="bg-[#006241] hover:bg-emerald-800 text-white font-sans text-[10px] font-bold px-5 py-2.5 rounded-none uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          顾客已到店取餐结单
                        </button>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
