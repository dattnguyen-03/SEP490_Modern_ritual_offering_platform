import React, { useState, useRef } from 'react';
import { reviewService } from '../../services/reviewService';
import toast from '../../services/toast';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    itemId: string;
    packageName: string;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSuccess, itemId, packageName }) => {
    const [rating, setRating] = useState<number>(5);
    const [comment, setComment] = useState<string>('');
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleRatingClick = (r: number) => {
        setRating(r);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            const newImages = [...images, ...selectedFiles];
            setImages(newImages);

            const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const success = await reviewService.createReview({
                itemId,
                rating,
                comment,
                reviewImages: images
            });

            if (success) {
                toast.success('Gửi đánh giá thành công! Cảm ơn bạn.');
                onSuccess();
                onClose();
            } else {
                toast.error('Gửi đánh giá thất bại. Vui lòng thử lại.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Có lỗi xảy ra khi gửi đánh giá.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div 
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-primary/5 p-8 border-b border-primary/10 relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-2xl font-black text-gray-900 font-display">Đánh giá sản phẩm</h2>
                    <p className="text-gray-500 mt-1 font-medium">{packageName}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Star Rating */}
                    <div className="text-center">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Bạn thấy sản phẩm thế nào?</p>
                        <div className="flex justify-center gap-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleRatingClick(star)}
                                    className={`text-4xl transition-all hover:scale-125 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                                >
                                    <svg className="w-10 h-10" fill={star <= rating ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                        <p className="mt-4 text-lg font-bold text-primary italic">
                            {rating === 1 && 'Rất tệ'}
                            {rating === 2 && 'Tệ'}
                            {rating === 3 && 'Bình thường'}
                            {rating === 4 && 'Tốt'}
                            {rating === 5 && 'Tuyệt vời!'}
                        </p>
                    </div>

                    {/* Comment */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Nhận xét của bạn</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
                            className="w-full h-32 p-5 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:bg-white focus:border-primary/20 outline-none transition-all placeholder:text-gray-300 resize-none font-medium text-gray-700"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Thêm hình ảnh thực tế</label>
                        <div className="flex flex-wrap gap-3">
                            {previews.map((preview, idx) => (
                                <div key={idx} className="relative size-20 rounded-2xl overflow-hidden border border-gray-100 shadow-sm group">
                                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 size-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="size-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
                            >
                                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-[10px] font-bold uppercase">Thêm</span>
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all border border-transparent"
                        >
                            Đóng
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-[2] py-4 px-6 rounded-2xl font-extrabold text-white bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {submitting ? 'Đanh gửi...' : 'Gửi đánh giá'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReviewModal;
