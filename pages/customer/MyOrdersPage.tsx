import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService, Order } from '../../services/orderService';
import { vendorService } from '../../services/vendorService';
import { refundService, RefundRecord } from '../../services/refundService';
import { getProfile } from '../../services/auth';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';

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

    const fetchRefunds = async (profileId: string) => {
        try {
            const data = await refundService.getAllRefunds();
            // CHỈ lấy những refund thuộc về chính khách hàng này (Bảo mật)
            const myRefunds = profileId
                ? (data || []).filter(r => r.customerId === profileId)
                : [];
            setRefunds(myRefunds);
        } catch (error) {
            console.error('Lỗi khi lấy danh sách hoàn tiền:', error);
        }
    };

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Fetch profile first to get the correct profileId for refunds
            const profile = await getProfile();
            const profileId = profile?.profileId || "";
            
            // Run both fetches in parallel
            await Promise.all([
                fetchOrders(),
                fetchRefunds(profileId)
            ]);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu:', error);
            // Fallback: still try to fetch orders if profile fetch fails
            await fetchOrders();
        } finally {
            setLoading(false);
        }
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
        }).catch(() => { });
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
            const success = await orderService.cancelOrder(orderId, reason, 'customer');
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

    // Combine actual refund records from API with virtual records derived from orders (using isRequestRefund flag)
    const combinedRefunds: RefundRecord[] = React.useMemo(() => {
        // Create virtual refund records from orders that have items with isRequestRefund = true
        const virtualRefunds: RefundRecord[] = orders
            .filter(o => o.items?.some(it => it.isRequestRefund))
            .map(o => {
                const refundItems = o.items
                    .filter(it => it.isRequestRefund)
                    .map((it, idx) => ({
                        refundItemId: it.itemId || `vitem-${o.orderId}-${idx}`,
                        orderItemId: it.itemId,
                        packageName: it.packageName,
                        variantName: it.variantName,
                        quantity: it.quantity,
                        refundAmount: it.lineTotal || (it.price * it.quantity),
                        price: it.price,
                        imageUrl: it.imageUrl,
                        packageId: it.packageId
                    }));

                // Check if we have a real refund record for this order to get accurate status
                const realRecord = refunds.find(r => r.orderId === o.orderId);

                return {
                    refundId: realRecord?.refundId || `vrefund-${o.orderId}`,
                    orderId: o.orderId,
                    orderCode: o.orderId.substring(0, 8).toUpperCase(),
                    customerId: o.customer?.profileId || '',
                    customerName: o.customer?.fullName || 'Khách hàng',
                    customerEmail: o.customer?.email || '',
                    customerPhone: o.customer?.phoneNumber || '',
                    reason: realRecord?.reason || o.cancelReason || 'Yêu cầu hoàn từ đơn hàng',
                    status: realRecord?.status || (o.orderStatus.toUpperCase() === 'REFUNDED' ? 'Approved' : 'Pending'),
                    refundAmount: realRecord?.refundAmount || refundItems.reduce((sum, it) => sum + it.refundAmount, 0),
                    orderFinalAmount: o.pricing?.totalAmount || 0,
                    createdAt: realRecord?.createdAt || o.createdAt,
                    items: realRecord?.items || refundItems,
                    proofImages: realRecord?.proofImages || [],
                    processedAt: realRecord?.processedAt || null,
                    processedBy: realRecord?.processedBy || null,
                    adminNote: realRecord?.adminNote || null
                } as RefundRecord;
            });

        // Add any actual refunds that might not have matching orders in the current list (though rare)
        const all = [...virtualRefunds];
        refunds.forEach(r => {
            if (!all.some(vr => vr.orderId === r.orderId)) {
                all.push(r);
            }
        });

        // Sort by date descending
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [orders, refunds]);


    const filteredOrders = activeTab === 'ALL'
        ? orders
        : activeTab === 'REFUND'
            ? []
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
        return <LoadingScreen message="Đang tải danh sách đơn hàng..." subMessage="Xem lại lịch sử cúng bái" />;
    }

    return (
        <div className="bg-gray-50 dark:bg-[#09090b] min-h-screen py-12">
            <div className="max-w-5xl mx-auto px-4 md:px-8">
                <div className="mb-6 md:mb-10 text-center sm:text-left">
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white font-display italic tracking-tight leading-tight">Đơn hàng của tôi</h1>
                    <p className="text-sm md:text-lg text-black dark:text-zinc-400 mt-2 font-medium">Theo dõi và quản lý lịch sử đặt mâm cúng của bạn.</p>
                </div>

                {/* Tabs */}
                <div className="sticky top-16 z-20 bg-gray-50/95 dark:bg-[#09090b]/95 backdrop-blur-md -mx-4 px-4 mb-10 border-b border-slate-200 dark:border-white/10 hide-scrollbar overflow-x-auto shadow-sm">
                    <div className="flex space-x-2 py-3">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'text-white bg-slate-900 dark:bg-zinc-800 shadow-xl shadow-slate-900/20 dark:shadow-none'
                                    : 'text-black dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 hover:shadow-sm'
                                    }`}
                            >
                                {tab.label}
                                {tab.id === 'REFUND' && combinedRefunds.length > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[8px]">
                                        {combinedRefunds.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Orders List */}
                <div className="space-y-6">
                    {activeTab === 'REFUND' ? (
                        combinedRefunds.length === 0 ? (
                            <div className="bg-white dark:bg-[#18181b] p-12 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm text-center">
                                <div className="size-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Chưa có yêu cầu hoàn tiền nào</h3>
                                <p className="text-gray-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto">
                                    Bạn chưa có yêu cầu hoàn tiền nào. Nếu có vấn đề với đơn hàng, hãy gửi yêu cầu hoàn tiền nhé!
                                </p>
                            </div>
                        ) : (
                            combinedRefunds.map((refund) => (
                                <div key={refund.refundId} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/40 hover:shadow-orange-500/5 hover:border-orange-500/10 transition-all duration-500 group">
                                    <div className="p-5 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/20 dark:bg-white/5">
                                        <div className="flex flex-row md:flex-row gap-4 items-center justify-between md:justify-start w-full md:w-auto">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-black tracking-widest block mb-1">Ngày yêu cầu</span>
                                                <span className="text-gray-900 dark:text-white font-bold text-sm">{new Date(refund.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${refund.status === 'Approved' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' : refund.status === 'Rejected' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'}`}>
                                                    {refund.status === 'Approved' ? 'Đã hoàn tiền' : refund.status === 'Rejected' ? 'Đã từ chối' : 'Đang xử lý'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8 bg-white dark:bg-[#18181b]">
                                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-dashed border-gray-100 dark:border-white/5">
                                            <div
                                                className={`size-8 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center text-primary dark:text-orange-400 shrink-0`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    {refund.orderCode ? `Đơn hàng #${refund.orderCode}` : `Yêu cầu cho đơn #${refund.orderId.substring(0, 8).toUpperCase()}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {refund.items?.map((item, idx) => (
                                                <div key={idx} className="flex gap-4 items-center group/item">
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-gray-900 dark:text-white text-sm md:text-base">
                                                            {item.packageName}
                                                        </h5>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] md:text-xs text-black dark:text-zinc-500 font-medium">Gói {item.variantName}</p>
                                                            <span className="size-1 bg-gray-300 dark:bg-white/10 rounded-full"></span>
                                                            <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">x{item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-primary dark:text-white text-sm md:text-lg">
                                                            {item.refundAmount.toLocaleString('vi-VN')}₫
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-white/5">
                                            <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase font-black tracking-widest mb-1">Lý do</p>
                                            <p className="text-sm text-gray-600 dark:text-zinc-400 italic">"{refund.reason}"</p>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8 pt-0 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50 dark:border-white/5 mt-2 bg-white dark:bg-[#18181b]">
                                        <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-black dark:text-zinc-500 uppercase tracking-widest">Tổng hoàn lại</span>
                                                <span className="text-xl md:text-2xl font-black text-primary dark:text-white">
                                                    {refund.refundAmount.toLocaleString('vi-VN')}₫
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full md:w-auto">
                                            <button
                                                onClick={() => navigate(`/profile/orders/${refund.orderId}?refundId=${refund.refundId}`)}
                                                className="flex-1 md:flex-none px-8 py-3.5 rounded-2xl bg-slate-900 dark:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-primary dark:hover:bg-zinc-700 hover:shadow-xl transition-all active:scale-95"
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
                                <div key={order.orderId} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none hover:shadow-primary/5 hover:border-primary/10 transition-all duration-500 group">
                                    <div className="p-5 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-between border-b border-gray-100 dark:border-zinc-800 bg-gray-50/20 dark:bg-zinc-800/50">
                                        <div className="flex flex-row md:flex-row gap-4 items-center justify-between md:justify-start w-full md:w-auto">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-black dark:text-zinc-500 tracking-widest block mb-1">Ngày đặt</span>
                                                <span className="text-gray-900 dark:text-white font-bold text-sm">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</span>
                                            </div>
                                            <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(order.orderStatus)}`}>
                                                    {getStatusText(order.orderStatus)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8">
                                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-dashed border-gray-100 dark:border-white/5">
                                            {(() => {
                                                const shopName = order.vendor?.shopName || (order as any).shopName || "Cửa hàng";
                                                const vId = String(order.vendor?.profileId || (order as any).vendorProfileId || (order as any).vendorId || '').trim();
                                                const avatarSrc = vendorAvatarMap[vId] || vendorAvatarMap[shopName] || '';

                                                return (
                                                    <div
                                                        className={`size-10 rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex-shrink-0 flex items-center justify-center shadow-sm transition-transform active:scale-95 ${vId ? 'cursor-pointer hover:border-primary/50' : ''}`}
                                                        onClick={() => vId && navigate(`/vendor/${vId}`)}
                                                    >
                                                        {avatarSrc ? (
                                                            <img
                                                                src={avatarSrc}
                                                                alt={shopName}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                    const parent = target.parentElement;
                                                                    if (parent) {
                                                                        parent.innerHTML = `<span class="text-base font-black text-slate-300 dark:text-zinc-600">${shopName.charAt(0).toUpperCase()}</span>`;
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="text-base font-black text-slate-200 dark:text-zinc-700 uppercase">{shopName.charAt(0).toUpperCase()}</span>
                                                        )}
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
                                                            className={`font-bold text-gray-900 dark:text-white text-left transition-colors ${vId ? 'cursor-pointer hover:text-primary active:scale-95' : 'cursor-default'}`}
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
                                                        className="size-16 md:size-20 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 shrink-0 overflow-hidden shadow-sm group-hover/item:scale-105 transition-all cursor-pointer flex items-center justify-center"
                                                        onClick={() => (item as any).packageId && navigate(`/product/${(item as any).packageId}`)}
                                                    >
                                                        <img
                                                            src={item.imageUrl || 'https://picsum.photos/200?random=1'}
                                                            alt={item.packageName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.src = 'https://picsum.photos/200?random=fallback';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5
                                                            className="font-bold text-gray-900 dark:text-zinc-100 text-sm md:text-base cursor-pointer hover:text-primary transition-colors truncate"
                                                            onClick={() => (item as any).packageId && navigate(`/product/${(item as any).packageId}`)}
                                                        >
                                                            {item.packageName}
                                                        </h5>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] md:text-xs text-black dark:text-zinc-500 font-medium">Gói {item.variantName}</p>
                                                            <span className="size-1 bg-gray-300 dark:bg-zinc-700 rounded-full"></span>
                                                            <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">x{item.quantity}</p>
                                                        </div>
                                                        {item.isRequestRefund && (
                                                            <div className="mt-1 flex">
                                                                <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-md text-[9px] font-black uppercase tracking-widest border border-orange-100 dark:border-orange-500/20 flex items-center gap-1">
                                                                    <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                                                                    </svg>
                                                                    Đã yêu cầu hoàn tiền
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-primary dark:text-white text-sm md:text-lg">
                                                            {(item.lineTotal || (item.price || (item as any).unitPrice || 0) * item.quantity).toLocaleString('vi-VN')}₫
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-8 pt-0 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50 dark:border-zinc-800 mt-2 bg-white dark:bg-zinc-900">
                                        <div className="flex flex-col items-center md:items-start w-full md:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-black dark:text-zinc-500 uppercase tracking-widest">Tổng cộng</span>
                                                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                                                    {(order.pricing?.totalAmount || order.pricing?.finalAmount || 0).toLocaleString('vi-VN')}₫
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-black dark:text-zinc-500 uppercase tracking-tighter mt-1">
                                                (Đã bao gồm phí vận chuyển)
                                            </p>
                                        </div>
                                        <div className="flex gap-3 w-full md:w-auto">
                                            {['PENDING', 'PAID'].includes(order.orderStatus.toUpperCase()) && (
                                                <button
                                                    onClick={() => handleCancelOrder(order.orderId)}
                                                    disabled={cancellingId === order.orderId}
                                                    className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-red-50 dark:border-red-500/10 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {cancellingId === order.orderId ? 'Đang xử lý...' : 'Hủy đơn'}
                                                </button>
                                            )}

                                            {(() => {
                                                const normalizedStatus = order.orderStatus.toUpperCase();
                                                if (normalizedStatus !== 'DELIVERED') return null;

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
                                                        className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl border-2 border-orange-50 dark:border-orange-500/10 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-all active:scale-95"
                                                    >
                                                        Hoàn tiền
                                                    </button>
                                                );
                                            })()}

                                            <button
                                                onClick={() => navigate(`/profile/orders/${order.orderId}`)}
                                                className="flex-1 md:flex-none px-8 py-3.5 rounded-2xl bg-slate-900 dark:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-primary dark:hover:bg-zinc-700 hover:shadow-xl transition-all active:scale-95"
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
