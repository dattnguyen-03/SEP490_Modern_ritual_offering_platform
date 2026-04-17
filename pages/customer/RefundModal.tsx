import React, { useState, useEffect } from 'react';
import { Order, OrderItem } from '../../services/orderService';
import { refundService } from '../../services/refundService';
import toast from '../../services/toast';

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    order: Order;
}

const RefundModal: React.FC<RefundModalProps> = ({ isOpen, onClose, onSuccess, order }) => {
    const [reason, setReason] = useState('');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setReason('');
            setSelectedItems([]);
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            setImages([]);
            setImagePreviews([]);
        }
    }, [isOpen]);

    // Toggle item selection
    const toggleItem = (itemId: string) => {
        setSelectedItems(prev => 
            prev.includes(itemId) 
                ? prev.filter(id => id !== itemId) 
                : [...prev, itemId]
        );
    };

    // Select/Deselect all
    const toggleAll = () => {
        if (selectedItems.length === order.items.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(order.items.map(item => item.itemId));
        }
    };

    // Handle image upload
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setImages(prev => [...prev, ...newFiles]);
            
            // Create previews
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        URL.revokeObjectURL(imagePreviews[index]);
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        
        if (selectedItems.length === 0) {
            toast.error('Vui lòng chọn ít nhất một sản phẩm để hoàn tiền');
            return;
        }
        
        if (!reason.trim()) {
            toast.error('Vui lòng nhập lý do hoàn tiền');
            return;
        }
        
        if (images.length === 0) {
            toast.error('Vui lòng tải lên ít nhất một hình ảnh bằng chứng');
            return;
        }

        setSubmitting(true);
        try {
            const result = await refundService.createRefund({
                orderId: order.orderId,
                reason,
                proofImages: images,
                createRefundItems: selectedItems.map(id => ({ orderItemId: id }))
            });

            if (result.success) {
                if (result.refundId) {
                    localStorage.setItem(`refundId:${order.orderId}`, result.refundId);
                }
                toast.success('Gửi yêu cầu hoàn tiền thành công');
                onSuccess();
                onClose();
            } else {
                toast.error('Gửi yêu cầu hoàn tiền thất bại');
            }
        } catch (error: any) {
            toast.error(error.message || 'Có lỗi xảy ra khi gửi yêu cầu');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Yêu cầu hoàn tiền</h2>
                        <p className="text-sm text-gray-500 mt-1">Đơn hàng #{order.orderId.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                    {/* Item Selection */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                                Chọn sản phẩm hoàn tiền
                            </h3>
                            <button 
                                type="button"
                                onClick={toggleAll}
                                className="text-sm font-bold text-primary hover:underline"
                            >
                                {selectedItems.length === order.items.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {order.items.map((item) => (
                                <div 
                                    key={item.itemId}
                                    onClick={() => toggleItem(item.itemId)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                                        selectedItems.includes(item.itemId) 
                                            ? 'border-primary bg-primary/5 shadow-sm' 
                                            : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                                    }`}
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                        selectedItems.includes(item.itemId) 
                                            ? 'bg-primary border-primary' 
                                            : 'border-gray-300 bg-white'
                                    }`}>
                                        {selectedItems.includes(item.itemId) && (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 text-sm truncate">{item.packageName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{item.variantName} x{item.quantity}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900 text-sm">{item.lineTotal.toLocaleString('vi-VN')}đ</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            Lý do hoàn tiền
                        </h3>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none min-h-[120px] text-gray-700 bg-gray-50/30"
                            placeholder="Vui lòng mô tả chi tiết lý do bạn yêu cầu hoàn tiền cho (các) sản phẩm này..."
                        />
                    </div>

                    {/* Proof Images */}
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            Hình ảnh bằng chứng
                        </h3>
                        
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {imagePreviews.map((url, index) => (
                                <div key={index} className="aspect-square rounded-2xl overflow-hidden relative group border border-gray-100 ring-1 ring-gray-900/5 shadow-sm">
                                    <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            
                            {imagePreviews.length < 10 && (
                                <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        onChange={handleImageChange}
                                        className="hidden" 
                                    />
                                    <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center mb-1.5 transition-colors">
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-primary uppercase tracking-wider">Tải lên</span>
                                </label>
                            )}
                        </div>
                        <p className="mt-4 text-xs text-gray-500 flex items-start gap-1.5 leading-relaxed">
                            <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Để yêu cầu được xử lý nhanh nhất, vui lòng tải lên hình ảnh rõ nét tình trạng sản phẩm và tem nhãn (nếu có).
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
                    <button 
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-600 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-200 transition-all disabled:opacity-50"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        type="submit"
                        disabled={submitting}
                        className="flex-[2] py-4 px-6 bg-primary text-white rounded-2xl font-bold hover:shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0"
                    >
                        {submitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Đang xử lý...</span>
                            </div>
                        ) : 'Gửi yêu cầu hoàn tiền'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RefundModal;
