import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { checkoutService, CheckoutSummary } from '../../services/checkoutService';
import { cartService } from '../../services/cartService';
import { getCurrentUser, getProfile } from '../../services/auth';
import { addressService, CustomerAddress } from '../../services/addressService';
import { walletService } from '../../services/walletService';
import { shippingService, ShippingConfig } from '../../services/shippingService';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';

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
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerHour, setTimePickerHour] = useState('09');
  const [timePickerMinute, setTimePickerMinute] = useState('00');
  const [timePickerPeriod, setTimePickerPeriod] = useState<'AM' | 'PM'>('AM');
  const [paymentMethod, setPaymentMethod] = useState('PayOS');
  const [decorationNotes, setDecorationNotes] = useState<{ [key: number]: string }>({});
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [selectingAddress, setSelectingAddress] = useState(false);
  const [showHoldFeeInfo, setShowHoldFeeInfo] = useState(false);
  const [shippingConfigs, setShippingConfigs] = useState<Map<string, ShippingConfig>>(new Map());

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;

    return new Date(year, month - 1, day);
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const minutesToTimeString = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:00`;
  };

  const getClockTimeLabel = (time: string) => {
    if (!time) return '-- Chọn giờ giao hàng --';

    const [hoursPart, minutesPart] = time.split(':');
    const hours = Number(hoursPart);
    const minutes = minutesPart || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;

    return `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`;
  };

  const allowedTimeRange = () => {
    let earliestTime = '07:00:00';
    let latestTime = '19:00:00';

    for (const config of shippingConfigs.values()) {
      if (config.earliestDeliveryTime) {
        earliestTime = config.earliestDeliveryTime > earliestTime ? config.earliestDeliveryTime : earliestTime;
      }
      if (config.latestDeliveryTime) {
        latestTime = config.latestDeliveryTime < latestTime ? config.latestDeliveryTime : latestTime;
      }
    }

    return {
      earliestMinutes: timeToMinutes(earliestTime),
      latestMinutes: timeToMinutes(latestTime),
    };
  };

  const isTimeAllowed = (timeValue: string) => {
    const minutes = timeToMinutes(timeValue);
    const { earliestMinutes, latestMinutes } = allowedTimeRange();
    return minutes >= earliestMinutes && minutes <= latestMinutes;
  };

  const initializeTimePicker = () => {
    if (deliveryTimeSlot) {
      const [hoursPart, minutesPart] = deliveryTimeSlot.split(':');
      const hours = Number(hoursPart);
      const displayHours = hours % 12 === 0 ? 12 : hours % 12;
      setTimePickerHour(String(displayHours).padStart(2, '0'));
      setTimePickerMinute((minutesPart || '00').padStart(2, '0'));
      setTimePickerPeriod(hours >= 12 ? 'PM' : 'AM');
      return;
    }

    const { earliestMinutes } = allowedTimeRange();
    const fallbackMinutes = Math.max(earliestMinutes, 9 * 60);
    const fallbackTime = minutesToTimeString(fallbackMinutes);
    const [hoursPart, minutesPart] = fallbackTime.split(':');
    const hours = Number(hoursPart);
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    setTimePickerHour(String(displayHours).padStart(2, '0'));
    setTimePickerMinute((minutesPart || '00').padStart(2, '0'));
    setTimePickerPeriod(hours >= 12 ? 'PM' : 'AM');
  };

  const openTimePicker = () => {
    initializeTimePicker();
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const hourNumber = Number(timePickerHour);
    const minuteNumber = Number(timePickerMinute);
    const normalizedHour = timePickerPeriod === 'PM'
      ? (hourNumber === 12 ? 12 : hourNumber + 12)
      : (hourNumber === 12 ? 0 : hourNumber);

    const selectedTime = `${String(normalizedHour).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}:00`;

    if (!isTimeAllowed(selectedTime)) {
      toast.error('Giờ này nằm ngoài khung giao hàng của vendor');
      return;
    }

    setDeliveryTimeSlot(selectedTime);
    setShowTimePicker(false);
  };

  // Calculate min and max dates based on vendor shipping configs
  const getMinMaxDates = () => {
    const now = new Date();
    
    // Get max preparation hours and max advance booking days from all vendors
    let maxMinPreparationHours = 0;
    let minMaxAdvanceBookingDays = 30; // default to 30 days
    
    for (const config of shippingConfigs.values()) {
      if (config.minPreparationHours && config.minPreparationHours > maxMinPreparationHours) {
        maxMinPreparationHours = config.minPreparationHours;
      }
      if (config.maxAdvanceBookingDays && config.maxAdvanceBookingDays > 0) {
        minMaxAdvanceBookingDays = Math.min(minMaxAdvanceBookingDays, config.maxAdvanceBookingDays);
      }
    }

    // Allow selecting today; preparation rules are enforced on submit time
    const minDate = new Date(now);
    minDate.setHours(0, 0, 0, 0);
    
    // Max date is now + minMaxAdvanceBookingDays
    const maxDate = new Date(now.getTime() + minMaxAdvanceBookingDays * 24 * 60 * 60 * 1000);

    return {
      minDate: formatLocalDate(minDate),
      maxDate: formatLocalDate(maxDate),
      maxMinPreparationHours,
      minMaxAdvanceBookingDays
    };
  };

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

          const enrichedVendors = ((summaryData as any).vendors || (summaryData as any).vendorOrders || []).map((vendorOrder: any) => ({
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
            vendors: enrichedVendors,
          });

          // Fetch shipping configs for all vendors
          const vendorsToFetch = enrichedVendors.map((v: any) => v.vendorId);
          const configMap = new Map<string, ShippingConfig>();
          
          for (const vendorId of vendorsToFetch) {
            if (vendorId) {
              const config = await shippingService.getVendorShippingConfig(vendorId);
              if (config) {
                configMap.set(vendorId, config);
              }
            }
          }
          
          setShippingConfigs(configMap);

          try {
            const profile = await getProfile();
            if (profile?.phoneNumber) {
                sessionStorage.removeItem(TOPUP_SUCCESS_TOAST_KEY);
              setPhoneNumber(profile.phoneNumber);
            }
            if (profile?.fullName) {
              setFullName(profile.fullName);
            } else {
              const user = getCurrentUser();
              if (user?.name) {
                // Check if the name looks like an email and we have a better name
                if (user.name.includes('@') && user.email === user.name) {
                sessionStorage.removeItem(TOPUP_CANCEL_TOAST_KEY);
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

    if (summary?.vendors?.some((order: any) => order.shippingDistanceKm && order.shippingDistanceKm > 60)) {
      toast.error('Khoảng cách giao hàng quá 60km. Vui lòng chọn địa chỉ giao hàng gần hơn hoặc chọn cửa hàng khác.');
      return;
    }

    // Validate min preparation hours and max advance booking days
    const now = new Date();
    const [hours, minutes] = deliveryTimeSlot.split(':').map(Number);
    const selectedDateTime = parseLocalDate(deliveryDate);
    if (!selectedDateTime) {
      toast.error('Ngày giao hàng không hợp lệ');
      return;
    }
    selectedDateTime.setHours(hours, minutes, 0, 0);

    const diffInHours = (selectedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (!isTimeAllowed(deliveryTimeSlot)) {
      toast.error('Vui lòng chọn giờ giao hàng hợp lệ');
      return;
    }
    
    // Get min preparation hours from configs
    let maxMinPreparationHours = 0;
    let minMaxAdvanceBookingDays = 30;
    
    for (const config of shippingConfigs.values()) {
      if (config.minPreparationHours && config.minPreparationHours > maxMinPreparationHours) {
        maxMinPreparationHours = config.minPreparationHours;
      }
      if (config.maxAdvanceBookingDays && config.maxAdvanceBookingDays > 0) {
        minMaxAdvanceBookingDays = Math.min(minMaxAdvanceBookingDays, config.maxAdvanceBookingDays);
      }
    }

    if (diffInHours < maxMinPreparationHours) {
      toast.error(`Thời gian đặt hàng phải cách thời điểm hiện tại ít nhất ${maxMinPreparationHours} giờ để chuẩn bị.`);
      return;
    }

    const maxDate = new Date(now.getTime() + minMaxAdvanceBookingDays * 24 * 60 * 60 * 1000);
    if (selectedDateTime > maxDate) {
      toast.error(`Thời gian đặt hàng không được quá ${minMaxAdvanceBookingDays} ngày kể từ hiện tại.`);
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
      // 1. Proactively check wallet balance if paying with Wallet (PayOS method in UI)
      if (paymentMethod === 'PayOS') {
        try {
          const wallet = await walletService.getMyWallet('Customer');
          const balance = wallet.balance || 0;

          if (balance < summary.totalAmount) {
            const needed = summary.totalAmount - balance;

            const result = await toast.confirm({
              title: 'Số dư không đủ',
              text: `Số dư ví của bạn ( ${balance.toLocaleString()}đ ) không đủ để thanh toán đơn hàng này. Bạn cần nạp thêm ít nhất ${needed.toLocaleString()}đ. Bạn có muốn nạp tiền ngay không?`,
              icon: 'warning',
              confirmButtonText: 'Nạp tiền ngay',
              cancelButtonText: 'Để sau'
            });

            if (result.isConfirmed) {
              // Initiate top-up link for the total order amount
              const payosResult = await checkoutService.initiatePayOSPayment(summary.totalAmount);
              const redirectUrl = payosResult?.paymentUrl || payosResult?.checkoutUrl;

              if (redirectUrl) {
                // Store checkout request to resume later if needed
                sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({
                  request: checkoutRequest,
                  createdAt: Date.now(),
                  returnPath: `${window.location.pathname}${window.location.search}`
                }));

                window.location.href = redirectUrl;
                return;
              } else {
                toast.error('Không thể tạo liên kết nạp tiền. Vui lòng thử lại sau.');
              }
            }

            setProcessing(false);
            return;
          }
        } catch (walletError: any) {
          console.error('⚠️ Failed to check wallet balance:', walletError);
          // Continue with checkout anyway, the backend will catch it if balance is truly low
        }
      }

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
    return <LoadingScreen message="Đang tải thông tin..." subMessage="Chuẩn bị thanh toán an toàn" />;
  }

  if (!summary) {
    return null;
  }

  const hasExceededDistance = summary.vendors?.some((order: any) => order.shippingDistanceKm && order.shippingDistanceKm > 60) || false;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-10 py-6 md:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
      <div className="flex-1 space-y-4">
        <section className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40">
          <h2 className="text-lg md:text-xl font-sans not-italic font-bold text-slate-800 mb-4 border-b border-slate-50 pb-3">
            Giao hàng
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-black">Họ và tên</label>
              <input
                type="text"
                defaultValue={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-ritual-bg border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-black">Số điện thoại</label>
              <input type="tel" defaultValue={phoneNumber} placeholder="Nhập số điện thoại" className="w-full bg-ritual-bg border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase text-black">Địa chỉ nhận hàng</label>
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
                  <p className="text-xs text-black italic pb-2">Chọn một địa chỉ từ danh sách của bạn:</p>
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {addresses.map((addr) => (
                      <div
                        key={addr.addressId}
                        onClick={() => !selectingAddress && handleSelectAddress(addr.addressId)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-start group ${summary.deliveryAddress?.includes(addr.addressText)
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
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-gray-300 text-black text-sm hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2"
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
                <label className="text-xs font-bold uppercase text-black">Ngày giao hàng</label>
              <input
                  type="date"
                  lang="vi-VN"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={getMinMaxDates().minDate}
                  max={getMinMaxDates().maxDate}
                  className="w-full bg-ritual-bg border border-gold/10 rounded-2xl p-4 focus:ring-primary focus:border-primary"
                />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-black">Giờ giao hàng</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={openTimePicker}
                  className="w-full bg-gradient-to-r from-white to-ritual-bg border border-gold/10 rounded-2xl px-4 py-4 focus:ring-primary focus:border-primary flex items-center justify-between gap-3 text-left transition-all hover:border-primary/40 shadow-sm"
                >
                  <span className={`font-semibold tracking-wide ${deliveryTimeSlot ? 'text-slate-900' : 'text-slate-400'}`}>
                    {getClockTimeLabel(deliveryTimeSlot)}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:block">Chọn giờ</span>
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                </button>

                {showTimePicker && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-4">
                    <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/20 border border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
                        <div className="bg-teal-500 text-white p-6 md:p-8 flex flex-col justify-between min-h-[280px]">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.35em] text-white/80 font-bold">Giờ giao hàng</p>
                            <h3 className="mt-3 text-5xl font-light leading-none tracking-tight">
                              {String(timePickerHour).padStart(2, '0')}:{timePickerMinute}
                            </h3>
                            <p className="mt-3 text-white/85 text-sm font-medium">{timePickerPeriod}</p>
                          </div>
                          <p className="text-xs text-white/75 leading-relaxed">
                            Chọn giờ theo từng ô để chỉnh nhanh như form đồng hồ.
                          </p>
                        </div>

                        <div className="p-5 md:p-6">
                          <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.28em] text-black">Chọn thời gian</p>
                              <p className="text-sm text-slate-500 mt-1">Chọn giờ, phút và sáng / chiều</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowTimePicker(false)}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              aria-label="Đóng"
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Giờ</p>
                              <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 p-2 custom-scrollbar bg-slate-50">
                                {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                                  <button
                                    key={hour}
                                    type="button"
                                    onClick={() => setTimePickerHour(hour)}
                                    className={`mb-1 w-full rounded-xl px-3 py-2 text-sm font-bold transition-all ${timePickerHour === hour
                                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                      : 'text-slate-700 hover:bg-white hover:text-primary'
                                      }`}
                                  >
                                    {hour}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Phút</p>
                              <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 p-2 custom-scrollbar bg-slate-50">
                                {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map((minute) => (
                                  <button
                                    key={minute}
                                    type="button"
                                    onClick={() => setTimePickerMinute(minute)}
                                    className={`mb-1 w-full rounded-xl px-3 py-2 text-sm font-bold transition-all ${timePickerMinute === minute
                                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                      : 'text-slate-700 hover:bg-white hover:text-primary'
                                      }`}
                                  >
                                    {minute}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Buổi</p>
                              <div className="grid gap-2">
                                {(['AM', 'PM'] as const).map((period) => (
                                  <button
                                    key={period}
                                    type="button"
                                    onClick={() => setTimePickerPeriod(period)}
                                    className={`rounded-2xl px-4 py-6 text-sm font-black tracking-[0.2em] transition-all border ${timePickerPeriod === period
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                                      }`}
                                  >
                                    {period}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 flex items-center justify-between gap-3">
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Thời gian sẽ được kiểm tra lại theo chuẩn bị của vendor khi bạn xác nhận thanh toán.
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowTimePicker(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={confirmTimePicker}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:translate-y-[-1px]"
                              >
                                Xác nhận
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-black">
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
                  <p className="text-xs text-black">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="w-full lg:w-[420px] shrink-0">
        <div className="sticky top-24 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-200/40">
          <h3 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-50 pb-4">Tóm tắt đơn hàng</h3>

          {/* Items List */}
          <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {summary.items.map((item) => (
              <div key={item.cartItemId} className="flex gap-4 group">
                <div className="size-20 rounded-2xl bg-slate-50 shrink-0 overflow-hidden border border-slate-100 group-hover:border-primary/20 transition-colors">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.packageName}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px] uppercase font-bold">No Image</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">{item.packageName}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-black uppercase tracking-wider">{item.variantName}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                      <span className="text-[10px] font-bold text-black">SL: {item.quantity}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-800">{(item.unitPrice || 0).toLocaleString()}đ</span>
                  </div>

                  {/* Swaps & Add-ons */}
                  {(item.swaps?.length > 0 || item.addOns?.length > 0) && (
                    <div className="mt-2 space-y-1.5 py-1.5 border-y border-dashed border-slate-100">
                      {item.swaps?.map((swap, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[9px] text-amber-600 font-bold">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                            <span className="truncate">
                              {swap.replacementDescription || (swap.originalItemName ? `${swap.originalItemName} → ${swap.replacementItemName}` : swap.itemName || 'Thay thế')}
                            </span>
                          </div>
                          <span className="ml-2 whitespace-nowrap">
                            +{((swap.surcharge || 0) * item.quantity).toLocaleString()}đ
                          </span>
                        </div>
                      ))}
                      {item.addOns?.map((addOn, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[9px] text-emerald-600 font-bold">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            <span className="truncate">{addOn.itemName} <span className="text-black">x{addOn.quantity}</span></span>
                          </div>
                          <span className="ml-2 whitespace-nowrap">
                            +{(addOn.lineTotal || (addOn.retailPrice * addOn.quantity)).toLocaleString()}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end justify-between mt-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-900 uppercase mt-1 tracking-tighter">Tổng mục này:</span>
                    </div>
                    <span className="text-base font-black text-slate-900 leading-none">{(item.lineTotal || 0).toLocaleString()}đ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-black font-medium">Tạm tính ({summary.totalItems} món)</span>
              <span className="text-slate-900 font-bold">{(summary.subTotal || 0).toLocaleString()}đ</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-black font-medium">Phí giao hàng</span>
              <span className={`font-bold ${summary.shippingFee === 0 ? 'text-emerald-500' : 'text-slate-900'}`}>
                {summary.shippingFee === 0 ? 'Miễn phí' : `+${summary.shippingFee.toLocaleString()}đ`}
              </span>
            </div>

            {summary.totalDiscount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-black font-medium">Khuyến mãi</span>
                <span className="text-emerald-500 font-bold">-{(summary.totalDiscount || 0).toLocaleString()}đ</span>
              </div>
            )}

            {summary.deliveryAddress && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-black">location_on</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-widest">Giao tới</span>
                </div>
                <p className="text-[11px] text-black line-clamp-2 leading-relaxed">{summary.deliveryAddress}</p>
              </div>
            )}

            <div className="pt-6 mt-2">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-black uppercase tracking-widest">Tổng thanh toán</span>
                <div className="text-right">
                  <p className="text-3xl font-black text-primary tracking-tighter leading-none">
                    {(summary.totalAmount || 0).toLocaleString()}đ
                  </p>
                  <p className="text-[9px] text-black font-medium italic mt-1">(Đã bao gồm phí dịch vụ & VAT)</p>
                </div>
              </div>
            </div>

            {hasExceededDistance && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
                <p className="text-[10px] font-bold text-red-600 leading-tight">
                  Vượt quá phạm vi giao hàng 60km. Vui lòng kiểm tra lại địa chỉ.
                </p>
              </div>
            )}

            {(summary.totalHoldFee || 0) > 0 && !hasExceededDistance && (
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Phí giữ chỗ (Dự kiến)</span>
                  <span className="text-xs font-bold text-amber-700">{(summary.totalHoldFee || 0).toLocaleString()}đ</span>
                </div>
                <p className="text-[9px] text-amber-600/70 leading-relaxed">
                  Khoản phí này dùng để giữ lịch và chỉ bị trừ nếu bạn chủ động hủy đơn.
                </p>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <button
                onClick={handleCheckout}
                disabled={processing || !deliveryDate || hasExceededDistance}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${hasExceededDistance
                  ? 'bg-slate-300 text-black shadow-none'
                  : (processing || !deliveryDate
                    ? 'bg-slate-500 text-white cursor-not-allowed shadow-none'
                    : 'bg-primary text-white shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5')
                  }`}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Đang xử lý
                  </span>
                ) : 'Xác nhận thanh toán'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="w-full py-3.5 rounded-xl font-bold text-black text-xs hover:bg-slate-50 hover:text-slate-700 transition-all border border-transparent hover:border-slate-200"
              >
                Quay về giỏ hàng
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default CheckoutPage;
