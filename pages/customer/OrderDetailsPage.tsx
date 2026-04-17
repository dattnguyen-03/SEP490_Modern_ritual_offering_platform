import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { orderService, Order } from '../../services/orderService';
import { refundService, RefundRecord } from '../../services/refundService';
import { vendorService, VendorProfile } from '../../services/vendorService';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';
import RefundModal from './RefundModal';
import ReviewModal from './ReviewModal';
import ImageModal from '../../components/ImageModal';

const OrderDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [vendorInfo, setVendorInfo] = useState<VendorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedItemForReview, setSelectedItemForReview] = useState<{ itemId: string, packageName: string } | null>(null);
    const [refundInfo, setRefundInfo] = useState<RefundRecord | null>(null);
    const [escalating, setEscalating] = useState(false);
    const [refundDismissed, setRefundDismissed] = useState(false);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [proofModalImages, setProofModalImages] = useState<string[]>([]);
    const [proofModalTitle, setProofModalTitle] = useState('Ảnh giao hàng');

    const [searchParams] = useSearchParams();
    const [vendorAvatarMap, setVendorAvatarMap] = useState<Record<string, string>>({});

    const fetchOrder = async () => {
        if (!id) return;
        try {
            const data = await orderService.getOrderDetails(id);
            if (data) {
                setOrder(data);
                await Promise.all([
                    loadRefundInfo(data.orderId),
                    loadVendorInfo(data),
                ]);

                if (searchParams.get('requestRefund') === 'true') {
                    const isDelivered = data.orderStatus.toUpperCase() === 'DELIVERED';
                    if (isDelivered) {
                        setIsRefundModalOpen(true);
                    }
                }
            } else {
                toast.error('Không tìm thấy đơn hàng!');
                navigate('/profile/orders');
            }
        } catch (error) {
            console.error('Lỗi khi lấy chi tiết đơn hàng:', error);
            toast.error('Không thể tải chi tiết đơn hàng.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchOrder();
        vendorService.getAllVendors().then(vendors => {
            const map: Record<string, string> = {};
            vendors.forEach(v => {
                const avatar = v.shopAvatarUrl || v.avatarUrl || '';
                if (v.shopName && avatar) map[v.shopName] = avatar;
                if (v.profileId && avatar) map[v.profileId] = avatar;
            });
            setVendorAvatarMap(map);
        }).catch(() => { });
    }, [id, navigate]);

    const loadRefundInfo = async (orderId: string) => {
        try {
            const urlRefundId = searchParams.get('refundId');
            if (urlRefundId) {
                const data = await refundService.getRefundById(urlRefundId);
                if (data) {
                    setRefundInfo(data);
                    setRefundDismissed(Boolean(localStorage.getItem(`refundEscalateDismissed:${data.refundId}`)));
                    return;
                }
            }

            const refundId = localStorage.getItem(`refundId:${orderId}`);
            if (refundId) {
                const data = await refundService.getRefundById(refundId);
                if (data) {
                    setRefundInfo(data);
                    setRefundDismissed(Boolean(localStorage.getItem(`refundEscalateDismissed:${data.refundId}`)));
                    return;
                }
            }

            const fallback = await refundService.getRefundByOrderId(orderId);
            if (fallback?.refundId) {
                localStorage.setItem(`refundId:${orderId}`, fallback.refundId);
                setRefundDismissed(Boolean(localStorage.getItem(`refundEscalateDismissed:${fallback.refundId}`)));
            }
            setRefundInfo(fallback);
        } catch {
            setRefundInfo(null);
        }
    };

    const loadVendorInfo = async (orderData: Order) => {
        try {
            const vendorId = String(
                orderData.vendor?.profileId
                || (orderData as any).vendorProfileId
                || (orderData as any).vendorId
                || ''
            ).trim();

            const shopName = orderData.vendor?.shopName || (orderData as any).shopName || '';

            if (vendorId) {
                const vendor = await vendorService.getVendorCached(vendorId);
                if (vendor) {
                    setVendorInfo(vendor);
                    return;
                }
            }

            const allVendors = await vendorService.getAllVendors();
            const matched = allVendors.find(v =>
                (vendorId && v.profileId === vendorId) ||
                (shopName && v.shopName === shopName)
            );
            if (matched) {
                setVendorInfo(matched);
            }
        } catch (error) {
            console.error('Lỗi khi tải thông tin vendor:', error);
        }
    };

    const handleEscalateRefund = async () => {
        if (!refundInfo) return;
        setEscalating(true);
        try {
            const ok = await refundService.escalateRefund(refundInfo.refundId, true);
            if (ok) {
                toast.success('Đã gửi khiếu nại lên quản trị. Vui lòng chờ phản hồi.');
                localStorage.setItem(`refundEscalateDismissed:${refundInfo.refundId}`, '1');
                setRefundDismissed(true);
            } else {
                toast.error('Không thể gửi khiếu nại. Vui lòng thử lại.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Không thể gửi khiếu nại.');
        } finally {
            setEscalating(false);
        }
    };

    const handleDismissRefundNotice = () => {
        if (!refundInfo) return;
        localStorage.setItem(`refundEscalateDismissed:${refundInfo.refundId}`, '1');
        setRefundDismissed(true);
    };

    const handleCancelOrder = async () => {
        if (!order) return;
        const result = await toast.selectPrompt({
            title: 'Xác nhận hủy đơn hàng',
            text: 'Vui lòng chọn lý do mà bạn muốn hủy đơn:',
            inputOptions: {
                'Thay đổi địa chỉ giao hàng': 'Thay đổi địa chỉ giao hàng',
                'Thay đổi món / số lượng': 'Thay đổi món / số lượng',
                'Thủ tục thanh toán rắc rối': 'Thủ tục thanh toán rắc rối',
                'Tìm thấy chỗ khác phù hợp hơn': 'Tìm thấy chỗ khác phù hợp hơn',
                'Không có nhu cầu mua nữa': 'Không có nhu cầu mua nữa',
                'Lý do khác': 'Lý do khác'
            },
            inputPlaceholder: 'Chọn lý do hủy...',
            confirmButtonText: 'Đồng ý hủy',
            cancelButtonText: 'Bỏ qua'
        });

        if (!result.isConfirmed) return;
        const reason = result.value || 'Khách hàng thay đổi ý định';
        setCancelling(true);
        try {
            const success = await orderService.cancelOrder(order.orderId, reason);
            if (success) {
                toast.success('Hủy đơn hàng thành công');
                await fetchOrder();
            } else {
                toast.error('Hủy đơn hàng thất bại');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hủy đơn hàng thất bại. Vui lòng thử lại.');
        } finally {
            setCancelling(false);
        }
    };

    const handleCompleteOrder = async () => {
        if (!order) return;
        const confirmResult = await toast.confirm({
            title: 'Xác nhận hoàn thành đơn',
            text: 'Bạn xác nhận đã nhận đủ hàng và hài lòng với dịch vụ?',
            icon: 'question',
            confirmButtonText: 'Hoàn thành',
            cancelButtonText: 'Hủy',
        });
        if (!confirmResult.isConfirmed) return;
        setCompleting(true);
        try {
            const success = await orderService.updateOrderStatus(order.orderId, 'Completed');
            if (success) {
                toast.success('Đơn hàng đã hoàn thành');
                await fetchOrder();
            } else {
                toast.error('Không thể hoàn thành đơn hàng');
            }
        } catch (error: any) {
            toast.error(error.message || 'Cập nhật thất bại. Vui lòng thử lại.');
        } finally {
            setCompleting(false);
        }
    };

    const getStatusText = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING': return 'Chờ thanh toán';
            case 'CONFIRMED': return 'Đã xác nhận';
            case 'PAID': return 'Đã thanh toán';
            case 'PREPARING':
            case 'PROCESSING': return 'Đang chuẩn bị';
            case 'SHIPPING':
            case 'DELIVERING': return 'Đang giao hàng';
            case 'DELIVERED': return 'Đã giao hàng';
            case 'COMPLETED': return 'Đã hoàn thành';
            case 'CANCELLED': return 'Đã hủy';
            case 'REFUNDED': return 'Đã hoàn tiền';
            case 'PAYMENTFAILED': return 'Thanh toán lỗi';
            default: return status;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'CONFIRMED': return 'bg-sky-50 text-sky-600 border-sky-100';
            case 'PAID': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'PREPARING':
            case 'PROCESSING': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'SHIPPING':
            case 'DELIVERING': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'DELIVERED':
            case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'CANCELLED': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-slate-50 text-black border-slate-100';
        }
    };

    const getTrackingStepIndex = (status: string) => {
        const normalized = status?.toUpperCase() || '';
        if (['PENDING', 'CONFIRMED', 'PAID'].includes(normalized)) return 0;
        if (['PREPARING', 'PROCESSING'].includes(normalized)) return 1;
        if (['SHIPPING', 'DELIVERING'].includes(normalized)) return 2;
        if (['DELIVERED', 'COMPLETED', 'REFUNDED'].includes(normalized)) return 3;
        return 0;
    };

    if (loading) return <LoadingScreen message="Đang tải chi tiết đơn hàng..." />;
    if (!order) return null;

    const vendorProfileId = String(vendorInfo?.profileId || order?.vendor?.profileId || '').trim();
    const vendorShopName = vendorInfo?.shopName || order.vendor?.shopName || 'Tiệm Cúng Bái';
    const vendorAvatarSrc = vendorAvatarMap[vendorProfileId] || vendorInfo?.shopAvatarUrl || null;

    const preparationImages = Array.isArray((order.delivery as any)?.preparationProofImages) ? (order.delivery as any).preparationProofImages : [];
    const deliveryImages = Array.isArray((order.delivery as any)?.deliveryProofImages) ? (order.delivery as any).deliveryProofImages : [];
    const hasPreparationImages = preparationImages.length > 0;
    const hasDeliveryImages = deliveryImages.length > 0;

    const trackingStepIndex = getTrackingStepIndex(order.orderStatus);
    const hasRefundStep = Boolean(refundInfo?.refundId);
    const trackingSteps = [
        { label: 'Xác nhận', desc: 'Tiếp nhận đơn' },
        { label: 'Chuẩn bị', desc: 'Sửa soạn lễ vật' },
        { label: 'Đang giao', desc: 'Vận chuyển tận nhà' },
        { label: 'Hoàn tất', desc: 'Giao lễ thành công' },
        ...(hasRefundStep ? [{ label: 'Hoàn tiền', desc: 'Xử lý yêu cầu' }] : []),
    ];

    return (
        <div className="bg-slate-50 min-h-screen py-12 px-4 md:px-6 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-5 mb-10">
                    <button onClick={() => navigate('/profile/orders')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 hover:border-primary/50 transition-all hover:shadow-md active:scale-95">
                        <span className="material-symbols-outlined text-black">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chi tiết đơn hàng</h1>
                        <p className="text-black font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Order #{order.orderId.substring(0, 8)}</p>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column (Items & Tracking) */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Status Card */}
                        <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl shadow-slate-200/40 flex items-center justify-between ${getStatusStyle(order.orderStatus)}`}>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Trạng thái đơn hàng</p>
                                <h2 className="text-3xl font-black tracking-tight">{getStatusText(order.orderStatus)}</h2>
                            </div>
                            <div className="flex gap-3">
                                {['PENDING', 'PAID'].includes(order.orderStatus.toUpperCase()) && (
                                    <button onClick={handleCancelOrder} disabled={cancelling} className="px-6 py-3 bg-white text-rose-600 border border-rose-100 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all shadow-sm">
                                        {cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}
                                    </button>
                                )}
                                {order.orderStatus.toUpperCase() === 'DELIVERED' && (
                                    <button onClick={handleCompleteOrder} disabled={completing} className="px-8 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                                        {completing ? '...' : 'Hoàn thành đơn'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tracking Timeline */}
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-100/50">
                            <div className="relative pt-2 pb-10">
                                <div className="absolute top-8 left-0 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${(trackingStepIndex / (trackingSteps.length - 1)) * 100}%` }} />
                                </div>
                                <div className="relative flex justify-between">
                                    {trackingSteps.map((step, i) => (
                                        <div key={i} className={`flex flex-col items-center gap-4 ${i <= trackingStepIndex ? 'opacity-100' : 'opacity-30'}`}>
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white shadow-lg text-lg font-black ${i <= trackingStepIndex ? 'bg-primary text-white scale-110 z-10' : 'bg-slate-200 text-black'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-black text-slate-800 tracking-tight">{step.label}</p>
                                                <p className="text-[10px] text-black font-bold uppercase mt-0.5">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Vật phẩm nghi lễ</h3>
                                <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-black uppercase tracking-widest">{order.items?.length || 0} Gói lễ</span>
                            </div>

                            {order.items?.map((item, idx) => {
                                const goToDetail = () => item.packageId && navigate(`/product/${item.packageId}`);
                                return (
                                    <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg shadow-slate-200/30 flex flex-col md:flex-row gap-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
                                        <div className="size-32 rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 cursor-pointer shadow-inner" onClick={goToDetail}>
                                            <img src={item.imageUrl || ''} alt={item.packageName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onError={e => (e.currentTarget.src = 'https://picsum.photos/400/400?random=' + idx)} />
                                        </div>

                                        <div className="flex-1 flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-3">
                                                    <h4 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors leading-tight cursor-pointer" onClick={goToDetail}>{item.packageName}</h4>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
                                                            <span className="text-[10px] font-black uppercase text-black tracking-widest leading-none mt-0.5">Loại:</span>
                                                            <span className="text-xs font-black text-slate-700">{item.variantName}</span>
                                                        </div>
                                                        <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
                                                            <span className="text-[10px] font-black uppercase text-black tracking-widest leading-none mt-0.5">SL:</span>
                                                            <span className="text-xs font-black text-slate-700">×{item.quantity}</span>
                                                        </div>
                                                        <div className="ml-auto flex flex-col items-end gap-1">
                                                            <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm text-sm font-black whitespace-nowrap tracking-tight">
                                                                +{((item.price || 0)).toLocaleString('vi-VN')}đ
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Customizations */}
                                                {(item as any).swaps?.map((sw: any, i: number) => (
                                                    <div key={i} className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100/50 flex justify-between items-center text-xs group/swap">
                                                        <div className="flex items-center gap-3">
                                                            <span className="material-symbols-outlined text-amber-500 text-lg">swap_horiz</span>
                                                            <p className="text-amber-800 font-bold leading-relaxed">{sw.replacementDescription || `${sw.originalItemName} → ${sw.replacementItemName}`}</p>
                                                        </div>
                                                        {sw.surcharge > 0 && <span className="bg-white px-3 py-1 rounded-xl font-black text-amber-600 shadow-sm">+{sw.surcharge.toLocaleString('vi-VN')}đ</span>}
                                                    </div>
                                                ))}
                                                {(item as any).addOns?.map((ad: any, i: number) => (
                                                    <div key={i} className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100/50 flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-3">
                                                            <span className="material-symbols-outlined text-emerald-500 text-lg">add_circle</span>
                                                            <p className="text-emerald-800 font-bold leading-relaxed">{ad.addOnName || ad.itemName} <span className="opacity-50">×{ad.quantity}</span></p>
                                                        </div>
                                                        <span className="bg-white px-3 py-1 rounded-xl font-black text-emerald-600 shadow-sm">+{(ad.lineTotal || (ad.retailPrice * ad.quantity)).toLocaleString('vi-VN')}đ</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-slate-100">
                                                <div className="flex justify-between items-center mb-6">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-black">Tổng sản phẩm này :</p>
                                                    <p className="text-2xl font-black text-primary tracking-tight">{(item.lineTotal || 0).toLocaleString('vi-VN')}đ</p>
                                                </div>

                                                {order.orderStatus.toUpperCase() === 'COMPLETED' && (
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setSelectedItemForReview({ itemId: item.itemId, packageName: item.packageName });
                                                                setIsReviewModalOpen(true);
                                                            }}
                                                            className="px-8 py-3 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-primary/10 hover:bg-primary hover:text-white transition-all duration-300 shadow-sm"
                                                        >
                                                            Viết đánh giá
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column (Info Cards) */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Final Payment */}
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                                <span className="material-symbols-outlined text-8xl">payments</span>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black mb-8 border-b border-slate-50 pb-4">Tóm tắt thanh toán</h3>
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm font-bold text-black">
                                    <span>Tạm tính</span>
                                    <span className="text-slate-900">{((order.pricing as any)?.subTotal || order.pricing?.subTotal).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-black">
                                    <span>Phí giao hàng</span>
                                    <span className="text-primary">+{order.pricing?.shippingFee.toLocaleString('vi-VN')}đ</span>
                                </div>
                                {((order.pricing as any)?.discountAmount || 0) > 0 && (
                                    <div className="flex justify-between text-sm font-bold text-emerald-600">
                                        <span>Giảm giá</span>
                                        <span>-{(order.pricing as any).discountAmount.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                )}
                            </div>
                            <div className="pt-6 border-t-2 border-dashed border-slate-100 flex justify-between items-end">
                                <span className="text-xs font-black uppercase text-black tracking-widest mb-1">Thanh toán</span>
                                <span className="text-3xl font-black text-primary tracking-tighter">{((order.pricing as any)?.finalAmount || order.pricing?.totalAmount).toLocaleString('vi-VN')}đ</span>
                            </div>
                        </div>

                        {/* Store Info */}
                        <div onClick={() => vendorProfileId && navigate(`/vendor/${vendorProfileId}`)} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
                            <div className="flex items-center gap-5">
                                <div className="size-20 rounded-3xl bg-slate-50 border border-slate-100 p-0.5 overflow-hidden flex-shrink-0 shadow-inner">
                                    <img src={vendorAvatarSrc || ''} alt={vendorShopName} className="w-full h-full object-cover rounded-[1.25rem]" onError={e => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + vendorShopName)} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Nhà cung cấp</p>
                                    <h4 className="text-lg font-black text-slate-800 tracking-tight truncate leading-tight">{vendorShopName}</h4>
                                    <div className="flex items-center gap-1 mt-2 text-black font-bold text-[10px] uppercase tracking-wider">
                                        <span>Chi tiết</span>
                                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Details */}
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 divide-y divide-slate-50">
                            <div className="pb-6">
                                <p className="text-[10px] font-black uppercase text-black tracking-widest mb-4 italic">Thời gian phục vụ</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined">event</span>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 tracking-tight">{new Date(order.delivery?.deliveryDate).toLocaleDateString('vi-VN')}</p>
                                        <p className="text-xs font-bold text-black uppercase tracking-widest mt-0.5">{order.delivery?.deliveryTime?.slice(0, 5)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="py-6">
                                <p className="text-[10px] font-black uppercase text-black tracking-widest mb-4 italic">Địa điểm giao mâm</p>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined">location_on</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 leading-relaxed pt-1">{order.delivery?.deliveryAddress}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <RefundModal isOpen={isRefundModalOpen} onClose={() => setIsRefundModalOpen(false)} onSuccess={fetchOrder} order={order} />
            {selectedItemForReview && <ReviewModal isOpen={isReviewModalOpen} onClose={() => { setIsReviewModalOpen(false); setSelectedItemForReview(null); }} onSuccess={fetchOrder} itemId={selectedItemForReview.itemId} packageName={selectedItemForReview.packageName} />}
            <ImageModal isOpen={isProofModalOpen} images={proofModalImages} imageSrc={proofModalImages[0] || ''} altText={proofModalTitle} onClose={() => setIsProofModalOpen(false)} />
        </div>
    );
};

export default OrderDetailsPage;
