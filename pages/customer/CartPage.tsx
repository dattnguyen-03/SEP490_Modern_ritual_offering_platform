import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cartService, CartApi, CartItemApi } from '../../services/cartService';
import { checkoutService, CheckoutSummary } from '../../services/checkoutService';
import { packageService } from '../../services/packageService';
import { getCurrentUser } from '../../services/auth';
import { walletService } from '../../services/walletService';
import { ApiPackage } from '../../types';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';

const MAX_CART_ITEM_QUANTITY = 50;

const CartPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartApi | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  // Edit State
  const [editingItem, setEditingItem] = useState<CartItemApi | null>(null);
  const [fullPackageData, setFullPackageData] = useState<ApiPackage | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedSwapIds, setSelectedSwapIds] = useState<number[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ addOnId: number, quantity: number }[]>([]);


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

    // Capture state for potential rollback
    let originalCart: CartApi | null = null;

    setCart(prev => {
      if (!prev) return prev;
      originalCart = JSON.parse(JSON.stringify(prev));

      const updatedVendors = prev.vendors.map(v => ({
        ...v,
        items: v.items.map(i => Number(i.cartItemId) === Number(cartItemId) ? { ...i, quantity: newQuantity } : i)
      }));
      const updatedItems = prev.cartItems.map(i => Number(i.cartItemId) === Number(cartItemId) ? { ...i, quantity: newQuantity } : i);

      return { ...prev, vendors: updatedVendors, cartItems: updatedItems };
    });

    try {
      console.log(`🚀 Sending qty update: item ${cartItemId} → ${newQuantity}`);

      // Only send quantity - server returns 500 if swaps/addOns are included
      const success = await cartService.updateCartItem({
        cartItemId: Number(cartItemId),
        quantity: newQuantity,
      });

      if (success) {
        const refreshedCart = await cartService.getCart();
        setCart(refreshedCart);
        if (refreshedCart) {
          const newSelected = selectedItemIds.filter(id => refreshedCart.cartItems.some(i => i.cartItemId === id));
          await refreshCheckoutSummary(newSelected);
        }
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        if (originalCart) setCart(originalCart);
        toast.error('Cập nhật thất bại');
      }
    } catch (error) {
      console.error('❌ Error updating quantity:', error);
      if (originalCart) setCart(originalCart);
      toast.error('Lỗi kết nối server');
    } finally {
      setUpdating(null);
    }
  };

  const updateAddOnQuantity = async (cartItemId: number, addOnId: number, newAddOnQty: number) => {
    let originalCart: CartApi | null = null;
    const isRemoving = newAddOnQty <= 0;

    setCart(prev => {
      if (!prev) return prev;
      originalCart = JSON.parse(JSON.stringify(prev));

      const updatedVendors = prev.vendors.map(v => ({
        ...v,
        items: v.items.map(i => {
          if (Number(i.cartItemId) !== Number(cartItemId)) return i;
          const updatedAddOns = isRemoving
            ? i.addOns.filter(a => Number(a.addOnId) !== Number(addOnId))
            : i.addOns.map(a => Number(a.addOnId) === Number(addOnId) ? { ...a, quantity: newAddOnQty } : a);
          return { ...i, addOns: updatedAddOns };
        })
      }));
      const updatedItems = prev.cartItems.map(i => {
        if (Number(i.cartItemId) !== Number(cartItemId)) return i;
        const updatedAddOns = isRemoving
          ? i.addOns.filter(a => Number(a.addOnId) !== Number(addOnId))
          : i.addOns.map(a => Number(a.addOnId) === Number(addOnId) ? { ...a, quantity: newAddOnQty } : a);
        return { ...i, addOns: updatedAddOns };
      });

      return { ...prev, vendors: updatedVendors, cartItems: updatedItems };
    });

    setUpdating(cartItemId);
    try {
      // Again, get latest state for the request
      const targetItem = cart?.cartItems.find(i => Number(i.cartItemId) === Number(cartItemId));
      if (!targetItem) throw new Error("Item not found");

      let apiAddOns: { cartItemAddOnId?: number; addOnId: number; quantity: number }[] = targetItem.addOns.map(a => ({
        cartItemAddOnId: a.cartItemAddOnId,
        addOnId: a.addOnId,
        quantity: a.quantity
      }));
      if (isRemoving) {
        apiAddOns = apiAddOns.filter(a => Number(a.addOnId) !== Number(addOnId));
      } else {
        const exists = apiAddOns.find(a => Number(a.addOnId) === Number(addOnId));
        if (exists) {
          apiAddOns = apiAddOns.map(a => Number(a.addOnId) === Number(addOnId) ? { ...a, quantity: newAddOnQty } : a);
        } else {
          apiAddOns.push({ addOnId, quantity: newAddOnQty });
        }
      }

      const success = await cartService.updateCartItem({
        cartItemId: Number(cartItemId),
        quantity: targetItem.quantity,
        swaps: targetItem.swaps.map(s => ({ swapId: s.swapId })),
        addOns: apiAddOns
      });

      if (success) {
        const refreshedCart = await cartService.getCart();
        setCart(refreshedCart);
        await refreshCheckoutSummary(selectedItemIds);
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        if (originalCart) setCart(originalCart);
      }
    } catch (error) {
      if (originalCart) setCart(originalCart);
      toast.error('Lỗi cập nhật món kèm');
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

  const handleOpenEdit = async (item: CartItemApi) => {
    setEditingItem(item);
    setEditLoading(true);
    try {
      const pkg = await packageService.getPackageById(item.packageId);
      if (pkg) {
        setFullPackageData(pkg);
        setSelectedVariantId(item.variantId);
        setSelectedSwapIds(item.swaps.map(s => s.swapId));
        setSelectedAddOns(item.addOns.map(a => ({ addOnId: a.addOnId, quantity: a.quantity })));
      } else {
        toast.error('Không thể tải thông tin gói lễ');
        setEditingItem(null);
      }
    } catch (error) {
      toast.error('Lỗi khi tải thông tin');
      setEditingItem(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdateItemOptions = async () => {
    if (!editingItem) return;

    setUpdating(editingItem.cartItemId);
    const closeEditing = () => {
      setEditingItem(null);
      setFullPackageData(null);
    };

    try {
      const success = await cartService.updateCartItem({
        cartItemId: editingItem.cartItemId,
        quantity: editingItem.quantity,
        swaps: selectedSwapIds.map(id => {
          const existing = editingItem.swaps.find(s => s.swapId === id);
          return {
            cartItemSwapId: existing?.cartItemSwapId,
            swapId: id
          };
        }),
        addOns: selectedAddOns.map(a => {
          const existing = editingItem.addOns.find(ea => ea.addOnId === a.addOnId);
          return {
            cartItemAddOnId: existing?.cartItemAddOnId,
            addOnId: a.addOnId,
            quantity: a.quantity
          };
        })
      });

      if (success) {
        toast.success('Đã cập nhật tùy chọn');
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);
        await refreshCheckoutSummary(selectedItemIds);
        closeEditing();
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể cập nhật tùy chọn');
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi cập nhật');
    } finally {
      setUpdating(null);
    }
  };

  if (isCheckingAuth || loading) {
    return <LoadingScreen message="Đang tải giỏ hàng..." subMessage="Chuẩn bị đồ cúng cho bạn" />;
  }

  const cartItems = cart?.cartItems || [];

  // Use checkout summary if available, otherwise calculate locally
  const subtotal = checkoutSummary?.subTotal || cart?.subtotal || 0;
  const shipping = checkoutSummary?.shippingFee !== undefined ? checkoutSummary.shippingFee : (subtotal > 0 ? 50000 : 0);
  const discount = checkoutSummary?.totalDiscount || 0;
  const total = checkoutSummary?.totalAmount || (subtotal + shipping - discount);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-10 py-8 md:py-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 text-center sm:text-left">
        <h1 className="text-2xl font-bold text-slate-800 italic">Giỏ Hàng</h1>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-100 sticky top-24 z-20 shadow-sm">
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
              <span className="text-xs font-bold text-black">Chọn tất cả ({cartItems.length})</span>
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
        <div className="lg:col-span-2 space-y-8">
          {(() => {
            if (!loading && cart) {
              console.log('🛒 Rendering Cart Content:', {
                vendorsCount: cart.vendors?.length,
                itemsCount: cartItems.length,
                totalItems: cart.totalItems
              });
            }
            return null;
          })()}

          {(cartItems.length === 0) ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center">
              <p className="text-black mb-6 font-medium">Giỏ hàng của bạn hiện đang trống</p>
              <button
                onClick={() => onNavigate('/shop')}
                className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all hover:-translate-y-1"
              >
                Tiếp tục mua sắm
              </button>
            </div>
          ) : (
            cart.vendors.map(vendor => (
              <div key={vendor.vendorId} className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <span className="material-symbols-outlined text-black text-lg">storefront</span>
                  <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{vendor.vendorName}</h2>
                </div>

                <div className="space-y-3">
                  {vendor.items.map(item => {
                    const isUpdating = updating === item.cartItemId;
                    return (
                      <div key={item.cartItemId} className={`bg-white p-4 rounded-xl border transition-all ${selectedItemIds.includes(item.cartItemId) ? 'border-primary/20 bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                        <div className="flex gap-4">
                          {/* Checkbox */}
                          <div
                            className="cursor-pointer mt-1"
                            onClick={() => toggleSelectItem(item.cartItemId)}
                          >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedItemIds.includes(item.cartItemId) ? 'bg-primary border-primary' : 'bg-white border-slate-300'}`}>
                              {selectedItemIds.includes(item.cartItemId) && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Image */}
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 cursor-pointer" onClick={() => onNavigate(`/product/${item.packageId}`)}>
                            <img
                              src={item.imageUrl || ''}
                              alt={item.packageName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<div class="h-full flex items-center justify-center text-[8px] text-slate-300 uppercase font-bold">No Image</div>';
                              }}
                            />
                          </div>

                          {/* Info area */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <h3 className="text-sm font-bold text-slate-800 line-clamp-2">{item.packageName}</h3>
                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-black text-[9px] font-bold uppercase rounded mt-1">
                                  {item.variantName}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 shrink-0">{item.price.toLocaleString()}đ</p>
                            </div>

                            {/* Nested Details */}
                            {(item.swaps.length > 0 || item.addOns.length > 0) && (
                              <div className="mt-2 space-y-1 px-2 border-l-2 border-slate-100 ml-1">
                                {item.swaps.map(swap => (
                                  <div key={swap.cartItemSwapId} className="flex items-center gap-2 text-[10px]">
                                    <span className="material-symbols-outlined text-[12px] text-primary">check_circle</span>
                                    <span className="text-black font-medium">
                                      {swap.replacementDescription || swap.replacementItemName || 'Thay thế'}
                                    </span>
                                    <span className="ml-auto font-bold text-black">+{swap.surcharge > 0 ? (swap.surcharge * item.quantity).toLocaleString() : '0'}đ</span>
                                  </div>
                                ))}
                                {item.addOns.map(addOn => (
                                  <div key={addOn.cartItemAddOnId} className="flex items-center gap-2 text-[10px]">
                                    <span className="material-symbols-outlined text-[12px] text-primary">check_circle</span>
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                      <span className="text-black font-medium truncate">{addOn.addOnName || addOn.itemName}</span>
                                      <div className="flex items-center gap-1.5 px-1 bg-slate-50/80 rounded border border-slate-100 flex-shrink-0">
                                        <button
                                          onClick={() => updateAddOnQuantity(item.cartItemId, addOn.addOnId, addOn.quantity - 1)}
                                          disabled={isUpdating}
                                          className="text-[12px] text-black hover:text-red-500 transition-colors px-0.5"
                                        >−</button>
                                        <span className="text-[9px] text-black font-bold min-w-[12px] text-center">x{addOn.quantity}</span>
                                        <button
                                          onClick={() => updateAddOnQuantity(item.cartItemId, addOn.addOnId, addOn.quantity + 1)}
                                          disabled={isUpdating}
                                          className="text-[12px] text-black hover:text-primary transition-colors px-0.5"
                                        >+</button>
                                      </div>
                                    </div>
                                    <span className="font-bold text-black shrink-0">+{addOn.lineTotal.toLocaleString()}đ</span>
                                  </div>
                                ))}
                                <div className="flex justify-end pt-1 mt-1 border-t border-slate-50">
                                  <span className="text-[9px] font-bold text-black uppercase tracking-wider italic">Tạm tính mục này: {item.lineTotal.toLocaleString()}đ</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center border border-slate-100 rounded bg-white">
                                <button
                                  onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                                  disabled={isUpdating}
                                  className="w-6 h-6 flex items-center justify-center text-black hover:text-primary transition-colors disabled:opacity-30"
                                >
                                  −
                                </button>
                                <span className="w-8 text-center text-[11px] font-bold text-slate-700">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                                  disabled={isUpdating || item.quantity >= MAX_CART_ITEM_QUANTITY}
                                  className="w-6 h-6 flex items-center justify-center text-black hover:text-primary transition-colors disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  disabled={isUpdating}
                                  className="w-8 h-8 flex items-center justify-center text-black hover:text-primary transition-colors"
                                  title="Chỉnh sửa lựa chọn"
                                >
                                </button>
                                <button
                                  onClick={() => removeItem(item.cartItemId)}
                                  disabled={isUpdating}
                                  className="w-8 h-8 flex items-center justify-center text-black hover:text-red-500 transition-colors"
                                  title="Xóa món"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary */}
        {cartItems.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/30 h-fit sticky top-32">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Tóm tắt đơn hàng</h2>

            <div className="space-y-3 pb-6 border-b border-gold/10">
              <div className="flex justify-between text-black">
                <span>Tạm tính</span>
                <span className="font-semibold">{subtotal.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-black">
                <span>Phí vận chuyển</span>
                <span className="font-semibold">{shipping.toLocaleString()}đ</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-black">
                  <span>Giảm giá</span>
                  <span className="font-semibold text-green-600">-{discount.toLocaleString()}đ</span>
                </div>
              )}
            </div>

            <div className="my-4 pt-4 flex justify-between text-xl font-bold text-slate-900">
              <span>Tổng cộng:</span>
              <span className="text-primary">{total.toLocaleString()}đ</span>
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
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Thanh toán
            </button>

            <button
              onClick={() => onNavigate('/shop')}
              className="w-full border border-slate-200 text-black py-2 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all"
            >
              Tiếp tục mua sắm
            </button>

            {/* <div className="mt-6 p-4 bg-gold/10 rounded-lg text-sm text-black space-y-2">
              <p className="font-bold text-primary">Thông tin đơn hàng</p>
              <p>✓ Giao hàng trong 24 giờ</p>
              <p>✓ Miễn phí đổi trả trong 7 ngày</p>
              <p>✓ Hỗ trợ 24/7</p>
            </div> */}
          </div>
        )}
      </div>

      {/* Edit Options Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 md:px-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !editLoading && setEditingItem(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 bg-ritual-bg border-b border-gold/10 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Cập nhật lựa chọn</h3>
                <p className="text-xs text-black mt-1 uppercase tracking-wider">{editingItem.packageName}</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="size-8 rounded-full bg-white flex items-center justify-center text-black hover:text-red-500 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {editLoading ? (
              <div className="p-16 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-black text-sm">Đang tải cấu hình...</p>
              </div>
            ) : (
              <div className="p-6 md:p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Variants (Internal read-only for now) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">Phiên bản</label>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex justify-between items-center">
                    <span className="text-sm font-bold text-primary">{editingItem.variantName}</span>
                    <span className="text-[10px] font-bold text-black">Không thể đổi phiên bản tại đây</span>
                  </div>
                </div>

                {/* Swaps */}
                {fullPackageData?.packageVariants?.find(v => v.variantId === selectedVariantId)?.availableSwaps?.length ? (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">Thay đổi món lễ (Swaps)</label>
                    <div className="space-y-3">
                      {fullPackageData.packageVariants.find(v => v.variantId === selectedVariantId)?.availableSwaps?.map((swap) => {
                        const isSelected = selectedSwapIds.includes(swap.swapId);
                        return (
                          <div
                            key={swap.swapId}
                            onClick={() => {
                              setSelectedSwapIds(prev =>
                                prev.includes(swap.swapId) ? prev.filter(id => id !== swap.swapId) : [...prev, swap.swapId]
                              );
                            }}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-50 hover:border-primary/20 bg-slate-50/50'}`}
                          >
                            <div className="flex-1">
                              <p className="text-xs font-bold text-slate-700">{swap.replacementItemName}</p>
                              <p className="text-[10px] text-black mt-1 italic">Thay thế: {swap.originalItemName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-primary">+{swap.surcharge.toLocaleString()}đ</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Add-ons */}
                {fullPackageData?.availableAddOns?.length ? (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">Món cúng kèm (Add-ons)</label>
                    <div className="space-y-3">
                      {fullPackageData.availableAddOns.map((addon) => {
                        const current = selectedAddOns.find(a => a.addOnId === addon.addOnId);
                        const quantity = current?.quantity || 0;

                        const updateAddOn = (q: number) => {
                          if (q <= 0) {
                            setSelectedAddOns(prev => prev.filter(a => a.addOnId !== addon.addOnId));
                          } else {
                            setSelectedAddOns(prev => {
                              const existing = prev.find(a => a.addOnId === addon.addOnId);
                              if (existing) return prev.map(a => a.addOnId === addon.addOnId ? { ...a, quantity: q } : a);
                              return [...prev, { addOnId: addon.addOnId, quantity: q }];
                            });
                          }
                        };

                        return (
                          <div key={addon.addOnId} className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center ${quantity > 0 ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-50 bg-slate-50/50'}`}>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-slate-700">{addon.addOnName || addon.itemName}</p>
                              <p className="text-xs font-bold text-emerald-600 mt-1">{addon.retailPrice.toLocaleString()}đ</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                              <button
                                onClick={() => updateAddOn(quantity - 1)}
                                disabled={quantity === 0}
                                className="size-6 flex items-center justify-center text-black hover:text-red-500 disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold w-4 text-center">{quantity}</span>
                              <button
                                onClick={() => updateAddOn(quantity + 1)}
                                className="size-6 flex items-center justify-center text-black hover:text-emerald-500"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button
                onClick={() => setEditingItem(null)}
                disabled={updating !== null}
                className="flex-1 py-4 text-sm font-bold text-black hover:bg-slate-100 rounded-2xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleUpdateItemOptions}
                disabled={editLoading || updating !== null}
                className="flex-[2] py-4 text-sm font-bold text-white bg-primary rounded-2xl shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
              >
                {updating !== null ? 'Đang cập nhật...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
