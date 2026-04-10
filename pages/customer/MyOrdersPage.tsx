import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService, Order } from '../../services/orderService';
import { vendorService } from '../../services/vendorService';
import { refundService, RefundRecord } from '../../services/refundService';
import toast from '../../services/toast';

const MyOrdersPage: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [refunds, setRefunds] = useState<RefundRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL');
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    // Map from shopName -> shopAvatarUrl
    const [vendorAvatarMap, setVendorAvatarMap] = useState<Record<string, string>>({});

    const fetchOrders = async () => {
        try {
            const data = await orderService.getMyOrders();
            // Sắp xếp đơn hàng theo thời gian (tăng dần)
            const sortedOrders = (data || []).sort((a, b) => {
                const getTime = (o: any) => {
                    if (o.createdAt) return new Date(o.createdAt).getTime();
                    // Fallback to delivery date if createdAt is missing
                    if (o.deliveryDate) return new Date(`${o.deliveryDate}T${o.deliveryTime || '00:00:00'}`).getTime();
                    return 0;
                };
                return getTime(b) - getTime(a);
            });
            setOrders(sortedOrders);
        } catch (error) {
            console.error('Lỗi khi lấy danh sách đơn hàng:', error);
            toast.error('Không thể tải danh sách đơn hàng.');
        } 
    };

    const fetchRefunds = async () => {
        try {
            const data = await refundService.getAllRefunds();
            setRefunds(data || []);
        } catch (error) {
            console.error('Lỗi khi lấy danh sách hoàn tiền:', error);
        }
    };

    const loadAllData = async () => {
        setLoading(true);
        await Promise.all([fetchOrders(), fetchRefunds()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAllData();
        // Load all vendors to get their avatars
        vendorService.getAllVendors().then(vendors => {
            const map: Record<string, string> = {};
            vendors.forEach(v => {
                const avatar = v.shopAvatarUrl || v.avatarUrl || '';
                if (v.shopName && avatar) map[v.shopName] = avatar;
                if (v.profileId && avatar) map[v.profileId] = avatar;
            });
            setVendorAvatarMap(map);
        }).catch(() => {});
    }, []);

    const handleCancelOrder = async (orderId: string) => {
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

        setCancellingId(orderId);
        try {
            const success = await orderService.cancelOrder(orderId, reason);
            if (success) {
                toast.success('Hủy đơn hàng thành công');
                await fetchOrders();
            } else {
                toast.error('Hủy đơn hàng thất bại');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hủy đơn hàng thất bại. Vui lòng thử lại.');
        } finally {
            setCancellingId(null);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-700';
            case 'CONFIRMED': return 'bg-sky-100 text-sky-700';
            case 'PAID': return 'bg-blue-100 text-blue-700';
            case 'PREPARING':
            case 'PROCESSING': return 'bg-purple-100 text-purple-700';
            case 'SHIPPING':
            case 'DELIVERING': return 'bg-indigo-100 text-indigo-700';
            case 'DELIVERED':
            case 'COMPLETED': return 'bg-green-100 text-green-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            case 'REFUNDED': return 'bg-slate-200 text-slate-700';
            case 'PAYMENTFAILED': return 'bg-rose-100 text-rose-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status: string) => {
        switch (status.toUpperCase()) {
            // case 'PENDING': return 'Chờ thanh toán';
            case 'CONFIRMED': return 'Đã xác nhận';
            case 'PAID': return 'Đã thanh toán';
            case 'PREPARING':
            case 'PROCESSING': return 'Đang chuẩn bị';
            case 'SHIPPING':
            case 'DELIVERING': return 'Đang giao hàng';
            case 'DELIVERED': return 'Đã giao hàng';
            case 'COMPLETED': return 'Đơn hàng đã hoàn thành';
            case 'CANCELLED': return 'Đã hủy';
            case 'REFUNDED': return 'Đã hoàn tiền';
            case 'PAYMENTFAILED': return 'Thanh toán lỗi';
            default: return status;
        }
    };

    const filteredOrders = activeTab === 'ALL'
        ? orders
        : activeTab === 'REFUND'
            ? [] // We handle refunds separately below
            : orders.filter(o => (o.orderStatus || '').toUpperCase() === activeTab);

    const tabs = [
        { id: 'ALL', label: 'Tất cả' },
        { id: 'PAID', label: 'Đang xử lý' },
        { id: 'DELIVERING', label: 'Đang giao' },
        { id: 'DELIVERED', label: 'Đã giao' },
        { id: 'COMPLETED', label: 'Đã hoàn thành' },
        { id: 'CANCELLED', label: 'Đã hủy' },
        { id: 'REFUND', label: 'Trả hàng/Hoàn tiền' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mb-4"></div>
                    <p className="text-slate-500 font-medium">Đang tải danh sách đơn hàng...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen py-12">
            <div className="max-w-5xl mx-auto px-4 md:px-8">
                <div className="mb-6 md:mb-10 text-center sm:text-left">
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 font-display italic tracking-tight leading-tight">Đơn hàng của tôi</h1>
                    <p className="text-sm md:text-lg text-slate-500 mt-2 font-medium">Theo dõi và quản lý lịch sử đặt mâm cúng của bạn.</p>
                </div>

                {/* Tabs */}
                <div className="sticky top-16 z-20 bg-gray-50/95 backdrop-blur-md -mx-4 px-4 mb-10 border-b border-slate-200 hide-scrollbar overflow-x-auto shadow-sm">
                    <div className="flex space-x-2 py-3">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'text-white bg-slate-900 shadow-xl shadow-slate-900/20'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm'
                                    }`}
                            >
                                {tab.label}
                                {tab.id === 'REFUND' && refunds.length > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[8px]">
                                        {refunds.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Orders List */}
                <div className="space-y-6">
                    {activeTab === 'REFUND' ? (
                        refunds.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center">
                                <div className="size-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có yêu cầu hoàn tiền nào</h3>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                    Bạn chưa có yêu cầu hoàn tiền nào. Nếu có vấn đề với đơn hàng, hãy gửi yêu cầu hoàn tiền nhé!
                                </p>
                            </div>
                        ) : (
                            refunds.map((refund) => (
                                <div key={refund.refundId} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/40 hover:shadow-orange-500/5 hover:border-orange-500/10 transition-all duration-500 group">
                                    <div className="p-5 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-between border-b border-gray-100 bg-gray-50/20">
                                        <div className="flex flex-row md:flex-row gap-4 items-center justify-between md:justify-start w-full md:w-auto">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest block mb-1">Ngày yêu cầu</span>
                                                <span className="text-gray-900 font-bold text-sm">{new Date(refund.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="hidden md:block w-px h-8 bg-gray-200"></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${refund.status === 'Approved' ? 'bg-green-100 text-green-700' : refund.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {refund.status === 'Approved' ? 'Đã hoàn tiền' : refund.status === 'Rejected' ? 'Đã từ chối' : 'Đang xử lý'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8">
                                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-dashed border-gray-100">
                                            <div
                                                className={`size-8 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-900">
                                                    {refund.orderCode ? `Đơn hàng #${refund.orderCode}` : `Yêu cầu cho đơn #${refund.orderId.substring(0, 8).toUpperCase()}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {refund.items?.map((item, idx) => (
                                                <div key={idx} className="flex gap-4 items-center group/item">
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-gray-900 text-sm md:text-base">
                                                            {item.packageName}
                                                        </h5>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] md:text-xs text-slate-400 font-medium">Gói {item.variantName}</p>
                                                            <span className="size-1 bg-gray-300 rounded-full"></span>
                                                            <p className="text-xs font-bold text-gray-700">x{item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-primary text-sm md:text-lg">
                                                            {item.refundAmount.toLocaleString('vi-VN')}₫
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-50">
                                            <p className="text-xs text-gray-400 uppercase font-black tracking-widest mb-1">Lý do</p>
                                            <p className="text-sm text-gray-600 italic">"{refund.reason}"</p>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8 pt-0 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50 mt-2">
                                        <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng hoàn lại</span>
                                                <span className="text-xl md:text-2xl font-black text-primary">
                                                    {refund.refundAmount.toLocaleString('vi-VN')}₫
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full md:w-auto">
                                            <button
                                                onClick={() => navigate(`/profile/orders/${refund.orderId}?refundId=${refund.refundId}`)}
                                                className="flex-1 md:flex-none px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-95"
                                            >
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        filteredOrders.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center">
                                <div className="size-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có đơn hàng nào</h3>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                    {activeTab === 'ALL'
                                        ? 'Bạn chưa có đơn hàng nào. Hãy khám phá các mâm cúng của chúng tôi nhé!'
                                        : 'Bạn chưa có đơn hàng nào ở trạng thái này.'}
                                </p>
                                {activeTab === 'ALL' && (
                                    <button
                                        onClick={() => navigate('/shop')}
                                        className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                                    >
                                        Khám phá ngay
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredOrders.map((order) => (
                                <div key={order.orderId} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/40 hover:shadow-primary/5 hover:border-primary/10 transition-all duration-500 group">
                                    <div className="p-5 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-between border-b border-gray-100 bg-gray-50/20">
                                        <div className="flex flex-row md:flex-row gap-4 items-center justify-between md:justify-start w-full md:w-auto">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest block mb-1">Ngày đặt</span>
                                                <span className="text-gray-900 font-bold text-sm">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</span>
                                            </div>
                                            <div className="hidden md:block w-px h-8 bg-gray-200"></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(order.orderStatus)}`}>
                                                    {getStatusText(order.orderStatus)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8">
                                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-dashed border-gray-100">
                                            {(() => {
                                                const shopName = order.vendor?.shopName || (order as any).shopName || '';
                                                const vId = String(order.vendor?.profileId || (order as any).vendorProfileId || (order as any).vendorId || '').trim();
                                                const avatarSrc = vendorAvatarMap[vId] || vendorAvatarMap[shopName] || '';
                                                return avatarSrc ? (
                                                    <div
                                                        className={`size-8 rounded-full overflow-hidden border border-orange-100 shrink-0 transition-transform active:scale-90 ${vId ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                                                        onClick={() => vId && navigate(`/vendor/${vId}`)}
                                                    >
                                                        <img
                                                            src={avatarSrc}
                                                            alt={shopName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`size-8 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0 transition-transform active:scale-90 ${vId ? 'cursor-pointer hover:bg-orange-200' : ''}`}
                                                        onClick={() => vId && navigate(`/vendor/${vId}`)}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                    </div>
                                                );
                                            })()}
                                            <div>
                                                {(() => {
                                                    const vId = String(
                                                        order.vendor?.profileId
                                                        || (order as any).vendorProfileId
                                                        || (order as any).vendorId
                                                        || ''
                                                    ).trim();
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => vId && navigate(`/vendor/${vId}`)}
                                                            className={`font-bold text-gray-900 text-left transition-colors ${vId ? 'cursor-pointer hover:text-primary active:scale-95' : 'cursor-default'}`}
                                                        >
                                                            {order.vendor?.shopName || (order as any).shopName || "Tiệm Cúng Bái"}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} className="flex gap-4 items-center group/item">
                                                    <div
                                                        className="size-14 md:size-20 rounded-2xl bg-gray-100 border border-gray-100 shrink-0 bg-cover bg-center shadow-sm group-hover/item:scale-105 transition-all cursor-pointer"
                                                        style={{ backgroundImage: `url("${item.imageUrl || 'https://picsum.photos/200?random=1'}")` }}
                                                        onClick={() => (item as any).packageId && navigate(`/product/${(item as any).packageId}`)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <h5
                                                            className="font-bold text-gray-900 text-sm md:text-base cursor-pointer hover:text-primary transition-colors truncate"
                                                            onClick={() => (item as any).packageId && navigate(`/product/${(item as any).packageId}`)}
                                                        >
                                                            {item.packageName}
                                                        </h5>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] md:text-xs text-slate-400 font-medium">Gói {item.variantName}</p>
                                                            <span className="size-1 bg-gray-300 rounded-full"></span>
                                                            <p className="text-xs font-bold text-gray-700">x{item.quantity}</p>
                                                        </div>
                                                        {item.isRequestRefund && (
                                                            <div className="mt-1 flex">
                                                                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md text-[9px] font-black uppercase tracking-widest border border-orange-100 flex items-center gap-1">
                                                                    <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                                                                    </svg>
                                                                    Đã hoàn tiền
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-primary text-sm md:text-lg">
                                                            {(item.lineTotal || (item.price || (item as any).unitPrice || 0) * item.quantity).toLocaleString('vi-VN')}₫
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8 pt-0 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50 mt-2">
                                        <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng cộng</span>
                                                <span className="text-xl md:text-2xl font-black text-slate-900">
                                                    {(order.pricing?.totalAmount || order.pricing?.finalAmount || 0).toLocaleString('vi-VN')}₫
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                                                (Đã bao gồm phí vận chuyển)
                                            </p>
                                        </div>
                                        <div className="flex gap-3 w-full md:w-auto">
                                            {['PENDING', 'PAID'].includes(order.orderStatus.toUpperCase()) && (
                                                <button
                                                    onClick={() => handleCancelOrder(order.orderId)}
                                                    disabled={cancellingId === order.orderId}
                                                    className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-red-50 text-red-500 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {cancellingId === order.orderId ? 'Đang xử lý...' : 'Hủy đơn'}
                                                </button>
                                            )}

                                            {(() => {
                                                if (order.orderStatus.toUpperCase() !== 'DELIVERED') return null;

                                                const hasRefundRequest = order.items?.some(it => it.isRequestRefund);
                                                if (hasRefundRequest) return null;

                                                const deliveryDate = (order.delivery as any)?.deliveryDate || (order as any).deliveryDate;
                                                const deliveryTime = (order.delivery as any)?.deliveryTime || (order as any).deliveryTime || '00:00:00';

                                                let canRequest = true;
                                                if (deliveryDate) {
                                                    const [h, m, s] = String(deliveryTime).split(':').map((v: string) => parseInt(v, 10) || 0);
                                                    const deliveredAt = new Date(deliveryDate);
                                                    deliveredAt.setHours(h, m, s || 0, 0);
                                                    const diffHours = (new Date().getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);
                                                    if (diffHours > 2) canRequest = false;
                                                }

                                                if (!canRequest) return null;

                                                return (
                                                    <button
                                                        onClick={() => navigate(`/profile/orders/${order.orderId}?requestRefund=true`)}
                                                        className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl border-2 border-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all active:scale-95"
                                                    >
                                                        Hoàn tiền
                                                    </button>
                                                );
                                            })()}

                                            <button
                                                onClick={() => navigate(`/profile/orders/${order.orderId}`)}
                                                className="flex-1 md:flex-none px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-95"
                                            >
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyOrdersPage;
