import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { orderService, Order } from '../../services/orderService';
import { refundService, RefundRecord } from '../../services/refundService';
import { vendorService, VendorProfile } from '../../services/vendorService';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';
import RefundModal from '../../components/customer/RefundModal';
import ReviewModal from '../../components/customer/ReviewModal';
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

                // Check if we should auto-open refund modal
                if (searchParams.get('requestRefund') === 'true') {
                    // We need to wait a tiny bit for the eligibility state to be ready or just use the data
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
        // Load all vendors to build avatar map
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
            // Priority 1: Check query parameters for refundId
            const urlRefundId = searchParams.get('refundId');
            if (urlRefundId) {
                const data = await refundService.getRefundById(urlRefundId);
                if (data) {
                    setRefundInfo(data);
                    setRefundDismissed(Boolean(localStorage.getItem(`refundEscalateDismissed:${data.refundId}`)));
                    return;
                }
            }

            // Priority 2: Check localStorage for refundId
            const refundId = localStorage.getItem(`refundId:${orderId}`);
            if (refundId) {
                const data = await refundService.getRefundById(refundId);
                if (data) {
                    setRefundInfo(data);
                    setRefundDismissed(Boolean(localStorage.getItem(`refundEscalateDismissed:${data.refundId}`)));
                    return;
                }
            }

            // Priority 3: Fallback to searching by orderId
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
                || (orderData as any).VendorId
                || ''
            ).trim();

            const shopName = orderData.vendor?.shopName || (orderData as any).shopName || '';

            // Try individual vendor API first
            if (vendorId) {
                const vendor = await vendorService.getVendorCached(vendorId);
                if (vendor) {
                    setVendorInfo(vendor);
                    return;
                }
            }

            // Fallback: load all vendors and match by profileId or shopName
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
                'Muốn thay đổi địa chỉ giao hàng': 'Thay đổi địa chỉ giao hàng',
                'Muốn thay đổi món/số lượng': 'Thay đổi món / số lượng',
                'Thủ tục thanh toán quá rắc rối': 'Thủ tục thanh toán rắc rối',
                'Tìm thấy chỗ khác rẻ hơn/tốt hơn': 'Tìm thấy chỗ khác phù hợp hơn',
                'Không có nhu cầu đặt nữa': 'Không có nhu cầu mua nữa',
                'Lý do khác': 'Lý do khác'
            },
            inputPlaceholder: 'Chọn lý do hủy...',
            confirmButtonText: 'Đồng ý hủy',
            cancelButtonText: 'Bỏ qua'
        });

        if (!result.isConfirmed) {
            return;
        }

        const reason = result.value || 'Khách hàng thay đổi ý định';

        setCancelling(true);
        try {
            const success = await orderService.cancelOrder(order.orderId, reason);
            if (success) {
                toast.success('Hủy đơn hàng thành công');
                // Refresh data
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
            text: 'Bạn xác nhận đã nhận đủ hàng và hài lòng với dịch vụ? Thao tác này sẽ hoàn thành đơn hàng.',
            icon: 'question',
            confirmButtonText: 'Hoàn thành',
            cancelButtonText: 'Hủy',
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

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
            case 'COMPLETED': return 'Đã hoàn thành đơn hàng';
            case 'CANCELLED': return 'Đã hủy';
            case 'REFUNDED': return 'Đã hoàn tiền';
            case 'PAYMENTFAILED': return 'Thanh toán lỗi';
            default: return status;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'CONFIRMED': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'PAID': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'PREPARING':
            case 'PROCESSING': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'SHIPPING':
            case 'DELIVERING': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'DELIVERED':
            case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200';
            case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
            case 'REFUNDED': return 'bg-slate-200 text-slate-700 border-slate-200';
            case 'PAYMENTFAILED': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Xác định bước hiện tại của tiến trình giao hàng để hiển thị timeline
    const getTrackingStepIndex = (status: string) => {
        const normalized = status?.toUpperCase() || '';

        if (['PENDING', 'CONFIRMED', 'PAID'].includes(normalized)) return 0; // Đã xác nhận
        if (['PREPARING', 'PROCESSING'].includes(normalized)) return 1; // Chuẩn bị
        if (['SHIPPING', 'DELIVERING'].includes(normalized)) return 2; // Đang giao
        if (['DELIVERED', 'COMPLETED', 'REFUNDED'].includes(normalized)) return 3; // Hoàn tất

        return 0;
    };



    // Customer chỉ được yêu cầu hoàn tiền trong vòng 2h sau khi đơn được giao (DELIVERED)
    // Nếu dữ liệu thời gian giao không khớp (ví dụ trạng thái đã DELIVERED nhưng thời gian giao nằm ở tương lai),
    // FE sẽ KHÔNG chặn, để BE tự kiểm soát.
    const canRequestRefund = (() => {
        if (!order) return false;
        if (order.orderStatus.toUpperCase() !== 'DELIVERED') return false;

        const deliveryDate = (order.delivery as any)?.deliveryDate || (order as any).deliveryDate;
        const deliveryTime = (order.delivery as any)?.deliveryTime || (order as any).deliveryTime || '00:00:00';

        if (!deliveryDate) return true; // nếu thiếu thông tin, không chặn trên FE

        const [h, m, s] = String(deliveryTime).split(':').map((v: string) => parseInt(v, 10) || 0);
        const deliveredAt = new Date(deliveryDate);
        deliveredAt.setHours(h, m, s || 0, 0);

        const now = new Date();
        const diffMs = now.getTime() - deliveredAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Nếu thời gian giao vẫn ở tương lai nhưng trạng thái đã DELIVERED -> không chặn trên FE
        if (diffHours < 0) return true;

        // Ngược lại, chỉ cho phép tối đa 2h sau khi giao
        return diffHours <= 2;
    })();
    const hasRefundRequest = Boolean(refundInfo?.refundId);
    const refundStatus = String(refundInfo?.status || '').toUpperCase();
    const isRefundRejected = refundStatus === 'REJECTED' || (order?.orderStatus || '').toUpperCase() === 'VENDORREJECTED';
    const isRefundApproved = refundStatus === 'APPROVED' || (order?.orderStatus || '').toUpperCase() === 'REFUNDED';
    const refundActionLabel = isRefundRejected
        ? 'Hoàn tiền bị từ chối'
        : isRefundApproved
            ? 'Đã hoàn tiền'
            : 'Đang chờ duyệt hoàn tiền';

    if (loading) {
        return <LoadingScreen message="Đang tải chi tiết đơn hàng..." subMessage="Lấy lại ký ức tâm linh" />;
    }

    if (!order) return null;

    // Resolve vendor profile ID: vendorInfo has the real ID from getAllVendors()
    const vendorProfileId = String(
        vendorInfo?.profileId
        || order?.vendor?.profileId
        || (order as any)?.vendorProfileId
        || (order as any)?.vendorId
        || ''
    ).trim();

    // Resolve vendor avatar: map first (reliable), then vendorInfo (async)
    const vendorAvatarSrc = (() => {
        const shopName = order.vendor?.shopName || (order as any)?.shopName || '';
        return vendorAvatarMap[vendorProfileId]
            || vendorAvatarMap[shopName]
            || vendorInfo?.shopAvatarUrl
            || vendorInfo?.avatarUrl
            || (order.vendor as any)?.shopAvatarUrl
            || (order.vendor as any)?.avatarUrl
            || null;
    })();

    const vendorShopName =
        vendorInfo?.shopName
        || order.vendor?.shopName
        || (order as any)?.shopName
        || (order as any)?.vendorName
        || 'Người cung cấp';


    const rawPreparationProof = (
        (order.delivery as any)?.preparationProofImages
        || (order.delivery as any)?.preparationProofImageUrl
        || (order as any).preparationProofImages
        || (order as any).preparationProofImageUrl
        || null
    );

    const preparationImages: string[] = Array.isArray(rawPreparationProof)
        ? (rawPreparationProof as unknown[]).filter((url) => typeof url === 'string' && (url as string).trim()) as string[]
        : typeof rawPreparationProof === 'string' && rawPreparationProof.trim()
            ? [rawPreparationProof]
            : [];

    const rawDeliveryProof = (
        (order.delivery as any)?.deliveryProofImages
        || order.delivery?.deliveryProofImageUrl
        || (order as any).deliveryProofImageUrl
        || null
    );

    const deliveryImages: string[] = Array.isArray(rawDeliveryProof)
        ? (rawDeliveryProof as unknown[]).filter((url) => typeof url === 'string' && (url as string).trim()) as string[]
        : typeof rawDeliveryProof === 'string' && rawDeliveryProof.trim()
            ? [rawDeliveryProof]
            : [];

    const hasPreparationImages = preparationImages.length > 0;
    const hasDeliveryImages = deliveryImages.length > 0;
    const hasRefundStep = Boolean(refundInfo?.refundId);
    const refundStepLabel = refundInfo?.status === 'Rejected' ? 'Hoàn tiền bị từ chối' : 'Hoàn tiền';
    const refundStepDescription = refundInfo?.status === 'Rejected'
        ? 'Yêu cầu hoàn tiền đã bị từ chối'
        : refundInfo?.status === 'Approved'
            ? 'Yêu cầu hoàn tiền đã được duyệt'
            : 'Đang xử lý yêu cầu hoàn tiền';

    const trackingStepIndex = getTrackingStepIndex(order.orderStatus);
    const trackingSteps = [
        { label: 'Xác nhận', description: 'Tiếp nhận và xác nhận đơn' },
        { label: 'Chuẩn bị', description: 'Chuẩn bị mâm lễ và vật phẩm' },
        { label: 'Đang giao', description: 'Nhân viên đang di chuyển' },
        { label: 'Hoàn tất', description: 'Hoàn thành phục vụ nghi lễ' },
        ...(hasRefundStep ? [{ label: refundStepLabel, description: refundStepDescription }] : []),
    ];
    const displayTrackingStepIndex = hasRefundStep ? trackingSteps.length - 1 : trackingStepIndex;
    const trackingProgressWidth = trackingSteps.length > 1
        ? `${(displayTrackingStepIndex / (trackingSteps.length - 1)) * 100}%`
        : '0%';

    return (
        <div className="bg-gray-50 min-h-screen py-10">
            <div className="max-w-4xl mx-auto px-4 md:px-8">

                {/* Header Navigation */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/profile/orders')}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 font-display">Chi tiết đơn hàng</h1>
                        {/* <p className="text-sm text-gray-500">Mã: #{order.orderId.substring(0, 8).toUpperCase()}</p> */}
                    </div>
                </div>

                {/* Status Banner */}
                <div className={`p-6 rounded-[2rem] border mb-6 flex items-center justify-between ${getStatusStyle(order.orderStatus)}`}>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Trạng thái hiện tại</p>
                        <h2 className="text-2xl font-black">{getStatusText(order.orderStatus)}</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {['PENDING', 'PAID'].includes(order.orderStatus.toUpperCase()) && (
                            <button
                                onClick={handleCancelOrder}
                                disabled={cancelling}
                                className={`px-6 py-2 rounded-xl font-bold text-sm transition bg-white text-red-600 border border-red-200 hover:bg-red-50 ${cancelling ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}
                            </button>
                        )}
                        {/* {['PAID', 'PROCESSING', 'DELIVERING'].includes(order.orderStatus.toUpperCase()) && (
                            <button
                                onClick={() => navigate(`/tracking?orderId=${order.orderId}`)}
                                className="bg-white/90 backdrop-blur-sm text-current px-6 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-white transition"
                            >
                                Theo dõi ngay
                            </button>
                        )} */}
                        {order.orderStatus.toUpperCase() === 'DELIVERED' && (
                            <>
                                {hasRefundRequest ? (
                                    <button
                                        type="button"
                                        disabled
                                        className={`px-6 py-2 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed border ${isRefundRejected
                                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                                            : isRefundApproved
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                : 'bg-orange-50 text-orange-600 border-orange-200'
                                            }`}
                                    >
                                        {refundActionLabel}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            if (!canRequestRefund) {
                                                toast.error('Thời gian yêu cầu hoàn tiền (2 giờ sau khi giao hàng) đã hết.');
                                                return;
                                            }
                                            setIsRefundModalOpen(true);
                                        }}
                                        disabled={!canRequestRefund}
                                        className="bg-white text-orange-600 border border-orange-200 px-6 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-orange-50 transition"
                                    >
                                        Yêu cầu hoàn tiền
                                    </button>
                                )}
                                <button
                                    onClick={handleCompleteOrder}
                                    disabled={completing}
                                    className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {completing ? 'Đang xử lý...' : 'Hoàn thành đơn'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Order Tracking Timeline */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-200 shadow-sm mb-8 overflow-hidden relative">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Theo dõi đơn hàng</p>
                            <p className="text-sm text-gray-500">Mã đơn: <span className="font-mono font-semibold">#{order.orderId}</span></p>
                        </div>
                        {/* <button
                            type="button"
                            onClick={() => navigate(`/tracking?orderId=${order.orderId}`)}
                            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 text-primary hover:border-primary hover:bg-primary/5 transition-all"
                        >
                            <span>Xem chi tiết</span>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button> */}
                    </div>

                    <div className="relative">
                        <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 rounded-full" />
                        <div
                            className="absolute top-5 left-0 h-1 bg-primary rounded-full transition-all duration-500"
                            style={{ width: trackingProgressWidth }}
                        />

                        <div className="relative flex justify-between">
                            {trackingSteps.map((step, index) => {
                                const isActive = index === displayTrackingStepIndex;
                                const isCompleted = index < displayTrackingStepIndex;
                                const isUpcoming = index > displayTrackingStepIndex;

                                return (
                                    <div
                                        key={step.label}
                                        className={`relative z-10 flex flex-col items-center text-center w-24 md:w-32 ${isUpcoming ? 'opacity-40' : ''}`}
                                    >
                                        <div
                                            className={`size-10 md:size-12 rounded-full flex items-center justify-center mb-3 ring-4 ring-white text-sm font-bold shadow-sm ${isActive
                                                ? 'bg-primary text-white animate-pulse'
                                                : isCompleted
                                                    ? 'bg-primary text-white'
                                                    : 'bg-slate-200 text-slate-500'
                                                }`}
                                        >
                                            {index + 1}
                                        </div>
                                        <span className={`text-xs md:text-sm font-semibold ${isActive ? 'text-primary' : 'text-slate-900'}`}>
                                            {step.label}
                                        </span>
                                        <span className="hidden md:block text-[10px] text-slate-400 mt-1 max-w-[120px]">
                                            {step.description}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {Array.isArray(order.trackingLists) && order.trackingLists.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                            <div className="space-y-2">
                                {order.trackingLists
                                    .slice()
                                    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
                                    .map((item, index, arr) => {
                                        const isLast = index === arr.length - 1;
                                        let showPreparationButton = false;
                                        let showDeliveryButton = false;

                                        if (isLast && trackingStepIndex >= 2) {
                                            if (trackingStepIndex < 3) {
                                                // Đang giao: ưu tiên hiển thị ảnh phù hợp hiện có
                                                if (hasPreparationImages) showPreparationButton = true;
                                                if (!hasPreparationImages && hasDeliveryImages) showDeliveryButton = true;
                                            } else {
                                                // Hoàn tất trở đi: hiển thị cả hai nút nếu có ảnh
                                                if (hasPreparationImages) showPreparationButton = true;
                                                if (hasDeliveryImages) showDeliveryButton = true;
                                            }
                                        }

                                        return (
                                            <div key={item.trackingId} className="flex items-start gap-3 text-xs text-gray-600">
                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                                <div className="flex-1 flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{item.title}</p>
                                                        {item.description && (
                                                            <p className="text-gray-500 mt-0.5">{item.description}</p>
                                                        )}
                                                        {item.createdAt && (
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {(showPreparationButton || showDeliveryButton) && (
                                                        <div className="flex items-center gap-2">
                                                            {showPreparationButton && (
                                                                <button
                                                                    onClick={() => {
                                                                        setProofModalTitle('Ảnh chuẩn bị');
                                                                        setProofModalImages(preparationImages);
                                                                        setIsProofModalOpen(true);
                                                                    }}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition whitespace-nowrap"
                                                                >
                                                                    <svg
                                                                        className="w-4 h-4"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                    >
                                                                        <path
                                                                            d="M4 4h16v12H5.17L4 17.17V4z"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                        <path
                                                                            d="M10 11l2 2 3-3"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                    </svg>
                                                                    <span>Ảnh chuẩn bị</span>
                                                                </button>
                                                            )}
                                                            {showDeliveryButton && (
                                                                <button
                                                                    onClick={() => {
                                                                        setProofModalTitle('Ảnh giao hàng');
                                                                        setProofModalImages(deliveryImages);
                                                                        setIsProofModalOpen(true);
                                                                    }}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition whitespace-nowrap"
                                                                >
                                                                    <svg
                                                                        className="w-4 h-4"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                    >
                                                                        <path
                                                                            d="M4 4h16v12H5.17L4 17.17V4z"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                        <path
                                                                            d="M10 11l2 2 3-3"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                    </svg>
                                                                    <span>Ảnh giao hàng</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>

                {(refundInfo?.status === 'Rejected' || order.orderStatus.toUpperCase() === 'VENDORREJECTED') && !refundDismissed && (
                    <div className="bg-white border border-orange-200 rounded-[1.5rem] p-5 mb-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Hoàn tiền bị từ chối</p>
                                <p className="text-sm text-gray-700 mt-1">Bạn muốn khiếu nại lên quản trị không?</p>
                                {refundInfo?.adminNote && (
                                    <p className="text-xs text-gray-500 mt-1">Ghi chú: {refundInfo.adminNote}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDismissRefundNotice}
                                    className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    Không khiếu nại
                                </button>
                                <button
                                    onClick={handleEscalateRefund}
                                    disabled={escalating || !refundInfo?.refundId}
                                    className="px-4 py-2 rounded-xl text-sm font-bold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {escalating ? 'Đang gửi...' : 'Khiếu nại'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Main Info */}
                    <div className="md:col-span-2 space-y-6">

                        {/* Store details */}
                        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-xl shadow-slate-200/40 divide-y divide-slate-50 dark:divide-zinc-800">
                            {/* Card Header Label */}
                            <div className="px-8 py-5 flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-slate-400 text-lg">storefront</span>
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cung cấp bởi</label>
                            </div>

                            {/* Card Body - Shop Info */}
                            <div 
                                className="p-8 flex items-center gap-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all active:scale-[0.98]"
                                onClick={() => vendorProfileId && navigate(`/vendor/${vendorProfileId}`)}
                            >
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex-shrink-0 flex items-center justify-center shadow-inner">
                                    {vendorAvatarSrc ? (
                                        <img
                                            src={vendorAvatarSrc}
                                            alt={vendorShopName}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                    parent.innerHTML = `<span class="text-2xl font-black text-slate-300 dark:text-zinc-600">${vendorShopName.charAt(0).toUpperCase()}</span>`;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-200 dark:text-zinc-700 uppercase">{vendorShopName.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight truncate">{vendorShopName}</h4>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">Xem cửa hàng</span>
                                        <span className="material-symbols-outlined text-[12px] text-slate-300 dark:text-zinc-600">open_in_new</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3 line-clamp-1 italic opacity-60">
                                        {vendorInfo?.shopDescription || 'Dịch vụ mâm cúng trọn gói và trang trí tận nhà.'}
                                    </p>
                                </div>

                                {/* Action Icon */}
                                <div className="text-slate-300">
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </div>
                            </div>
                        </div>

                        {/* Application items */}
                        <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                                Danh sách gói lễ
                            </h3>
                            <div className="space-y-6">
                                {order.items?.map((item, idx) => {
                                    const goToDetail = () => {
                                        console.log('📦 Order Item Debug:', item);
                                        const pkgId = item.packageId;
                                        if (pkgId) {
                                            navigate(`/product/${pkgId}`);
                                        } else {
                                            toast.error('Không tìm thấy thông tin sản phẩm để xem chi tiết');
                                        }
                                    };

                                    return (
                                        <div key={idx} className="flex gap-4 items-start pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                            <div
                                                className="size-20 rounded-2xl bg-gray-100 border border-gray-200 flex-shrink-0 relative overflow-hidden cursor-pointer group/img"
                                                onClick={goToDetail}
                                            >
                                                <img
                                                    src={item.imageUrl || `https://picsum.photos/200?random=${idx}`}
                                                    alt={item.packageName}
                                                    className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.onerror = null;
                                                        target.src = `https://picsum.photos/200?random=${idx}`;
                                                    }}
                                                />
                                                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-bl-lg">
                                                    x{item.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-1 pt-1 min-w-0">
                                                <h4
                                                    className="font-bold text-gray-800 cursor-pointer hover:text-primary transition-colors"
                                                    onClick={goToDetail}
                                                >
                                                    {item.packageName}
                                                </h4>
                                                <div className="flex items-center justify-between mt-1">
                                                    <p className="text-xs text-gray-500 italic">
                                                        Gói: <span className="text-gray-700 font-medium">{item.variantName}</span>
                                                        <span className="ml-2 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-400 font-bold">x{item.quantity}</span>
                                                    </p>
                                                    <p className="text-[11px] font-bold text-slate-500">
                                                        {((item as any).variantSubTotal || (item.price || 0) * item.quantity).toLocaleString('vi-VN')}đ
                                                    </p>
                                                </div>

                                                {/* Swaps */}
                                                {Array.isArray((item as any).swaps) && (item as any).swaps.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {(item as any).swaps.map((swap: any, si: number) => (
                                                            <div key={si} className="flex items-center gap-1.5 text-[11px]">
                                                                <span className="material-symbols-outlined text-amber-500 text-[13px]">swap_horiz</span>
                                                                <span className="text-slate-600">{swap.originalItemName || swap.replacementItemName || swap.addOnName}</span>
                                                                {swap.surcharge > 0 && (
                                                                    <span className="ml-auto text-amber-600 font-bold">+{swap.surcharge.toLocaleString('vi-VN')}đ</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Add-ons */}
                                                {Array.isArray((item as any).addOns) && (item as any).addOns.length > 0 && (
                                                    <div className="mt-2 space-y-1 border-l-2 border-emerald-100 pl-2">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Món kèm</p>
                                                        {(item as any).addOns.map((addOn: any, ai: number) => (
                                                            <div key={ai} className="flex items-center gap-1.5 text-[11px]">
                                                                <span className="material-symbols-outlined text-emerald-500 text-[13px]">add_circle</span>
                                                                <span className="text-slate-700 font-medium">{addOn.addOnName || addOn.itemName}</span>
                                                                <span className="text-slate-400">×{addOn.quantity}</span>
                                                                <span className="ml-auto text-emerald-600 font-bold">+{(addOn.lineTotal || addOn.retailPrice * addOn.quantity).toLocaleString('vi-VN')}đ</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {item.isRequestRefund && (
                                                    <div className="mt-2 flex">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1 ${isRefundRejected
                                                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                            : isRefundApproved
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                : 'bg-orange-50 text-orange-600 border-orange-100'
                                                            }`}>
                                                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" />
                                                            </svg>
                                                            {isRefundRejected ? 'Bị từ chối' : isRefundApproved ? 'Đã hoàn tiền' : 'Đang chờ duyệt'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pt-1 text-right flex-shrink-0 min-w-[100px]">
                                                {order.orderStatus.toUpperCase() === 'COMPLETED' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedItemForReview({ itemId: item.itemId, packageName: item.packageName });
                                                            setIsReviewModalOpen(true);
                                                        }}
                                                        className="mt-2 text-xs font-bold text-primary hover:text-primary/70 transition-all underline underline-offset-4"
                                                    >
                                                        Viết đánh giá
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Side Info */}
                    <div className="space-y-6">

                        {/* Payment Summary */}
                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100">Thanh toán</h3>

                            <div className="space-y-3 text-sm mb-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tạm tính :</span>
                                    <span className="font-medium">{(order.pricing?.subTotal || (order.pricing as any)?.subTotal || (order as any).subTotal || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Phí giao hàng :</span>
                                    <span className="font-medium">{(order.pricing?.shippingFee || (order.pricing as any)?.totalShippingFee || (order as any).shippingFee || (order as any).totalShippingFee || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                {((order.pricing as any)?.discountAmount || (order.pricing as any)?.totalDiscount || (order as any).totalDiscount || (order as any).discountAmount || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Giảm giá</span>
                                        <span className="font-medium text-green-600">- {((order.pricing as any)?.discountAmount || (order.pricing as any)?.totalDiscount || (order as any).totalDiscount || (order as any).discountAmount || 0).toLocaleString('vi-VN')}đ</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-end">
                                <span className="text-sm font-bold text-gray-700">Tổng cộng :</span>
                                <span className="text-2xl font-black text-primary">{((order.pricing as any)?.finalAmount || order.pricing?.totalAmount || (order as any).totalAmount || (order as any).finalAmount || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                        </div>

                        {/* Delivery Details */}
                        <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100">Giao hàng</h3>

                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Thời gian phục vụ</p>
                                    <p className="font-bold text-gray-800">
                                        {(order.delivery?.deliveryDate || (order as any).deliveryDate) ? new Date(order.delivery?.deliveryDate || (order as any).deliveryDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                                        {(order.delivery?.deliveryTime || (order as any).deliveryTime) ? ` lúc ${(order.delivery?.deliveryTime || (order as any).deliveryTime)}` : ''}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Người nhận</p>
                                    <p className="font-medium text-sm text-gray-800">
                                        <span className="font-bold">{order.customer?.fullName || (order.customer as any)?.customerName || (order as any).customerName || 'Chưa cập nhật'}</span>
                                        {(order.customer?.phoneNumber || (order.customer as any)?.customerPhone || (order as any).customerPhone) && <span className="text-gray-500 ml-1">- {(order.customer?.phoneNumber || (order.customer as any)?.customerPhone || (order as any).customerPhone)}</span>}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Địa chỉ giao mâm</p>
                                    <p className="font-medium text-sm text-gray-800 leading-relaxed">{order.delivery?.deliveryAddress || (order as any).deliveryAddress}</p>
                                </div>

                                {/* {preparationImages.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-2">Ảnh chuẩn bị</p>
                                        <button
                                            onClick={() => {
                                                setProofModalTitle('Ảnh chuẩn bị');
                                                setProofModalImages(preparationImages);
                                                setIsProofModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition"
                                        >
                                            Xem ảnh
                                        </button>
                                    </div>
                                )} */}
                                {/* {deliveryImages.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-2">Ảnh giao hàng</p>
                                        <button
                                            onClick={() => {
                                                setProofModalTitle('Ảnh giao hàng');
                                                setProofModalImages(deliveryImages);
                                                setIsProofModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition"
                                        >
                                            Xem ảnh
                                        </button>
                                    </div>
                                )} */}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {/* Refund Modal */}
            <RefundModal
                isOpen={isRefundModalOpen}
                onClose={() => setIsRefundModalOpen(false)}
                onSuccess={fetchOrder}
                order={order}
            />

            {/* Review Modal */}
            {selectedItemForReview && (
                <ReviewModal
                    isOpen={isReviewModalOpen}
                    onClose={() => {
                        setIsReviewModalOpen(false);
                        setSelectedItemForReview(null);
                    }}
                    onSuccess={fetchOrder}
                    itemId={selectedItemForReview.itemId}
                    packageName={selectedItemForReview.packageName}
                />
            )}

            <ImageModal
                isOpen={isProofModalOpen}
                images={proofModalImages}
                imageSrc={proofModalImages[0] || ''}
                altText={proofModalTitle}
                onClose={() => setIsProofModalOpen(false)}
            />
        </div>
    );
};

export default OrderDetailsPage;
