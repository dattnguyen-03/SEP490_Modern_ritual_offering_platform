
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { checkoutService, CheckoutSummary } from '../../services/checkoutService';
import { cartService } from '../../services/cartService';
import { getCurrentUser, getProfile } from '../../services/auth';
import { addressService, CustomerAddress } from '../../services/addressService';
import toast from '../../services/toast';

const PENDING_CHECKOUT_KEY = 'pendingCheckoutRequest';
const TOPUP_SUCCESS_TOAST_KEY = 'checkoutTopupSuccessToast';
const TOPUP_CANCEL_TOAST_KEY = 'checkoutTopupCancelToast';

const CheckoutPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PayOS');
  const [decorationNotes, setDecorationNotes] = useState<{ [key: number]: string }>({});
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [selectingAddress, setSelectingAddress] = useState(false);
  const [showHoldFeeInfo, setShowHoldFeeInfo] = useState(false);

  const timeSlots = [
    { value: '07:00:00', label: '7:00 - 9:00 (Tý-Sửu)' },
    { value: '09:00:00', label: '9:00 - 11:00 (Dần-Mão)' },
    { value: '13:00:00', label: '13:00 - 15:00 (Tỵ-Ngọ)' },
    { value: '15:00:00', label: '15:00 - 17:00 (Mùi-Thân)' },
    { value: '17:00:00', label: '17:00 - 19:00 (Dậu-Tuất)' }
  ];

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      console.log(' User not authenticated, redirecting to login');
      navigate('/auth?redirect=/checkout');
      return;
    }
    setIsCheckingAuth(false);
  }, [navigate]);

  useEffect(() => {
    if (sessionStorage.getItem(TOPUP_CANCEL_TOAST_KEY) === '1') {
      sessionStorage.removeItem(TOPUP_CANCEL_TOAST_KEY);
      toast.info('Bạn đã hủy thanh toán. Đã quay lại trang thanh toán.');
    }

    if (sessionStorage.getItem(TOPUP_SUCCESS_TOAST_KEY) === '1') {
      sessionStorage.removeItem(TOPUP_SUCCESS_TOAST_KEY);
      toast.success('Nạp tiền thành công, bạn có thể đặt hàng rồi đó.');
    }
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;

    const fetchSummary = async () => {
      const cartItemParam = searchParams.get('cartItemId');

      if (!cartItemParam) {
        toast.error('Không tìm thấy sản phẩm để thanh toán');
        navigate('/cart');
        return;
      }

      const cartItemIds = cartItemParam
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !Number.isNaN(id));

      if (cartItemIds.length === 0) {
        toast.error('Không tìm thấy sản phẩm để thanh toán');
        navigate('/cart');
        return;
      }

      try {
        setLoading(true);
        // Fetch addresses first
        const addressList = await addressService.getAddresses();
        setAddresses(addressList);

        let cartImageMap = new Map<number, string>();
        try {
          const cartData = await cartService.getCart();
          if (cartData?.cartItems?.length) {
            cartImageMap = new Map(
              cartData.cartItems
                .filter((item) => Boolean(item.imageUrl))
                .map((item) => [item.cartItemId, item.imageUrl as string])
            );
          }
        } catch (cartError) {
          console.warn('⚠️ Could not load cart images for checkout:', cartError);
        }

        const summaryData = await checkoutService.getSummary(cartItemIds);

        if (summaryData) {
          const enrichedItems = (summaryData.items || []).map((item: any) => ({
            ...item,
            imageUrl: item.imageUrl || cartImageMap.get(Number(item.cartItemId)) || item.packageAvatarUrl || item.packageImageUrl || item.productImageUrl || null,
          }));

          const enrichedVendorOrders = (summaryData.vendorOrders || []).map((vendorOrder: any) => ({
            ...vendorOrder,
            items: Array.isArray(vendorOrder.items)
              ? vendorOrder.items.map((item: any) => ({
                  ...item,
                  imageUrl: item.imageUrl || cartImageMap.get(Number(item.cartItemId)) || item.packageAvatarUrl || item.packageImageUrl || item.productImageUrl || null,
                }))
              : vendorOrder.items,
          }));

          setSummary({
            ...summaryData,
            items: enrichedItems,
            vendorOrders: enrichedVendorOrders,
          });
          try {
            const profile = await getProfile();
            if (profile?.phoneNumber) {
              setPhoneNumber(profile.phoneNumber);
            }
            if (profile?.fullName) {
              setFullName(profile.fullName);
            } else {
              const user = getCurrentUser();
              if (user?.name) {
                // Check if the name looks like an email and we have a better name
                if (user.name.includes('@') && user.email === user.name) {
                  // Try to extract name from email
                  const namePart = user.email.split('@')[0];
                  setFullName(namePart);
                } else {
                  setFullName(user.name);
                }
              }
            }
          } catch (e) {
            console.warn('Could not fetch profile for user info', e);
            const user = getCurrentUser();
            if (user?.name) setFullName(user.name);
          }
        } else {
          toast.error('Không thể tải thông tin thanh toán');
          navigate('/cart');
        }
      } catch (error: any) {
        console.error('❌ Failed to fetch checkout summary:', error);
        const originalMsg = error.message || '';
        const lowerMsg = originalMsg.toLowerCase();
        
        if (lowerMsg.includes('vượt quá') || lowerMsg.includes('phạm vi') || lowerMsg.includes('giao hàng') || lowerMsg.includes('distance')) {
          toast.message({
            title: 'Không thể giao hàng',
            text: originalMsg || 'Khoảng cách giao hàng vượt quá giới hạn cho phép của các cửa hàng.',
            icon: 'error',
            confirmButtonText: 'Quay lại giỏ hàng'
          });
        } else {
          toast.error(originalMsg || 'Đã xảy ra lỗi');
        }
        
        // Delay navigation slightly more to allow the user to read/see the modal
        setTimeout(() => navigate('/cart'), 1500);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [isCheckingAuth, searchParams, navigate]);

  const handleSelectAddress = async (addressId: string | number) => {
    try {
      setSelectingAddress(true);
      const success = await addressService.setDefaultAddress(addressId);
      if (success) {
        // Refresh summary to get new shipping fee
        const cartItemParam = searchParams.get('cartItemId');
        if (cartItemParam) {
          const cartItemIds = cartItemParam
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !Number.isNaN(id));

          const summaryData = await checkoutService.getSummary(cartItemIds);
          if (summaryData) {
            setSummary(summaryData);
          }
        }
        setShowAddressSelector(false);
        toast.success('Đã cập nhật địa chỉ giao hàng');
      } else {
        toast.error('Không thể thay đổi địa chỉ');
      }
    } catch (error: any) {
      console.error('❌ Failed to select address:', error);
      const originalMsg = error.message || '';
      const lowerMsg = originalMsg.toLowerCase();
      
      if (lowerMsg.includes('phạm vi') || lowerMsg.includes('giao hàng') || lowerMsg.includes('vượt quá') || lowerMsg.includes('distance')) {
        toast.error('Không thể giao hàng');
      } else {
        toast.error('Lỗi khi thay đổi địa chỉ');
      }
    } finally {
      setSelectingAddress(false);
    }
  };

  const handleCheckout = async () => {
    if (!deliveryDate) {
      toast.error('Vui lòng chọn ngày giao hàng');
      return;
    }

    if (!deliveryTimeSlot) {
      toast.error('Vui lòng nhập giờ giao hàng');
      return;
    }

    if (summary?.vendorOrders?.some((order: any) => order.shippingDistanceKm && order.shippingDistanceKm > 60)) {
      toast.error('Khoảng cách giao hàng quá 60km. Vui lòng chọn địa chỉ giao hàng gần hơn hoặc chọn cửa hàng khác.');
      return;
    }

    // Validate 60h and 1 month limit
    const now = new Date();
    const [hours, minutes] = deliveryTimeSlot.split(':').map(Number);
    const selectedDateTime = new Date(deliveryDate);
    selectedDateTime.setHours(hours, minutes, 0, 0);

    const diffInHours = (selectedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    if (diffInHours < 60) {
      toast.error('Thời gian đặt hàng phải cách thời điểm hiện tại ít nhất 60 giờ để chuẩn bị.');
      return;
    }

    if (selectedDateTime > oneMonthFromNow) {
      toast.error('Thời gian đặt hàng không được quá 1 tháng kể từ hiện tại.');
      return;
    }

    if (!summary) {
      toast.error('Không tìm thấy thông tin đơn hàng');
      return;
    }

    console.log(' Form state:', { deliveryDate, deliveryTimeSlot, paymentMethod });
    console.log(' Summary items:', summary.items);

    const checkoutRequest = {
      deliveryDate,
      deliveryTime: deliveryTimeSlot,
      paymentMethod,
      items: summary.items.map(item => ({
        cartItemId: item.cartItemId,
        decorationNote: decorationNotes[item.cartItemId] || ''
      }))
    };

    setProcessing(true);
    try {
      console.log(' Checkout request data:', JSON.stringify(checkoutRequest, null, 2));

      const result = await checkoutService.processCheckout(checkoutRequest);

      console.log(' Checkout result:', result);

      if (result) {
        console.log(' Payment URL:', result.paymentUrl);
        console.log(' Order ID:', result.orderId);

        try {
          const returnUrl = await checkoutService.getPaymentReturnUrl();
          console.log(' Payment return URL:', returnUrl);
        } catch (returnUrlError) {
          console.warn(' Could not fetch payment return URL:', returnUrlError);
        }

        if (result.paymentUrl) {
          // Hiện toast trước khi redirect đến trang thanh toán
          toast.success('Đơn hàng đã được tạo! Đang chuyển đến trang thanh toán...');
          console.log(' Redirecting to payment URL...');

          // Delay nhỏ để user nhìn thấy toast
          await new Promise(resolve => setTimeout(resolve, 1500));

          window.location.href = result.paymentUrl;
        } else {
          console.log(' No payment URL, processing transaction...');

          if (result.orderId) {
            try {
              const transactionResult = await checkoutService.processTransaction(result.orderId.toString());
              console.log(' Transaction result:', transactionResult);
            } catch (transactionError) {
              console.warn(' Transaction processing failed:', transactionError);
            }
          }

          // Toast thành công khi hoàn tất không cần thanh toán
          toast.success('Đặt hàng thành công!');
          navigate(`/tracking?orderId=${result.orderId}`);
        }
      } else {
        toast.error('Không thể xử lý đơn hàng. Vui lòng kiểm tra thông tin giao hàng và thử lại.');
      }
    } catch (error: any) {
      console.error(' Checkout failed:', error);

      if (error.message?.includes('Số dư') && paymentMethod === 'PayOS') {
        toast.info('Số dư ví không đủ. Đang tạo phiên nạp qua PayOS...');
        try {
          sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({
            request: checkoutRequest,
            createdAt: Date.now(),
            returnPath: `${window.location.pathname}${window.location.search}`
          }));

          const payosResult = await checkoutService.initiatePayOSPayment(summary.totalAmount);
          const redirectUrl = payosResult?.paymentUrl || payosResult?.checkoutUrl;

          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }

          sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
        } catch (payosError) {
          sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
          console.error(' PayOS initiation failed:', payosError);
          toast.error('Lỗi khi tạo liên kết PayOS. Vui lòng thử lại sau.');
        }
        setProcessing(false);
        return;
      }

      const originalMsg = error.message || '';
      const lowerMsg = originalMsg.toLowerCase();
      
      if (lowerMsg.includes('phạm vi') || lowerMsg.includes('giao hàng') || lowerMsg.includes('vượt quá') || lowerMsg.includes('distance')) {
        toast.error('Không thể giao hàng');
      } else if (error.message?.includes('500')) {
        toast.error('Lỗi hệ thống. Vui lòng đảm bảo đã cập nhật đầy đủ thông tin tài khoản (Địa chỉ, SĐT) và thử lại sau.');
      } else {
        toast.error(originalMsg || 'Đã xảy ra lỗi khi thanh toán. Vui lòng thử lại.');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (isCheckingAuth || loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-slate-500">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const hasExceededDistance = summary.vendorOrders?.some((order: any) => order.shippingDistanceKm && order.shippingDistanceKm > 60) || false;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-10 py-6 md:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
      <div className="flex-1 space-y-4">
        <section className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40">
          <h2 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-4 border-b border-slate-50 pb-3">
            Giao hàng
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400">Họ và tên</label>
              <input
                type="text"
                defaultValue={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-ritual-bg border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400">Số điện thoại</label>
              <input type="tel" defaultValue={phoneNumber} placeholder="Nhập số điện thoại" className="w-full bg-ritual-bg border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-slate-400">Địa chỉ nhận hàng</label>
                {addresses.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setShowAddressSelector(!showAddressSelector)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">edit_location</span>
                    {showAddressSelector ? 'Đóng' : 'Thay đổi'}
                  </button>
                )}
              </div>
              
              {showAddressSelector ? (
                <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-xs text-slate-500 italic pb-2">Chọn một địa chỉ từ danh sách của bạn:</p>
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {addresses.map((addr) => (
                      <div 
                        key={addr.addressId}
                        onClick={() => !selectingAddress && handleSelectAddress(addr.addressId)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-start group ${
                          summary.deliveryAddress?.includes(addr.addressText) 
                            ? 'border-primary bg-primary/5' 
                            : 'border-gray-100 hover:border-primary/30 hover:bg-ritual-bg'
                        } ${selectingAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors">
                            {addr.addressText}
                          </p>
                          {addr.isDefault && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md">Mặc định</span>
                          )}
                        </div>
                        {summary.deliveryAddress?.includes(addr.addressText) && (
                          <span className="material-symbols-outlined text-primary">check_circle</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button"
                    onClick={() => navigate('/profile?tab=address')}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-gray-300 text-slate-500 text-sm hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Thêm địa chỉ mới
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={summary.deliveryAddress || ''}
                    readOnly
                    placeholder="Chọn địa chỉ từ danh sách..."
                    className="w-full bg-ritual-bg border border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary cursor-default text-gray-700 font-medium"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                    <span className="material-symbols-outlined">location_on</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40">
          <h2 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-4 border-b border-slate-50 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined p-1.5 bg-primary/10 text-primary rounded-lg text-sm">schedule</span>
            Thời gian
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400">Ngày giao hàng</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0]}
                max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className="w-full bg-ritual-bg border border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400">Giờ giao hàng</label>
              <input
                type="time"
                value={deliveryTimeSlot}
                onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                className="w-full bg-ritual-bg border border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          {/* <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-slate-600">
            <div className="flex gap-2 mb-2">
              <span className="font-bold text-primary">Mẹo:</span>
            </div>
            <p>Vui lòng chọn khung giờ hoàng đạo để đảm bảo ý nghĩa tâm linh của buổi lễ. Hãy để chúng tôi tư vấn giờ tốt nhất cho sự kiện của bạn.</p>
          </div> */}
        </section>

        <section className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40">
          <h2 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-4 border-b border-slate-50 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined p-1.5 bg-primary/10 text-primary rounded-lg text-sm">edit_note</span>
            Ghi chú
          </h2>
          <div className="space-y-6">
            {summary.items.map((item) => (
              <div key={item.cartItemId} className="space-y-2">
                <label className="text-sm font-bold text-slate-700">
                  {item.packageName} - {item.variantName}
                </label>
                <textarea
                  value={decorationNotes[item.cartItemId] || ''}
                  onChange={(e) => setDecorationNotes(prev => ({
                    ...prev,
                    [item.cartItemId]: e.target.value
                  }))}
                  placeholder="VD: Thêm hoa tươi, nến, trái cây..."
                  className="w-full bg-ritual-bg border border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary resize-none"
                  rows={3}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-700">
            <p className="font-bold mb-1">Lưu ý:</p>
            <p>Ghi chú của bạn sẽ được chuyển tới người bán để chuẩn bị theo yêu cầu của bạn.</p>
          </div>
        </section>

        <section className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40">
          <h2 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-4 border-b border-slate-50 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined p-1.5 bg-primary/10 text-primary rounded-lg text-sm">payments</span>
            Thanh toán
          </h2>
          <div className="space-y-4">
            {[
              { id: 'PayOS', label: 'Ví của bạn', desc: 'Nếu số dư không đủ thì sẽ nạp tiền bằng cách chuyển khoản, QR - An toàn & Nhanh chóng' },
              
            ].map((m, i) => (
              <label key={m.id} className={`flex items-center p-4 md:p-6 border-2 rounded-2xl md:rounded-3xl cursor-pointer transition-all ${paymentMethod === m.id ? 'border-primary bg-gray-50' : 'border-gray-200 hover:border-primary'}`}>
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                  className="text-primary focus:ring-primary size-5"
                />
                <div className="ml-4">
                  <p className="font-bold text-slate-900">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="w-full lg:w-[400px] shrink-0">
        <div className="sticky top-24 bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/50">
          <h3 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-5 border-b border-slate-50 pb-3">Đơn hàng</h3>
          <div className="space-y-6 mb-8">
            {summary.items.map((item) => (
              <div key={item.cartItemId} className="flex gap-4">
                <div className="size-16 rounded-2xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.packageName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-300 text-xs text-center">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{item.packageName}</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1">
                    SL: {item.quantity.toString().padStart(2, '0')} • {item.variantName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {item.vendorName}
                  </p>
                  <p className="text-sm font-bold text-primary mt-1">
                    {(item.lineTotal || (item.price * item.quantity) || 0).toLocaleString()}đ
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-6 border-t border-gray-200">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tạm tính ({summary.totalItems} sản phẩm)</span>
              <span className="font-bold">{(summary.subTotal || 0).toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Phí vận chuyển</span>
              <span className={`font-bold ${summary.shippingFee === 0 ? 'text-green-600' : ''}`}>
                {!summary.shippingFee || summary.shippingFee === 0 ? 'Miễn phí' : `${summary.shippingFee.toLocaleString()}đ`}
              </span>
            </div>
            {/* {(summary.totalHoldFee || 0) > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>Phí giữ chỗ (5%)</span>
                <span className="font-bold text-amber-700">
                  {(summary.totalHoldFee || 0).toLocaleString()}đ
                </span>
              </div>
            )} */}
            {(summary.totalDiscount || 0) > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>Giảm giá</span>
                <span className="font-bold text-green-600">
                  -{(summary.totalDiscount || 0).toLocaleString()}đ
                </span>
              </div>
            )}
            {summary.deliveryAddress && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-slate-400 mb-1">Địa chỉ giao hàng:</p>
                <p className="text-xs text-slate-600">{summary.deliveryAddress}</p>
              </div>
            )}
            <div className="pt-4 flex justify-between items-end">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Tổng cộng</p>
                <p className="text-[10px] text-slate-300 italic">(Đã bao gồm VAT)</p>
              </div>
              <p className="text-3xl font-black text-primary tracking-tight">
                {(summary.totalAmount || (summary.subTotal || 0) + (summary.shippingFee || 0) - (summary.totalDiscount || 0)).toLocaleString()}đ
              </p>
            </div>
            
            {hasExceededDistance && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
                <p className="text-sm font-semibold text-red-700 leading-relaxed">
                  Khoảng cách giao hàng quá 60km. Vui lòng chọn địa chỉ giao hàng gần hơn hoặc mua ở cửa hàng khác.
                </p>
              </div>
            )}
            
            {(summary.totalHoldFee || 0) > 0 && !hasExceededDistance && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Đơn hàng này có phí giữ chỗ dự kiến khoảng {(summary.totalHoldFee || 0).toLocaleString()}đ (40%). Khoản này chỉ bị trừ nếu bạn chủ động hủy đơn. Hãy đọc kĩ thông tin đơn hàng trước khi thanh toán nhé!
                  </p>
                  {showHoldFeeInfo && (
                    <div className="mt-2 text-[11px] text-amber-900 leading-relaxed border-t border-amber-200 pt-2">
                      <p className="font-semibold mb-1">Chi tiết về phí giữ chỗ:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Phí giữ chỗ được tạm tính khoảng 40% tổng giá trị đơn hàng sau khuyến mãi.</li>
                        <li>Phí giữ chỗ được tính nếu đơn hàng có giá trị từ 2.000.000 trở lên.</li>
                        <li>Khoản phí này dùng để giữ lịch, chuẩn bị mâm cúng và nhân sự phục vụ cho buổi lễ của bạn.</li>
                        <li>Nếu bạn hủy đơn vì bất kỳ lý do gì, khoản phí giữ chỗ này sẽ bị trừ và không được hoàn lại.</li>
                        <li>Nếu đơn được thực hiện bình thường, bạn chỉ thanh toán số tiền hiển thị tại mục "Tổng cộng", không bị trừ thêm phí giữ chỗ.</li>
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowHoldFeeInfo(prev => !prev)}
                  className="ml-2 mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border border-amber-400 text-amber-700 text-[11px] font-bold flex items-center justify-center bg-amber-50 hover:bg-amber-100 hover:border-amber-500 transition-colors"
                  aria-label="Giải thích về phí giữ chỗ"
                >
                  ?
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={processing || !deliveryDate || hasExceededDistance}
            className={`w-full mt-10 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${hasExceededDistance ? 'bg-slate-400 shadow-none' : 'bg-primary shadow-primary/20 hover:-translate-y-1'}`}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Đang xử lý...
              </span>
            ) : 'Thanh toán ngay'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="w-full mt-3 bg-white text-slate-700 py-4 rounded-2xl font-bold border border-gray-200 hover:border-primary hover:text-primary transition-all"
          >
            Quay về giỏ hàng
          </button>
        </div>
      </aside>
    </div>
  );
};

export default CheckoutPage;
