import React, { useState, useEffect, useCallback } from 'react';
import { reviewService, Review } from '../../services/reviewService';
import { getProfile } from '../../services/auth';
import toast from '../../services/toast';

const VendorReviewTab: React.FC = () => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [itemsPerPage] = useState(5);
    const ITEMS_PER_PAGE = itemsPerPage;

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            const profile = await getProfile();
            if (profile && profile.profileId) {
                // Fetch a good chunk of reviews to allow local pagination
                const data = await reviewService.getReviewsByVendorId(profile.profileId, 1, 100);
                setReviews(data);
            } else {
                const data = await reviewService.getVendorReviews();
                setReviews(data);
            }
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
            toast.error('Không thể tải đánh giá.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleReply = async (reviewId: string | number) => {
        if (!replyText.trim()) {
            toast.error('Vui lòng nhập nội dung phản hồi.');
            return;
        }

        try {
            setSubmitting(true);
            const success = await reviewService.updateVendorReply(reviewId, replyText);
            if (success) {
                toast.success('Phản hồi thành công!');
                setReplyingTo(null);
                setReplyText('');
                fetchReviews();
            }
        } catch (error: any) {
            toast.error(error.message || 'Phản hồi thất bại.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-black font-medium">Đang tải đánh giá...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-800">Đánh giá từ khách hàng</h3>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 px-3 border border-slate-200">
                        {/* <span className="text-[10px] font-black text-black uppercase tracking-widest">Hiện</span>
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-transparent border-none text-xs font-black focus:ring-0 cursor-pointer"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                        </select> */}
                    </div>
                </div>
                <span className="text-sm font-medium text-black">{reviews.length} đánh giá</span>
            </div>

            {(() => {
                const totalPages = Math.ceil(reviews.length / ITEMS_PER_PAGE);
                const currentReviews = reviews.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                if (reviews.length === 0) {
                    return (
                        <div className="text-center py-12 bg-white rounded-3xl border border-gray-200 shadow-sm">
                            <div className="text-6xl mb-4">⭐</div>
                            <p className="text-black font-medium">Bạn chưa có đánh giá nào.</p>
                        </div>
                    );
                }

                return (
                    <>
                        <div className="grid grid-cols-1 gap-6">
                            {currentReviews.map((review) => (
                                <div key={review.reviewId} className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="p-6 md:p-8">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner flex-shrink-0">
                                                {review.customerAvatar ? (
                                                    <img src={review.customerAvatar} alt={review.customerName} className="w-full h-full object-cover" />
                                                ) : (
                                                    review.customerName?.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">{review.customerName}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <span key={star} className="text-sm" style={{ color: star <= review.rating ? '#FFD700' : '#cbd5e1' }}>★</span>
                                                                ))}
                                                            </div>
                                                            <span className="text-xs text-slate-400">• {new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-widest">Sản phẩm</span>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-xs font-black text-slate-900">{review.packageName || 'Gói dịch vụ'}</span>
                                                            <span className="text-[10px] font-bold text-primary italic">({review.variantName})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-gray-700 mb-4 leading-relaxed">{review.comment}</p>

                                                {/* Review Images */}
                                                {review.reviewImageUrls && review.reviewImageUrls.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {review.reviewImageUrls.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                className="size-20 rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in hover:border-primary transition-all group"
                                                                onClick={() => setSelectedImage(url)}
                                                            >
                                                                <img src={url} alt={`review-${i}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Vendor Reply Display */}
                                                {review.vendorReply ? (
                                                    <div className="mt-4 p-5 bg-primary/5 rounded-2xl border-l-4 border-primary relative">
                                                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Phản hồi của bạn</p>
                                                        <p className="text-sm text-slate-700 italic">"{review.vendorReply}"</p>
                                                        <button
                                                            onClick={() => {
                                                                setReplyingTo(review.reviewId);
                                                                setReplyText(review.vendorReply || '');
                                                            }}
                                                            className="absolute top-4 right-4 text-xs font-bold text-primary hover:underline"
                                                        >
                                                            Chỉnh sửa
                                                        </button>
                                                    </div>
                                                ) : (
                                                    replyingTo !== review.reviewId && (
                                                        <button
                                                            onClick={() => setReplyingTo(review.reviewId)}
                                                            className="mt-2 text-sm font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-lg border-2 border-primary transition-all uppercase tracking-widest"
                                                        >
                                                            Phản hồi ngay
                                                        </button>
                                                    )
                                                )}

                                                {/* Reply Form */}
                                                {replyingTo === review.reviewId && (
                                                    <div className="mt-4 space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                                        <p className="text-xs font-bold text-black uppercase tracking-widest">Viết phản hồi</p>
                                                        <textarea
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Cảm ơn khách hàng hoặc giải quyết vấn đề của họ..."
                                                            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px]"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleReply(review.reviewId)}
                                                                disabled={submitting}
                                                                className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
                                                            >
                                                                {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setReplyingTo(null);
                                                                    setReplyText('');
                                                                }}
                                                                disabled={submitting}
                                                                className="px-6 py-2.5 border-2 border-slate-300 text-black font-bold rounded-lg hover:bg-gray-100 transition-all uppercase tracking-widest text-sm"
                                                            >
                                                                Hủy
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {reviews.length > 0 && (
                            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border border-slate-200 bg-white rounded-2xl shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Hiển thị <span className="text-slate-900">{Math.min(reviews.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span>
                                    - <span className="text-slate-900">{Math.min(reviews.length, currentPage * ITEMS_PER_PAGE)}</span>
                                    trên <span className="text-slate-900">{reviews.length}</span> kết quả
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-white rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black border border-slate-200 text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        Trước
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all ${currentPage === pageNum ? 'bg-black text-white shadow-lg' : 'bg-white text-black hover:bg-slate-50 border border-slate-200'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-white rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black border border-slate-200 text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* Image Zoom Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" />

                    <button
                        className="absolute top-6 right-6 z-[210] w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10"
                        onClick={() => setSelectedImage(null)}
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>

                    <div
                        className="relative z-[205] max-w-full max-h-full animate-in zoom-in-95 duration-500 shadow-2xl rounded-2xl overflow-hidden shadow-black/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={selectedImage}
                            alt="Phóng to"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorReviewTab;
