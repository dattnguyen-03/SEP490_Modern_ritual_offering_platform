import React, { useState, useEffect } from 'react';
import { Order } from '../../services/orderService';
import { refundService } from '../../services/refundService';
import toast from '../../services/toast';

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    order: Order;
}



const CheckIcon = () => (
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
    </svg>
);

const RefundModal: React.FC<RefundModalProps> = ({ isOpen, onClose, onSuccess, order }) => {
    const [refundType, setRefundType] = useState<'Full' | 'SpecificItems' | 'PartialItem'>('Full');
    const [reason, setReason] = useState('');
    // Case 2: selected orderItemIds (BE validates against orderItem table)
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // Case 3: single item selected (can be orderItemId / orderItemAddOnId / orderItemSwapId)
    const [targetItemId, setTargetItemId] = useState<string>('');
    const [targetMaxAmount, setTargetMaxAmount] = useState<number>(0); // max refundable for validation
    const [partialAmount, setPartialAmount] = useState<number>(0);
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setRefundType('Full');
            setReason('');
            setSelectedIds([]);
            setTargetItemId('');
            setPartialAmount(0);
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            setImages([]);
            setImagePreviews([]);
        }
    }, [isOpen]);

    // Reset selections when switching refund type
    useEffect(() => {
        setSelectedIds([]);
        setTargetItemId('');
        setTargetMaxAmount(0);
        setPartialAmount(0);
    }, [refundType]);

    // Helper: select a target item for Case 3
    const selectTargetItem = (id: string, maxAmount: number) => {
        setTargetItemId(id);
        setTargetMaxAmount(maxAmount);
        setPartialAmount(Math.max(0, maxAmount - 1000));
    };

    const toggleOrderItem = (itemId: string) => {
        setSelectedIds(prev =>
            prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
        );
    };

    const toggleAll = () => {
        const allIds = order.items.map(it => it.itemId);
        setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setImages(prev => [...prev, ...newFiles]);
            setImagePreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
        }
    };

    const removeImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);
        setImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (refundType === 'SpecificItems' && selectedIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất một món để hoàn tiền');
            return;
        }

        if (refundType === 'PartialItem') {
            if (!targetItemId) {
                toast.error('Vui lòng chọn một món để thương lượng');
                return;
            }
            if (partialAmount >= targetMaxAmount) {
                toast.error(`Số tiền thương lượng phải nhỏ hơn ${targetMaxAmount.toLocaleString('vi-VN')}đ`);
                return;
            }
            if (partialAmount <= 0) {
                toast.error('Số tiền thương lượng phải lớn hơn 0');
                return;
            }
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
                refundType,
                // Case 1 (Full):          No ItemIds, No TargetItemId → hoàn 100% + phạt vendor
                // Case 2 (SpecificItems): ItemIds = mảng orderItemId chọn (có thể nhiều) → hoàn TotalLine, không phạt
                // Case 3 (PartialItem):   TargetItemId + PartialAmount, No ItemIds → thương lượng, không phạt
                createRefundItems: refundType === 'SpecificItems'
                    ? selectedIds.map(id => ({ orderItemId: id }))
                    : undefined,
                targetItemId: refundType === 'PartialItem' ? targetItemId : undefined,
                partialAmount: refundType === 'PartialItem' ? partialAmount : undefined,
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

    const typeConfig = [
        { id: 'Full', label: 'Hoàn toàn bộ', desc: 'Hoàn 100% đơn hàng', noteClass: 'text-rose-500' },
        { id: 'SpecificItems', label: 'Các sản phẩm cụ thể', desc: 'Chọn đơn hàng bạn muốn hoàn', noteClass: 'text-emerald-600' },
        { id: 'PartialItem', label: 'Hoàn một phần', desc: 'Chọn 1 đơn hàng và thương lượng giá', noteClass: 'text-emerald-600' },
    ];

    // Estimated refund total for SpecificItems (sum of selected orderItem lineTotals)
    const estimatedTotal = order.items
        .filter(it => selectedIds.includes(it.itemId))
        .reduce((sum, it) => sum + (it.lineTotal || 0), 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">Yêu cầu hoàn tiền</h2>
                        <p className="text-sm text-gray-500 mt-1">Đơn hàng #{order.orderId.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                    {/* Refund Type */}
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            Loại hoàn tiền
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {typeConfig.map((type) => {
                                const isActive = refundType === type.id;
                                return (
                                    <div
                                        key={type.id}
                                        onClick={() => setRefundType(type.id as any)}
                                        className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${isActive
                                            ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]'
                                            : 'border-gray-200 hover:border-primary/50 bg-white'
                                            }`}
                                    >
                                        {isActive && (
                                            <span className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                                                <CheckIcon />
                                            </span>
                                        )}
                                        <p className={`font-black text-sm leading-tight mb-1 ${isActive ? 'text-white' : 'text-gray-900'}`}>{type.label}</p>
                                        <p className={`text-[10px] ${isActive ? 'text-white/75' : 'text-gray-400'}`}>{type.desc}</p>
                                        <p className={`text-[9px] font-bold mt-1 ${isActive ? 'text-white/60' : type.noteClass}`}></p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ===== CASE 2: SpecificItems — select by OrderItem, addOns/swaps shown as info ===== */}
                    {refundType === 'SpecificItems' && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                                    Chọn sản phẩm muốn hoàn
                                </h3>
                                <button type="button" onClick={toggleAll} className="text-xs font-bold text-primary hover:underline">
                                    {selectedIds.length === order.items.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {order.items.map(item => {
                                    const isSelected = selectedIds.includes(item.itemId);
                                    return (
                                        <div
                                            key={item.itemId}
                                            onClick={() => toggleOrderItem(item.itemId)}
                                            className={`rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-primary' : 'border-gray-200 hover:border-primary/40'
                                                }`}
                                        >
                                            {/* Selectable header row */}
                                            <div className={`flex items-center gap-3 px-4 py-3 ${isSelected ? 'bg-primary/5' : 'bg-white'
                                                }`}>
                                                <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                                                    }`}>
                                                    {isSelected && <CheckIcon />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-sm">{item.packageName}</p>
                                                    <p className="text-[10px] text-gray-500">{item.variantName} ×{item.quantity}</p>
                                                </div>
                                                <p className="font-black text-gray-800 text-sm flex-shrink-0">{item.lineTotal.toLocaleString('vi-VN')}đ</p>
                                            </div>

                                            {/* Add-ons info (non-selectable, informational) */}
                                            {((item as any).addOns?.length > 0 || (item as any).swaps?.length > 0) && (
                                                <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2 space-y-1">
                                                    {(item as any).swaps?.map((sw: any, i: number) => (
                                                        <p key={i} className="text-[10px] text-amber-700 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></span>
                                                            {sw.replacementDescription || `${sw.originalItemName} → ${sw.replacementItemName}`}
                                                            {sw.surcharge > 0 && <span className="ml-auto text-amber-500">+{sw.surcharge.toLocaleString('vi-VN')}đ</span>}
                                                        </p>
                                                    ))}
                                                    {(item as any).addOns?.map((ad: any, i: number) => (
                                                        <p key={i} className="text-[10px] text-emerald-700 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></span>
                                                            + {ad.addOnName || ad.itemName} ×{ad.quantity}
                                                            <span className="ml-auto text-emerald-500">{(ad.lineTotal || 0).toLocaleString('vi-VN')}đ</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedIds.length > 0 && (
                                <div className="mt-4 flex justify-between items-center bg-primary/5 rounded-2xl px-4 py-3">
                                    <p className="text-xs font-bold text-gray-600">Dự kiến hoàn ({selectedIds.length} sản phẩm)</p>
                                    <p className="font-black text-primary text-lg">{estimatedTotal.toLocaleString('vi-VN')}đ</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== CASE 3: PartialItem — pick 1 OrderItem (variant) to negotiate ===== */}
                    {refundType === 'PartialItem' && (
                        <div className="mb-8">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                                Chọn sản phẩm thương lượng
                            </h3>

                            <div className="space-y-3">
                                {order.items.map(item => {
                                    const isSelected = targetItemId === item.itemId;
                                    return (
                                        <div
                                            key={item.itemId}
                                            onClick={() => selectTargetItem(item.itemId, item.lineTotal)}
                                            className={`rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-primary' : 'border-gray-200 hover:border-primary/40'
                                                }`}
                                        >
                                            {/* Selectable header */}
                                            <div className={`flex items-center gap-3 px-4 py-3 ${isSelected ? 'bg-primary/5' : 'bg-white'}`}>
                                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-sm">{item.packageName}</p>
                                                    <p className="text-xs text-gray-500">{item.variantName} ×{item.quantity}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-black text-gray-800 text-sm">{item.lineTotal.toLocaleString('vi-VN')}đ</p>
                                                    <p className="text-[9px] text-gray-400">Tổng</p>
                                                </div>
                                            </div>

                                            {/* Swaps & add-ons — informational only, not selectable */}
                                            {((item as any).swaps?.length > 0 || (item as any).addOns?.length > 0) && (
                                                <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2 space-y-1">
                                                    {(item as any).swaps?.map((sw: any, i: number) => (
                                                        <p key={i} className="text-[10px] text-amber-700 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></span>
                                                            {sw.replacementDescription || `${sw.originalItemName} → ${sw.replacementItemName}`}
                                                            {sw.surcharge > 0 && <span className="ml-auto text-amber-500">+{sw.surcharge.toLocaleString('vi-VN')}đ</span>}
                                                        </p>
                                                    ))}
                                                    {(item as any).addOns?.map((ad: any, i: number) => (
                                                        <p key={i} className="text-[10px] text-emerald-700 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></span>
                                                            + {ad.addOnName || ad.itemName} ×{ad.quantity}
                                                            <span className="ml-auto text-emerald-500">{(ad.lineTotal || 0).toLocaleString('vi-VN')}đ</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Partial amount input */}
                            {targetItemId && (
                                <div className="mt-6">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                                        <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                                        Số tiền thương lượng
                                    </h3>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={partialAmount > 0 ? partialAmount.toLocaleString('vi-VN') : ''}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
                                                const num = parseInt(raw, 10);
                                                setPartialAmount(isNaN(num) ? 0 : num);
                                            }}
                                            className="w-full px-5 py-4 pr-12 rounded-2xl border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-gray-700 bg-gray-50/30 font-bold text-lg"
                                            placeholder="Nhập số tiền muốn hoàn..."
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-gray-400">đ</span>
                                    </div>
                                    <p className="mt-2 text-xs text-orange-600 font-medium">
                                        * Phải nhỏ hơn {targetMaxAmount.toLocaleString('vi-VN')}đ (tổng của sản phẩm được chọn)
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reason */}
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            Lý do hoàn tiền
                        </h3>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none min-h-[120px] text-gray-700 bg-gray-50/30"
                            placeholder="Vui lòng mô tả chi tiết lý do bạn yêu cầu hoàn tiền..."
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
                                    <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            {imagePreviews.length < 10 && (
                                <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                    <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
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
                    <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-600 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-200 transition-all disabled:opacity-50">
                        Hủy bỏ
                    </button>
                    <button type="submit" disabled={submitting} className="flex-[2] py-4 px-6 bg-primary text-white rounded-2xl font-bold hover:shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0">
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
