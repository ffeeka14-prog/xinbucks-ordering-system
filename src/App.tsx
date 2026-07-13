import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Coffee, ShoppingBag, CheckCircle, RefreshCw, X, Sparkles, Compass } from 'lucide-react';
import { auth, db } from './firebase';
import { Product, CartItem, Order, UserProfile, CustomizationOption } from './types';
import { 
  fetchAndSeedProducts, 
  getOrCreateUserProfile, 
  createOrderInFirestore, 
  subscribeUserOrders
} from './data/dbHelper';
import Header from './components/Header';
import Menu from './components/Menu';
import CustomizationModal from './components/CustomizationModal';
import Cart from './components/Cart';
import OrderTracker from './components/OrderTracker';
import AdminBackend from './components/AdminBackend';

export default function App() {
  // Authentication & Profile States
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState('咖啡顾客');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [activeTab, setActiveTab] = useState<'order' | 'admin'>('order');

  // Admin Security States
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(() => {
    return localStorage.getItem('xinbucks_owner_auth') === 'true';
  });
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Business States
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Success Notification State
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 1. Monitor Authentication State
  useEffect(() => {
    let active = true;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (user) {
        setFirebaseUser(user);
        await syncUserProfile(user.uid);
      } else {
        // Fallback: If Firebase Authentication fails or anonymous sign-in is disabled,
        // we generate and use a persistent local client UID so that the app remains fully functional,
        // syncing user stars, profiles, and live orders seamlessly with the real Firestore backend!
        let localUid = localStorage.getItem('xinbucks_guest_uid');
        if (!localUid) {
          localUid = 'xbk_guest_' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('xinbucks_guest_uid', localUid);
        }
        
        const fallbackUser = { uid: localUid, isAnonymous: true } as any;
        setFirebaseUser(fallbackUser);
        await syncUserProfile(localUid);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, []);

  // 2. Fetch products and listen to orders once user profile is available
  useEffect(() => {
    async function loadCatalog() {
      // 优先从 localStorage 缓存中读取产品列表，提升页面秒开体验并降低 Firestore 查询消耗
      try {
        const cachedProducts = localStorage.getItem('xinbucks_products_cache');
        if (cachedProducts) {
          const parsedProducts = JSON.parse(cachedProducts);
          if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
            setProducts(parsedProducts);
            setLoading(false);
            
            // 静默后台加载最新菜单，并更新缓存以保证数据一致性 (Stale-While-Revalidate)
            fetchAndSeedProducts().then((freshProds) => {
              if (freshProds && freshProds.length > 0) {
                setProducts(freshProds);
                localStorage.setItem('xinbucks_products_cache', JSON.stringify(freshProds));
              }
            }).catch((err) => {
              console.warn('Background product sync failed:', err);
            });
            return;
          }
        }
      } catch (cacheErr) {
        console.warn('Failed to parse cached products:', cacheErr);
      }

      // 缓存未命中或解析异常时，调用 Firestore 数据库加载并填充缓存
      const prods = await fetchAndSeedProducts();
      setProducts(prods);
      setLoading(false);
      try {
        localStorage.setItem('xinbucks_products_cache', JSON.stringify(prods));
      } catch (err) {
        console.warn('Failed to store products to cache:', err);
      }
    }
    loadCatalog();
  }, []);

  // 3. Set up real-time subscription for current user orders
  useEffect(() => {
    if (!firebaseUser) return;
    
    // Subscribe to real-time changes in Firestore
    const unsubscribeOrders = subscribeUserOrders(firebaseUser.uid, (data) => {
      setOrders(data);
    });

    return () => unsubscribeOrders();
  }, [firebaseUser]);

  // Sync / Refresh Profile
  const syncUserProfile = async (uid: string, customName?: string) => {
    setSyncing(true);
    const userProfile = await getOrCreateUserProfile(uid, customName || nickname);
    setProfile(userProfile);
    setNickname(userProfile.name);
    setSyncing(false);
  };

  const handleUpdateNickname = async () => {
    if (!firebaseUser || !tempName.trim()) return;
    setSyncing(true);
    await syncUserProfile(firebaseUser.uid, tempName.trim());
    setIsEditingName(false);
  };

  // Add Item to Cart
  const handleAddToCart = (product: Product, customization: CustomizationOption, qty: number) => {
    // Generate a unique item hash for matching duplicate cart items with exact customizations
    const customizationHash = `${product.id}-${customization.size}-${customization.temperature}-${customization.milk}-${customization.sweetness}-${customization.shots}`;

    // Calculate item unit price (no size premium anymore)
    let unitPrice = product.price;
    
    // Milk premium: 悦鲜活 (mapped to 'oat') is +¥5, 白小纯 is +0
    if (product.id !== 'peachoolong' && product.id !== 'espresso' && product.id !== 'americano' && customization.milk === 'oat') {
      unitPrice += 5;
    }
    
    // Extra shot premium
    if (customization.shots === 'extra') {
      unitPrice += 4;
    }

    const totalPrice = unitPrice * qty;

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.id === customizationHash);
      if (existingIdx > -1) {
        // Increment quantity
        const updated = [...prevCart];
        const currentQty = updated[existingIdx].quantity + qty;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: currentQty,
          totalPrice: unitPrice * currentQty
        };
        return updated;
      } else {
        // Add new item
        return [...prevCart, {
          id: customizationHash,
          product,
          quantity: qty,
          customization,
          totalPrice
        }];
      }
    });
  };

  // Update Cart Quantities
  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          // Calculate unit price again
          const unitPrice = item.totalPrice / item.quantity;
          return {
            ...item,
            quantity: newQty,
            totalPrice: unitPrice * newQty
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  // Remove Cart Item
  const handleRemoveCartItem = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  // Handle Order Checkout
  const handleCheckout = async (notes: string, pickupTime: string) => {
    if (!firebaseUser || cart.length === 0) return;

    setCheckoutLoading(true);
    
    // Generate a random 3-digit Xinbucks-style order number
    const orderNum = `XBK-${Math.floor(Math.random() * 900) + 100}`;
    const cartTotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);

    const itemsForOrder = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productNameEn: item.product.nameEn,
      quantity: item.quantity,
      price: item.totalPrice / item.quantity,
      customization: item.customization,
      image: item.product.image
    }));

    const orderData: Omit<Order, 'id'> = {
      userId: firebaseUser.uid,
      userName: nickname,
      items: itemsForOrder,
      totalAmount: cartTotal,
      status: 'pending',
      createdAt: new Date().toISOString(),
      orderNumber: orderNum,
      notes: notes.trim() || undefined,
      pickupTime: pickupTime
    };

    try {
      setCheckoutError(null);
      const orderId = await createOrderInFirestore(orderData);
      
      const completedOrder: Order = {
        ...orderData,
        id: orderId
      };

      // Set success notification
      setSuccessOrder(completedOrder);
      
      // Clear cart
      setCart([]);

      // Sync user profile
      await syncUserProfile(firebaseUser.uid);

    } catch (e: any) {
      console.error('Checkout failed:', e);
      setCheckoutError(e?.message || '网络连接或数据库响应异常，请检查配置或重试。');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleVerifyPin = () => {
    if (pinInput === '8888') {
      setIsAdminAuthorized(true);
      localStorage.setItem('xinbucks_owner_auth', 'true');
      setShowAdminPinModal(false);
      setPinInput('');
      setPinError(false);
      setActiveTab('admin');
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans antialiased text-[#1A1A1A]">
      
      {/* Header with View Toggler */}
      <Header 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminAuthorized={isAdminAuthorized}
        onOpenAdminPin={() => {
          setPinInput('');
          setPinError(false);
          setShowAdminPinModal(true);
        }}
        onLockAdmin={() => {
          setIsAdminAuthorized(false);
          localStorage.removeItem('xinbucks_owner_auth');
          setActiveTab('order');
        }}
        loading={syncing || loading} 
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#FDFCFB]">
          <div className="w-8 h-8 border-2 border-[#EBE5DF] border-t-[#1A1A1A] rounded-none animate-spin mb-4"></div>
          <p className="text-xs font-serif italic text-slate-500">正在连线欣巴克云端工坊...</p>
        </div>
      ) : (
        <main className="max-w-7xl w-full mx-auto p-4 md:p-8 flex-1 flex flex-col gap-8">
          
          {/* User Custom Greeting Panel - Clean, Star-Free */}
          {profile && activeTab === 'order' && (
            <div className="bg-[#FDFCFB] rounded-none p-5 border border-[#EBE5DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-4">
                <div className="bg-[#F5F2EF] text-[#1A1A1A] p-2.5 border border-[#EBE5DF] rounded-none">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="输入您的咖啡昵称..."
                        className="bg-white border border-[#EBE5DF] rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A]"
                      />
                      <button 
                        onClick={handleUpdateNickname}
                        className="bg-[#1A1A1A] text-white text-[10px] font-sans tracking-wider px-3.5 py-1.5 rounded-none hover:bg-black uppercase cursor-pointer"
                      >
                        保存
                      </button>
                      <button 
                        onClick={() => setIsEditingName(false)}
                        className="text-slate-500 text-[10px] font-sans italic hover:underline cursor-pointer ml-1"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-sm font-sans font-bold text-[#1A1A1A] flex items-center gap-2.5">
                      您好，尊敬的咖啡熟客 <span className="text-[#C5A880] underline underline-offset-4">{nickname}</span>
                      <button 
                        onClick={() => { setTempName(nickname); setIsEditingName(true); }}
                        className="text-[9px] uppercase tracking-widest font-sans text-slate-400 hover:text-[#1A1A1A] underline cursor-pointer"
                      >
                        [ 修改昵称 ]
                      </button>
                    </h3>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1 font-sans">
                    为您精心预留的手作特调咖啡方案，一键下单，即时在后台同步。
                  </p>
                </div>
              </div>
              <div className="text-[10px] bg-[#006241]/5 text-[#006241] px-3.5 py-2 border border-[#006241]/25 rounded-none font-sans uppercase tracking-wider flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                <span className="w-1.5 h-1.5 bg-[#006241] animate-ping"></span>
                云端数据库已连通
              </div>
            </div>
          )}

          {/* Conditional View Rendering */}
          {activeTab === 'order' ? (
            /* Core Content Grid - Coffee POS view */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Col: Menu Catalog (66% width) */}
              <div className="lg:col-span-2">
                <Menu 
                  products={products} 
                  onSelectProduct={(p) => setSelectedProduct(p)} 
                  userName={nickname}
                />
              </div>

              {/* Right Col: Checkout & Order Tracker (33% width) */}
              <div className="flex flex-col gap-8">
                
                {/* Checkout Cart */}
                <Cart 
                  cart={cart} 
                  onUpdateQuantity={handleUpdateCartQuantity}
                  onRemoveItem={handleRemoveCartItem}
                  onCheckout={handleCheckout}
                  loading={checkoutLoading}
                />

                {/* Order Status Tracker */}
                <OrderTracker 
                  orders={orders} 
                  onRefresh={() => firebaseUser && syncUserProfile(firebaseUser.uid)}
                />

              </div>

            </div>
          ) : (
            /* Admin/Merchant View */
            <AdminBackend />
          )}
        </main>
      )}

      {/* Product Customization Modal Overlay */}
      {selectedProduct && (
        <CustomizationModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          userName={nickname}
        />
      )}

      {/* Checkout Success Floating Card Notification */}
      {successOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] max-w-sm w-full rounded-none p-8 text-center border border-[#EBE5DF] relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setSuccessOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 bg-[#F5F2EF] border border-[#EBE5DF] rounded-none flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[#006241]" />
            </div>

            <h3 className="text-base font-sans font-bold text-[#1A1A1A] uppercase tracking-wider">☕ 订单提交成功</h3>
            <p className="text-[10px] text-slate-500 mt-1 font-sans">
              您的预计取餐单号：<span className="font-mono font-bold text-[#1A1A1A] text-xs bg-[#F5F2EF] border border-[#EBE5DF] px-2.5 py-1 rounded-none ml-1">{successOrder.orderNumber}</span>
            </p>
            
            <p className="text-xs text-slate-600 mt-5 font-sans leading-relaxed">
              您的特调手作方案已传达至吧台。咖啡师正在为您专属准备。您可通过“实时订单追踪”栏目即时查看制作进程。
            </p>

            {successOrder.pickupTime && (
              <div className="mt-6 p-4 bg-[#006241]/5 border border-[#006241]/25 rounded-none text-xs text-left">
                <div className="flex items-center gap-1.5 text-[#006241] font-bold uppercase tracking-wider font-sans mb-1.5 text-[10px]">
                  <span>📅</span>
                  预计预约自取时间
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                  已为您成功预约取餐时间：<span className="font-bold text-[#006241] font-mono text-xs ml-1 bg-white border border-[#006241]/20 px-2 py-0.5">{successOrder.pickupTime}</span>。请准时凭单号到店取杯。
                </p>
              </div>
            )}

            <button
              onClick={() => setSuccessOrder(null)}
              className="mt-6 w-full bg-[#1A1A1A] hover:bg-black text-white font-bold py-3.5 rounded-none text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
            >
              继续浏览咖啡
            </button>
          </div>
        </div>
      )}

      {/* Checkout Error Floating Card Notification */}
      {checkoutError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] max-w-sm w-full rounded-none p-8 text-center border border-rose-200 relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setCheckoutError(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-none flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl font-bold">⚠️</span>
            </div>

            <h3 className="text-base font-sans font-bold text-[#1A1A1A] uppercase tracking-wider">⚠️ 提交订单失败</h3>
            
            <p className="text-xs text-slate-600 mt-4 font-sans leading-relaxed text-left">
              向云端提交咖啡定制订单时遇到异常。请检查您的网络连接并重试。
            </p>
            <div className="mt-3 text-left">
              <span className="font-bold text-red-900 block text-[10px] font-sans">错误诊断详情:</span>
              <p className="font-mono text-rose-700 bg-rose-50/50 border border-rose-150 p-2.5 mt-1 text-[10px] break-all leading-normal">
                {checkoutError}
              </p>
            </div>

            <button
              onClick={() => setCheckoutError(null)}
              className="mt-6 w-full bg-rose-800 hover:bg-rose-900 text-white font-bold py-3.5 rounded-none text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* Admin Passcode Modal Overlay */}
      {showAdminPinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] max-w-sm w-full rounded-none p-8 border border-[#EBE5DF] relative animate-in zoom-in duration-200 text-center">
            <button 
              onClick={() => {
                setShowAdminPinModal(false);
                setPinInput('');
                setPinError(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 bg-[#F5F2EF] border border-[#EBE5DF] rounded-none flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🔑</span>
            </div>

            <h3 className="text-sm font-sans font-bold text-[#1A1A1A] uppercase tracking-wider">商家后台安全验证</h3>
            <p className="text-[10px] text-slate-500 mt-2 font-sans leading-relaxed">
              为了保障您的商业隐私与订单安全，请验证老板/管理员访问口令后进入管理系统。
            </p>

            <div className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans mb-1.5 font-bold">商家专享口令 PIN</label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="请输入 4 位数字密码..."
                  className={`w-full bg-[#F5F2EF] border ${pinError ? 'border-red-400 focus:border-red-500' : 'border-[#EBE5DF] focus:border-[#1A1A1A]'} rounded-none p-3 text-center tracking-widest text-lg font-mono focus:outline-none text-[#1A1A1A]`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyPin();
                    }
                  }}
                />
                {pinError && (
                  <p className="text-[10px] text-red-600 font-sans mt-1.5 text-center">❌ 验证口令错误，请重新输入</p>
                )}
              </div>

              <div className="text-[9px] text-slate-400 bg-[#F5F2EF] p-2 text-center border border-[#EBE5DF] font-sans">
                💡 演示提示：老板默认验证口令为 <span className="font-bold text-[#006241]">8888</span>
              </div>

              <button
                onClick={handleVerifyPin}
                className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold py-3.5 rounded-none text-[10px] uppercase tracking-widest transition-colors cursor-pointer text-center"
              >
                验证口令并登入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#F5F2EF] text-[#1A1A1A] py-10 px-4 text-center mt-12 border-t border-[#EBE5DF] text-xs font-sans">
        <p>© 2026 欣巴克咖啡 (Xinbucks Coffee) • 实时云端自取服务平台</p>
        <div className="mt-2 text-[10px] text-slate-400 font-mono not-italic uppercase tracking-wider flex items-center justify-center gap-3">
          <span>欣巴克智能收银POS系统</span>
          <span>•</span>
          <button 
            onClick={() => {
              if (isAdminAuthorized) {
                setActiveTab(activeTab === 'admin' ? 'order' : 'admin');
              } else {
                setPinInput('');
                setPinError(false);
                setShowAdminPinModal(true);
              }
            }}
            className="text-[#006241] hover:underline cursor-pointer font-bold"
          >
            {isAdminAuthorized ? (activeTab === 'admin' ? '➔ 返回点单POS' : '➔ 进入商家管理后台') : '🔑 商家入口(验证口令)'}
          </button>
        </div>
      </footer>

    </div>
  );
}
