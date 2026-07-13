import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Order, Review, UserProfile } from '../types';
import { DEFAULT_PRODUCTS } from './defaultProducts';

// 1. Products Initialization / Fetching
export async function fetchAndSeedProducts(): Promise<Product[]> {
  const fetchPromise = async () => {
    try {
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      const existingDocs = snapshot.docs.map(d => d.data() as Product);
      const needsSync = snapshot.empty || 
                        existingDocs.length !== DEFAULT_PRODUCTS.length ||
                        DEFAULT_PRODUCTS.some(p => {
                          const existing = existingDocs.find(ed => ed.id === p.id);
                          return !existing || existing.image !== p.image || existing.price !== p.price || existing.name !== p.name;
                        });
      
      if (needsSync) {
        console.log('Syncing products collection to match the strict menu...');
        // Delete all old documents first to ensure "别的全部删除"
        const deleteBatch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        
        // Write new ones
        const writeBatchObj = writeBatch(db);
        for (const prod of DEFAULT_PRODUCTS) {
          const docRef = doc(productsRef, prod.id);
          writeBatchObj.set(docRef, prod);
        }
        await writeBatchObj.commit();
        console.log('Seeding products complete!');
        return DEFAULT_PRODUCTS;
      } else {
        const products: Product[] = [];
        snapshot.forEach((doc) => {
          products.push(doc.data() as Product);
        });
        return products;
      }
    } catch (error) {
      console.error('Error fetching or seeding products:', error);
      // Return default local data as a fail-safe fallback
      return DEFAULT_PRODUCTS;
    }
  };

  const timeoutPromise = new Promise<Product[]>((resolve) => {
    setTimeout(() => {
      console.warn('fetchAndSeedProducts timed out (2.5s), falling back to local DEFAULT_PRODUCTS to prevent startup hanging.');
      resolve(DEFAULT_PRODUCTS);
    }, 2500);
  });

  return Promise.race([fetchPromise(), timeoutPromise]);
}

// 2. User Profile (Xinbucks Gold Card Rewards System)
export async function getOrCreateUserProfile(uid: string, defaultName = '欣会员'): Promise<UserProfile> {
  const fallbackProfile: UserProfile = {
    uid,
    name: defaultName,
    email: `${uid.substring(0, 8)}@xinbucks-club.com`,
    stars: 5,
    createdAt: new Date().toISOString()
  };

  const fetchPromise = async () => {
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      } else {
        const newProfile: UserProfile = {
          uid,
          name: defaultName,
          email: `${uid.substring(0, 8)}@xinbucks-club.com`,
          stars: 5, // give 5 welcome stars!
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      }
    } catch (error) {
      console.error('Error getting/creating user profile:', error);
      return fallbackProfile;
    }
  };

  const timeoutPromise = new Promise<UserProfile>((resolve) => {
    setTimeout(() => {
      console.warn('getOrCreateUserProfile timed out (2.5s), falling back to default local profile.');
      resolve(fallbackProfile);
    }, 2500);
  });

  return Promise.race([fetchPromise(), timeoutPromise]);
}

export async function updateUserStars(uid: string, additionalStars: number): Promise<number> {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const current = docSnap.data() as UserProfile;
      const updatedStars = (current.stars || 0) + additionalStars;
      await setDoc(userRef, { ...current, stars: updatedStars }, { merge: true });
      return updatedStars;
    }
    return 5;
  } catch (error) {
    console.error('Error updating user stars:', error);
    return 5;
  }
}

// 3. Coffee Orders
export async function createOrderInFirestore(order: Omit<Order, 'id'>): Promise<string> {
  try {
    const ordersRef = collection(db, 'orders');
    const newDocRef = doc(ordersRef); // generates a unique ID
    const fullOrder: any = {
      ...order,
      id: newDocRef.id
    };
    
    // Safely remove any undefined fields before writing to Firestore
    Object.keys(fullOrder).forEach((key) => {
      if (fullOrder[key] === undefined) {
        delete fullOrder[key];
      }
    });

    await setDoc(newDocRef, fullOrder as Order);
    
    // Add stars to user account (1 star for every ¥10 spent, rounded up)
    const starsEarned = Math.ceil(order.totalAmount / 10);
    await updateUserStars(order.userId, starsEarned);
    
    // Automatic simulation removed. States are now strictly manual and driven by the Merchant/Boss clicking the buttons in the Admin Backend!
    
    return newDocRef.id;
  } catch (error) {
    console.error('Error creating order in Firestore:', error);
    throw error;
  }
}

// Helper to listen to a user's orders in real-time
export function subscribeUserOrders(userId: string, callback: (orders: Order[]) => void) {
  const ordersRef = collection(db, 'orders');
  // Simple query: get orders matching current userId
  const q = query(ordersRef, where('userId', '==', userId));
  
  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Order;
      orders.push({
        ...data,
        id: data.id || doc.id
      });
    });
    // Sort by createdAt descending
    orders.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    callback(orders);
  }, (err) => {
    console.error('Real-time subscription failed:', err);
  });
}

// Helper to listen to ALL orders in real-time (for admin/merchant view)
export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  const ordersRef = collection(db, 'orders');
  return onSnapshot(ordersRef, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Order;
      orders.push({
        ...data,
        id: data.id || doc.id
      });
    });
    // Sort by createdAt descending
    orders.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    callback(orders);
  }, (err) => {
    console.error('Failed to subscribe to all orders:', err);
  });
}

// Helper to update order status (merchant or customer can update)
export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await setDoc(orderRef, { status }, { merge: true });
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

// Helper to add a review to an order in Firestore
export async function addOrderReviewInFirestore(orderId: string, rating: number, comment: string): Promise<void> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const review = {
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    await setDoc(orderRef, { review }, { merge: true });

    // Also populate individual product reviews for each item in this order
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      const orderData = orderSnap.data() as Order;
      const uniqueProductIds = Array.from(new Set((orderData.items || []).map(item => item.productId).filter(Boolean)));
      for (const prodId of uniqueProductIds) {
        try {
          await addReviewInFirestore(
            prodId,
            orderData.userName || '欣会员',
            rating,
            comment
          );
        } catch (subErr) {
          console.warn(`Failed to duplicate review for product ${prodId}:`, subErr);
        }
      }
    }
  } catch (error) {
    console.error('Failed to add order review:', error);
    throw error;
  }
}

// Simulate the coffee shop preparing and making the coffee!
function simulateOrderProgression(orderId: string) {
  const orderRef = doc(db, 'orders', orderId);
  
  // After 6 seconds, transition to 'preparing'
  setTimeout(async () => {
    try {
      const snap = await getDoc(orderRef);
      if (snap.exists() && snap.data().status === 'pending') {
        await setDoc(orderRef, { status: 'preparing' }, { merge: true });
      }
    } catch (e) { console.error(e); }
  }, 6000);

  // After 15 seconds, transition to 'ready' (ready for pick up!)
  setTimeout(async () => {
    try {
      const snap = await getDoc(orderRef);
      if (snap.exists() && snap.data().status === 'preparing') {
        await setDoc(orderRef, { status: 'ready' }, { merge: true });
      }
    } catch (e) { console.error(e); }
  }, 15000);
}

// 4. Product Reviews
export async function fetchReviewsForProduct(productId: string): Promise<Review[]> {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, where('productId', '==', productId));
    const snapshot = await getDocs(q);
    const reviews: Review[] = [];
    snapshot.forEach((doc) => {
      reviews.push(doc.data() as Review);
    });
    // Sort by date descending
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

export async function addReviewInFirestore(productId: string, userName: string, rating: number, comment: string): Promise<Review> {
  try {
    const reviewsRef = collection(db, 'reviews');
    const newDocRef = doc(reviewsRef);
    const review: Review = {
      id: newDocRef.id,
      productId,
      userName,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    await setDoc(newDocRef, review);
    return review;
  } catch (error) {
    console.error('Error adding review to Firestore:', error);
    throw error;
  }
}
