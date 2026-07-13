import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Send, Calendar } from 'lucide-react';
import { Review } from '../types';
import { fetchReviewsForProduct, addReviewInFirestore } from '../data/dbHelper';

interface ProductReviewsProps {
  productId: string;
  userName: string;
}

export default function ProductReviews({ productId, userName }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [nickname, setNickname] = useState(userName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    setLoading(true);
    const data = await fetchReviewsForProduct(productId);
    setReviews(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      const addedReview = await addReviewInFirestore(
        productId,
        nickname.trim() || '匿名咖啡顾客',
        rating,
        comment.trim()
      );
      setReviews((prev) => [addedReview, ...prev]);
      setComment('');
      setRating(5);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="mt-8 border-t border-[#EBE5DF] pt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-[0.15em] flex items-center gap-1.5 font-sans">
          <MessageSquare className="w-4 h-4 text-[#006241]" />
          顾客特调点评 ({reviews.length})
        </h4>
        <div className="flex items-center gap-1 bg-[#F5F2EF] px-2.5 py-1 rounded-none border border-[#EBE5DF]">
          <Star className="w-3.5 h-3.5 fill-[#C5A880] text-[#C5A880]" />
          <span className="text-xs font-sans font-bold text-[#1A1A1A]">{averageRating} 综合评分</span>
        </div>
      </div>

      {/* Review Submission Form */}
      <form onSubmit={handleSubmit} className="bg-[#F5F2EF] p-4 rounded-none border border-[#EBE5DF] mb-6">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3 font-sans">发表您的特调心得 (实时同步)</p>
        
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          {/* Nickname input */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="您的评价昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-white border border-[#EBE5DF] rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          
          {/* Star selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1.5 font-sans">评分:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-0.5 hover:scale-115 transition-transform cursor-pointer"
              >
                <Star 
                  className={`w-4 h-4 ${
                    star <= rating 
                      ? 'fill-[#C5A880] text-[#C5A880]' 
                      : 'text-slate-300'
                  }`} 
                />
              </button>
            ))}
          </div>
        </div>

        {/* Comment Text */}
        <div className="relative">
          <textarea
            rows={2}
            placeholder="分享您对这款饮品/美食的喜爱，或说说您的定制心得..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full bg-white border border-[#EBE5DF] rounded-none px-3 py-2 text-xs focus:outline-none focus:border-[#1A1A1A] pr-10 resize-none text-[#1A1A1A]"
          ></textarea>
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="absolute right-2 bottom-2 bg-[#1A1A1A] text-white p-2 rounded-none hover:bg-[#006241] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Review List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1A1A1A] rounded-none animate-spin"></div>
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-slate-400 font-serif italic text-center py-6">
          这款好物还没有人发表过点评，快来抢占沙发吧！
        </p>
      ) : (
        <div className="space-y-4 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {reviews.map((rev) => (
            <div key={rev.id} className="border-b border-[#EBE5DF] pb-3 last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-serif font-bold text-[#1A1A1A]">{rev.userName}</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        className={`w-2.5 h-2.5 ${s <= rev.rating ? 'fill-[#C5A880] text-[#C5A880]' : 'text-slate-200'}`} 
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  {new Date(rev.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 border-l-2 border-[#C5A880] pl-3 py-1 italic font-serif leading-relaxed">
                {rev.comment}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
