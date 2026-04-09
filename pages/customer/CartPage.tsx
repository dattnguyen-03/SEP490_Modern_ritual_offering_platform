import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cartService, CartApi } from '../../services/cartService';
import { checkoutService, CheckoutSummary } from '../../services/checkoutService';
import { getCurrentUser } from '../../services/auth';
import { walletService } from '../../services/walletService';
import toast from '../../services/toast';

const MAX_CART_ITEM_QUANTITY = 50;

const CartPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartApi | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  // Check authentication
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      console.log(' User not authenticated, redirecting to login');
      navigate('/auth?redirect=/cart');
      return;
    }
    setIsCheckingAuth(false);
  }, [navigate]);

  // Fetch cart from API
  useEffect(() => {
    if (isCheckingAuth) return;

    const fetchCart = async () => {
      try {
        console.log('🛒 Fetching cart...');
        const cartData = await cartService.getCart();
        setCart(cartData);
        console.log('✅ Cart loaded:', cartData);

        // Fetch checkout summary for accurate pricing based on selected items
        if (cartData && cartData.cartItems && cartData.cartItems.length > 0) {
          const allItemIds = cartData.cartItems.map(item => item.cartItemId);
          setSelectedItemIds(allItemIds);

          try {
            console.log('💰 Fetching initial checkout summary...');
            const summary = await checkoutService.getSummary(allItemIds);
            if (summary) {
              setCheckoutSummary(summary);
              console.log('✅ Checkout summary loaded:', summary);
            }
          } catch (summaryError: any) {
            console.warn('⚠️ Failed to fetch checkout summary for cart:', summaryError);
          }
        } else {
          setSelectedItemIds([]);
          setCheckoutSummary(null);
        }

      } catch (error) {
        console.error('❌ Failed to fetch cart:', error);
        toast.error('Không thể tải giỏ hàng');
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, [isCheckingAuth]);

  // Helper function to refresh checkout summary
  const refreshCheckoutSummary = async (ids: number[]) => {
    if (ids.length > 0) {
      try {
        const summary = await checkoutService.getSummary(ids);
        if (summary) {
          setCheckoutSummary(summary);
        }
      } catch (error: any) {
        console.error('❌ Failed to refresh checkout summary:', error);
        const lowerMsg = (error.message || '').toLowerCase();
        if (lowerMsg.includes('vượt quá') || lowerMsg.includes('phạm vi') || lowerMsg.includes('giao hàng') || lowerMsg.includes('distance')) {
          toast.error('Có sản phẩm vượt quá khoảng cách giao hàng');
        }
      }
    } else {
      setCheckoutSummary(null);
    }
  };

  const toggleSelectItem = (cartItemId: number) => {
    const newSelected = selectedItemIds.includes(cartItemId)
      ? selectedItemIds.filter(id => id !== cartItemId)
      : [...selectedItemIds, cartItemId];

    setSelectedItemIds(newSelected);
    refreshCheckoutSummary(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === cartItems.length) {
      setSelectedItemIds([]);
      setCheckoutSummary(null);
    } else {
      const allIds = cartItems.map(i => i.cartItemId);
      setSelectedItemIds(allIds);
      refreshCheckoutSummary(allIds);
    }
  };

  const updateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    if (newQuantity > MAX_CART_ITEM_QUANTITY) {
      toast.info(`Số lượng tối đa cho mỗi sản phẩm là ${MAX_CART_ITEM_QUANTITY}.`);
      return;
    }

    setUpdating(cartItemId);
    try {
      console.log('📝 Updating quantity:', { cartItemId, newQuantity });
      // API endpoint expects 'itemId' parameter even though response has 'cartItemId'
      const success = await cartService.updateCartItem({ cartItemId: cartItemId, quantity: newQuantity });

      if (success) {
        // Re-fetch cart from server to ensure sync
        console.log('🔄 Re-fetching cart after update...');
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);

        // Refresh checkout summary with new prices (keeping current selection)
        await refreshCheckoutSummary(selectedItemIds);

        toast.success('Đã cập nhật số lượng');
        // Trigger cart update event
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể cập nhật số lượng');
      }
    } catch (error) {
      console.error(' Failed to update quantity:', error);
      toast.error('Đã xảy ra lỗi');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (cartItemId: number) => {
    const result = await toast.confirm({
      title: 'Xóa sản phẩm?',
      text: 'Bạn có chắc chắn muốn xóa sản phẩm này khỏi giỏ hàng?',
      icon: 'warning',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    setUpdating(cartItemId);
    try {
      console.log('🗑️ Removing item:', cartItemId);
      const success = await cartService.removeCartItem(cartItemId);

      if (success) {
        // Re-fetch cart from server to ensure sync
        console.log('🔄 Re-fetching cart after delete...');
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);

        // Refresh checkout summary with new prices (keeping current selection)
        const newSelected = selectedItemIds.filter(id => updatedCart?.cartItems?.some(i => i.cartItemId === id));
        setSelectedItemIds(newSelected);
        await refreshCheckoutSummary(newSelected);

        toast.success('Đã xóa sản phẩm');
        // Trigger cart update event
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể xóa sản phẩm');
      }
    } catch (error: any) {
      // If 404, item might already be deleted, re-fetch cart
      if (error.message && error.message.includes('404')) {
        console.log('⚠️ Item not found (404), re-fetching cart...');
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);

        // Refresh checkout summary with new prices (keeping current selection)
        const newSelected = selectedItemIds.filter(id => updatedCart?.cartItems?.some(i => i.cartItemId === id));
        setSelectedItemIds(newSelected);
        await refreshCheckoutSummary(newSelected);

        toast.info('Sản phẩm đã được xóa');
        // Trigger cart update event
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        console.error(' Failed to remove item:', error);
        toast.error('Đã xảy ra lỗi');
      }
    } finally {
      setUpdating(null);
    }
  };

  const clearAllCart = async () => {
    const result = await toast.confirm({
      title: 'Xóa toàn bộ giỏ hàng?',
      text: 'Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?',
      icon: 'warning',
      confirmButtonText: 'Xóa tất cả',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    setUpdating(-1); // Use -1 to indicate clearing all
    try {
      console.log(' Clearing cart...');
      const success = await cartService.clearCart();

      if (success) {
        // Re-fetch cart from server to ensure sync
        console.log('🔄 Re-fetching cart after clear...');
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);

        // Refresh checkout summary
        setSelectedItemIds([]);
        await refreshCheckoutSummary([]);

        toast.success('Đã xóa toàn bộ giỏ hàng');
        // Trigger cart update event
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể xóa giỏ hàng');
      }
    } catch (error) {
      console.error(' Failed to clear cart:', error);
      toast.error('Đã xảy ra lỗi');
    } finally {
      setUpdating(null);
    }
  };

  if (isCheckingAuth || loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-slate-600">Đang tải giỏ hàng...</p>
        </div>
      </div>
    );
  }

  const cartItems = cart?.cartItems || [];

  // Use checkout summary if available, otherwise calculate locally
  const subtotal = checkoutSummary?.subTotal || cart?.subtotal || 0;
  const shipping = checkoutSummary?.shippingFee !== undefined ? checkoutSummary.shippingFee : (subtotal > 0 ? 50000 : 0);
  const discount = checkoutSummary?.totalDiscount || 0;
  const total = checkoutSummary?.totalAmount || (subtotal + shipping - discount);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-10 py-8 md:py-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 md:mb-10 text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 italic font-display tracking-tight">Giỏ Hàng</h1>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-100 sticky top-24 z-20 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-3">
          {cartItems.length > 0 && (
            <div
              className="flex items-center gap-4 cursor-pointer group"
              onClick={toggleSelectAll}
            >
              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedItemIds.length === cartItems.length ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-primary'}`}>
                {selectedItemIds.length === cartItems.length && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-bold text-slate-600">Chọn tất cả ({cartItems.length})</span>
            </div>
          )}
        </div>
        {cartItems.length > 0 && (
          <button
            onClick={clearAllCart}
            disabled={updating !== null}
            className="text-red-500 font-bold text-sm hover:text-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Xóa tất cả
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          {cartItems.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-gold/10 text-center">
              <p className="text-slate-500 text-lg mb-6">Giỏ hàng của bạn trống</p>
              <button
                onClick={() => onNavigate('/shop')}
                className="border-2 border-primary text-primary px-8 py-3 rounded-lg font-bold hover:bg-primary/5 transition-all"
              >
                Tiếp tục mua sắm
              </button>
            </div>
          ) : (
            cartItems.map(item => {
              const isUpdating = updating === item.cartItemId;
              return (
                <div key={item.cartItemId} className={`bg-white p-4 md:p-6 rounded-[2rem] border transition-all duration-300 shadow-xl shadow-slate-200/40 hover:shadow-2xl ${selectedItemIds.includes(item.cartItemId) ? 'border-primary/30 ring-1 ring-primary/10' : 'border-slate-100'}`}>
                  <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-start sm:items-center">
                    {/* Checkbox */}
                    <div
                      className="cursor-pointer group flex-shrink-0"
                      onClick={() => toggleSelectItem(item.cartItemId)}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedItemIds.includes(item.cartItemId) ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-primary'}`}>
                        {selectedItemIds.includes(item.cartItemId) && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center cursor-pointer" onClick={() => onNavigate(`/product/${item.packageId}`)}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.packageName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="text-slate-400 text-xs text-center p-2">No Image</div>';
                          }}
                        />
                      ) : (
                        <div className="text-slate-400 text-xs text-center p-2">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-primary mb-1">{item.packageName}</h3>
                        <p className="text-sm text-slate-500 mb-2">{item.variantName}</p>
                        <p className="text-2xl font-black text-gold">{item.price.toLocaleString()}đ</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1.5">
                          <button
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded bg-white text-primary font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={MAX_CART_ITEM_QUANTITY}
                            value={isUpdating ? '' : item.quantity}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value);
                              if (!isNaN(newValue) && newValue > 0 && newValue <= MAX_CART_ITEM_QUANTITY) {
                                updateQuantity(item.cartItemId, newValue);
                              } else if (!isNaN(newValue) && newValue > MAX_CART_ITEM_QUANTITY) {
                                toast.info(`Số lượng tối đa cho mỗi sản phẩm là ${MAX_CART_ITEM_QUANTITY}.`);
                              }
                            }}
                            disabled={isUpdating}
                            className="w-12 text-center font-bold text-primary bg-transparent border-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder={isUpdating ? '...' : ''}
                          />
                          <button
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            disabled={isUpdating || item.quantity >= MAX_CART_ITEM_QUANTITY}
                            className="w-8 h-8 rounded bg-white text-primary font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onNavigate(`/checkout?cartItemId=${item.cartItemId}`)}
                            disabled={isUpdating}
                            className="text-primary font-bold text-sm hover:text-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Thanh toán
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => removeItem(item.cartItemId)}
                            disabled={isUpdating}
                            className="text-red-500 font-bold text-sm hover:text-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUpdating ? 'Đang xử lý...' : 'Xóa'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Summary */}
        {cartItems.length > 0 && (
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 h-fit sticky top-32">
            <h2 className="text-xl font-bold text-primary mb-6">Tóm tắt đơn hàng</h2>

            <div className="space-y-3 pb-6 border-b border-gold/10">
              <div className="flex justify-between text-slate-600">
                <span>Tạm tính</span>
                <span className="font-semibold">{subtotal.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phí vận chuyển</span>
                <span className="font-semibold">{shipping.toLocaleString()}đ</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Giảm giá</span>
                  <span className="font-semibold text-green-600">-{discount.toLocaleString()}đ</span>
                </div>
              )}
            </div>

            <div className="my-4 pt-4 flex justify-between text-2xl font-black text-primary">
              <span>Tổng cộng:</span>
              <span className="text-gold">{total.toLocaleString()}đ</span>
            </div>

            <button
              onClick={async () => {
                if (selectedItemIds.length === 0) {
                  toast.warning('Vui lòng chọn ít nhất một sản phẩm để thanh toán');
                  return;
                }

                // Check wallet balance early
                try {
                  const wallet = await walletService.getMyWallet('Customer');
                  const balance = wallet.balance || 0;
                  
                  if (balance < total) {
                    const needed = total - balance;
                    const result = await toast.confirm({
                      title: 'Số dư ví không đủ',
                      text: `Số dư ví ( ${balance.toLocaleString()}đ ) không đủ để thanh toán các sản phẩm đã chọn. Bạn cần thêm ${needed.toLocaleString()}đ. Bạn có muốn nạp tiền ngay không?`,
                      icon: 'warning',
                      confirmButtonText: 'Nạp ngay',
                      cancelButtonText: 'Kiểm tra sau'
                    });

                    if (result.isConfirmed) {
                      const payosResult = await checkoutService.initiatePayOSPayment(total);
                      const redirectUrl = payosResult?.paymentUrl || payosResult?.checkoutUrl;
                      if (redirectUrl) {
                        window.location.href = redirectUrl;
                        return;
                      }
                    }
                  }
                } catch (err) {
                  console.warn('Early balance check failed:', err);
                }

                const idsParam = selectedItemIds.join(',');
                onNavigate(`/checkout?cartItemId=${idsParam}`);
              }}
              disabled={updating !== null || selectedItemIds.length === 0}
              className="w-full bg-primary text-white py-4 rounded-lg font-bold text-lg hover:bg-primary/90 transition-all mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Thanh toán
            </button>

            <button
              onClick={() => onNavigate('/shop')}
              className="w-full border-2 border-primary text-primary py-3 rounded-lg font-bold hover:bg-primary/5 transition-all"
            >
              Tiếp tục mua sắm
            </button>

            {/* <div className="mt-6 p-4 bg-gold/10 rounded-lg text-sm text-slate-600 space-y-2">
              <p className="font-bold text-primary">Thông tin đơn hàng</p>
              <p>✓ Giao hàng trong 24 giờ</p>
              <p>✓ Miễn phí đổi trả trong 7 ngày</p>
              <p>✓ Hỗ trợ 24/7</p>
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
