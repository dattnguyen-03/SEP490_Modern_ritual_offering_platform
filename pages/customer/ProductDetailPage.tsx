import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_PRODUCTS } from '../../constants';
import ImageModal from '../../components/ImageModal';
import { Product } from '../../types';
import { packageService } from '../../services/packageService';
import { VendorProfile, vendorService } from '../../services/vendorService';
import { getCurrentUser, getProfile } from '../../services/auth';
import { reviewService, Review } from '../../services/reviewService';
import toast from '../../services/toast';
import { cartService } from '../../services/cartService';
import { vendorChatService } from '../../services/vendorChatService';
import LoadingScreen from '../../components/LoadingScreen';

const ProductDetailPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [vendorOverallReviews, setVendorOverallReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [hoveredVariantIndex, setHoveredVariantIndex] = useState<number | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showReviewImageModal, setShowReviewImageModal] = useState(false);
  const [reviewImagesForModal, setReviewImagesForModal] = useState<string[]>([]);
  const [selectedReviewImageIndex, setSelectedReviewImageIndex] = useState(0);
  const [currentMainImage, setCurrentMainImage] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [packageMeta, setPackageMeta] = useState<any | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [vendorReplyingTo, setVendorReplyingTo] = useState<string | null>(null);
  const [vendorReplyText, setVendorReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [activeReviewMenu, setActiveReviewMenu] = useState<string | null>(null);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<number, boolean>>({});
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    const checkVendorStatus = async () => {
      const user = getCurrentUser();
      if (!user) return;

      if (user.role?.toLowerCase() === 'vendor' || user.roles?.some(r => r.toLowerCase() === 'vendor')) {
        setIsVendor(true);
        return;
      }

      try {
        const profile = await getProfile();
        if (profile.isVendor) {
          setIsVendor(true);
        }
      } catch (e) {
        // Silent fail
      }
    };
    checkVendorStatus();
  }, []);

  const buildVendorFromPackage = (pkg: any): VendorProfile | null => {
    const profileId = String(pkg?.vendorProfileId || pkg?.vendorId || pkg?.vendor?.profileId || pkg?.vendor?.vendorProfileId || pkg?.vendor?.vendorId || '').trim();
    const shopName = String(pkg?.shopName || pkg?.vendorName || pkg?.vendor?.shopName || pkg?.vendor?.vendorName || '').trim();
    if (!profileId || !shopName) return null;

    return {
      profileId: profileId,
      shopName: shopName,
      shopDescription: pkg?.vendor?.description,
      avatarUrl: pkg?.vendor?.shopAvatarUrl || pkg?.vendor?.avatarUrl,
      shopAvatarUrl: pkg?.vendor?.shopAvatarUrl,
      businessType: pkg?.vendor?.businessType,
      shopAddressText: pkg?.vendor?.address || pkg?.vendor?.addressText,
      ratingAvg: typeof pkg?.vendor?.ratingAvg === 'number' ? pkg.vendor.ratingAvg : (typeof pkg?.vendor?.rating === 'number' ? pkg.vendor.rating : undefined),
      dailyCapacity: pkg?.vendor?.dailyCapacity,
      tierName: pkg?.vendor?.tierName,
      createdAt: pkg?.vendor?.createdAt || new Date().toISOString(), // Fallback to current date if not available
      // Legacy fields for compatibility
      vendorProfileId: profileId,
      responseRate: pkg?.vendor?.responseRate,
      joinedDate: pkg?.vendor?.joinedDate || pkg?.vendor?.createdAt,
      productCount: pkg?.vendor?.productCount,
      responseTime: pkg?.vendor?.responseTime,
      followerCount: pkg?.vendor?.followerCount,
    };
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const numericId = Number(String(id).trim());
      if (!Number.isInteger(numericId) || numericId <= 0) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const apiPackage = await packageService.getPackageById(numericId);
        if (apiPackage) {
          setPackageMeta(apiPackage as any);
          // Sau khi lấy được API Package, lấy thông tin Vendor để hiển thị Shop Name
          const vendorId = apiPackage.vendorProfileId || (apiPackage as any).vendorId;
          let vendorMap = new Map();

          if (vendorId) {
            try {
              const vendorData = await vendorService.getVendorCached(vendorId);
              if (vendorData) {
                vendorMap = new Map([[vendorId, vendorData]]);
                setVendor(vendorData); // Set vendor state here
                console.log('✅ Vendor profile included for mapping:', vendorData.shopName);

                // Concurrent fetch for vendor meta
                Promise.all([
                  packageService.getPackagesByVendor(vendorId),
                  reviewService.getReviewsByVendorId(vendorId)
                ]).then(([pkgs, reviews]) => {
                  packageService.mapToProductsWithVendors(pkgs).then(setVendorProducts);
                  setVendorOverallReviews(reviews);
                }).catch(e => console.warn('⚠️ Error fetching vendor extra data:', e));
              }
            } catch (vError) {
              console.warn('⚠️ Could not fetch vendor for package:', vError);
            }
          }

          const mappedProduct = packageService.mapToProduct(apiPackage, vendorMap);
          console.log('✅ Found API Package:', mappedProduct);
          setProduct(mappedProduct);
        } else {
          setPackageMeta(null);
          setProduct(null);
        }
      } catch (error) {
        setPackageMeta(null);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const currentUser = getCurrentUser();
  const role = currentUser?.role?.toLowerCase() || '';
  const isModerator = ['admin', 'staff', 'vendor'].includes(role);

  const isOwnerVendor = isVendor || isModerator; // Simplified for now but could be refined to check vendorId match if needed.

  const fetchReviews = useCallback(async () => {
    const rawId = id ?? product?.id;
    const packageId = Number(String(rawId ?? '').trim());
    if (!Number.isInteger(packageId) || packageId <= 0) {
      setReviews([]);
      return;
    }

    setLoadingReviews(true);
    try {
      const data = await reviewService.getReviewsByPackageId(packageId);
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [id, product?.id]);

  useEffect(() => {
    if (product) {
      fetchReviews();
    }
  }, [product, fetchReviews]);

  // Auto-cap Add-ons when quantity changes
  useEffect(() => {
    const updatedAddOns = { ...selectedAddOns };
    let hasChanges = false;

    Object.entries(updatedAddOns).forEach(([id, qty]) => {
      const addOn = product?.availableAddOns?.find(a => a.addOnId === Number(id));
      if (addOn && addOn.maxQtyPerOrder) {
        const maxAllowed = addOn.maxQtyPerOrder * quantity;
        if (qty > maxAllowed) {
          updatedAddOns[Number(id)] = maxAllowed;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setSelectedAddOns(updatedAddOns);
    }
  }, [quantity, product?.availableAddOns, selectedAddOns]);

  const handleVendorReply = async (reviewId: string) => {
    if (!vendorReplyText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    setIsSubmittingReply(true);
    try {
      const success = await reviewService.updateVendorReply(reviewId, vendorReplyText);
      if (success) {
        toast.success('Phản hồi thành công!');
        setVendorReplyingTo(null);
        setVendorReplyText('');
        fetchReviews();
      }
    } catch (error: any) {
      toast.error(error.message || 'Phản hồi thất bại.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleToggleVisibility = async (reviewId: string, currentVisibility: boolean) => {
    setIsTogglingVisibility(true);
    try {
      const success = await reviewService.updateReviewVisibility(reviewId, !currentVisibility);
      if (success) {
        toast.success(`Đã ${!currentVisibility ? 'hiện' : 'ẩn'} đánh giá!`);
        fetchReviews();
      }
    } catch (error: any) {
      toast.error(error.message || 'Thao tác thất bại.');
    } finally {
      setIsTogglingVisibility(false);
      setActiveReviewMenu(null);
    }
  };

  const reviewsToDisplay = reviews.filter(r => {
    // If user is staff/vendor, show everything
    if (isOwnerVendor) return true;

    // Otherwise only show visible reviews
    // Handle both boolean true/false and cases where field might be missing (default to visible)
    return r.isVisible === true || r.isVisible === undefined || (r as any).isvisible === true;
  });

  const averageRating = reviewsToDisplay.length > 0
    ? (reviewsToDisplay.reduce((acc, r) => acc + r.rating, 0) / reviewsToDisplay.length).toFixed(1)
    : (product?.rating?.toFixed(1) || '0.0');

  const ratingDistribution = [5, 4, 3, 2, 1].map(stars => {
    const count = reviewsToDisplay.filter(r => Math.round(r.rating) === stars).length;
    const percentage = reviewsToDisplay.length > 0 ? (count / reviewsToDisplay.length) * 100 : 0;
    return { stars, count, percentage };
  });

  const thumbnailImages = product?.gallery && product.gallery.length > 0
    ? product.gallery
    : [
      'https://picsum.photos/400/400?random=1',
      'https://picsum.photos/400/400?random=2',
      'https://picsum.photos/400/400?random=3',
      'https://picsum.photos/400/400?random=4',
    ];

  const productImages = Array.from(new Set([
    product?.image || '',
    ...thumbnailImages
  ])).filter(img => img);

  const activeVariantIndex = hoveredVariantIndex !== null ? hoveredVariantIndex : selectedVariantIndex;

  const selectedVariantMeta = Array.isArray(packageMeta?.packageVariants) && activeVariantIndex !== null
    ? packageMeta.packageVariants[activeVariantIndex]
    : null;

  const variantImages = selectedVariantMeta
    ? Array.from(new Set([
      String(selectedVariantMeta?.imageUrl || '').trim(),
      ...(Array.isArray(selectedVariantMeta?.variantImages) ? selectedVariantMeta.variantImages : []),
    ])).filter(Boolean)
    : [];

  const displayImages = (activeVariantIndex !== null && variantImages.length > 0) ? variantImages : productImages;

  const selectedVariantDescription =
    selectedVariantMeta?.description ||
    (activeVariantIndex !== null ? product?.variants?.[activeVariantIndex]?.description : null) ||
    packageMeta?.description ||
    product?.description ||
    '';

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentMainImage(index);
  };

  const descriptionText = product?.description || 'Sản phẩm được chuẩn bị tươm tất với đầy đủ các vật phẩm truyền thống, mang lại sự thành tâm và trang trọng cho không gian thờ cúng của gia đình.';

  const handleAddToCart = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để thêm vào giỏ hàng');
      navigate(`/auth?redirect=/product/${id}`);
      return;
    }

    const selectedVariant = selectedVariantIndex !== null ? product?.variants?.[selectedVariantIndex] : null;
    if (!selectedVariant || !selectedVariant.variantId) {
      toast.error('Vui lòng chọn gói lễ');
      return;
    }

    // Validation for min/max quantity
    const min = selectedVariant.minOrderQuantity ?? 1;
    const max = selectedVariant.maxOrderQuantity ?? 99;
    if (quantity < min) {
      toast.error(`Số lượng tối thiểu cho gói này là ${min}`);
      return;
    }
    if (quantity > max) {
      toast.error(`Số lượng tối đa cho gói này là ${max}`);
      return;
    }

    setAddingToCart(true);
    try {
      const success = await cartService.addToCart({
        variantId: selectedVariant.variantId,
        quantity,
        swaps: Object.entries(selectedSwaps)
          .filter(([_, selected]) => selected)
          .map(([id]) => ({ swapId: Number(id) })),
        addOns: Object.entries(selectedAddOns)
          .filter(([_, qty]) => qty > 0)
          .map(([id, qty]) => ({ addOnId: Number(id), quantity: qty }))
      });
      if (success) {
        toast.success('Đã thêm vào giỏ hàng!');
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể thêm vào giỏ hàng. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để mua hàng');
      navigate(`/auth?redirect=/product/${id}`);
      return;
    }

    const selectedVariant = selectedVariantIndex !== null ? product?.variants?.[selectedVariantIndex] : null;
    if (!selectedVariant || !selectedVariant.variantId) {
      toast.error('Vui lòng chọn gói lễ');
      return;
    }

    // Validation for min/max quantity
    const min = selectedVariant.minOrderQuantity ?? 1;
    const max = selectedVariant.maxOrderQuantity ?? 99;
    if (quantity < min) {
      toast.error(`Số lượng tối thiểu cho gói này là ${min}`);
      return;
    }
    if (quantity > max) {
      toast.error(`Số lượng tối đa cho gói này là ${max}`);
      return;
    }

    setBuyingNow(true);
    try {
      const success = await cartService.addToCart({
        variantId: selectedVariant.variantId,
        quantity,
        swaps: Object.entries(selectedSwaps)
          .filter(([_, selected]) => selected)
          .map(([id]) => ({ swapId: Number(id) })),
        addOns: Object.entries(selectedAddOns)
          .filter(([_, qty]) => qty > 0)
          .map(([id, qty]) => ({ addOnId: Number(id), quantity: qty }))
      });

      if (success) {
        window.dispatchEvent(new Event('cartUpdated'));
        const cart = await cartService.getCart();
        if (cart && cart.cartItems) {
          const addedItem = cart.cartItems.find(item => item.variantId === selectedVariant.variantId);
          if (addedItem) {
            onNavigate(`/checkout?cartItemId=${addedItem.cartItemId}`);
            return;
          }
        }
        onNavigate('/cart');
      } else {
        toast.error('Không thể mua hàng. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('❌ Error in buy now:', error);
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setBuyingNow(false);
    }
  };

  const handleStartChat = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để nhắn tin với vendor');
      navigate(`/auth?redirect=/product/${id}`);
      return;
    }

    if (!vendor) return;

    try {
      const sessionId = await vendorChatService.createSession(
        vendor.profileId || (vendor as any).vendorProfileId,
        Number(id)
      );
      onNavigate(`/messages?sessionId=${sessionId}`);
    } catch (error: any) {
      toast.error(error.message || 'Không thể bắt đầu trò chuyện');
    }
  };

  if (loading) {
    return <LoadingScreen message="Đang khám phá lễ vật..." subMessage="Trau chuốt từng chi tiết tâm linh" />;
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 text-center">
        <h1 className="text-4xl font-black text-primary mb-6">Sản phẩm không tìm thấy</h1>
        <p className="text-slate-500 mb-8">Sản phẩm bạn tìm kiếm không tồn tại hoặc đã bị xóa</p>
        <button
          onClick={() => onNavigate('/shop')}
          className="border-2 border-primary text-primary px-8 py-3 rounded-lg font-bold hover:bg-primary/5 transition-all"
        >
          Quay lại danh sách sản phẩm
        </button>
      </div>
    );
  }

  const vendorRatingCount = vendorOverallReviews.length;
  const vendorAvgRating = vendorRatingCount > 0
    ? (vendorOverallReviews.reduce((acc, r) => acc + r.rating, 0) / vendorRatingCount).toFixed(1)
    : (vendor?.ratingAvg || '0.0');

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-12">
      <nav className="flex flex-wrap items-center gap-2 mb-6 md:mb-10 text-[11px] md:text-[13px] font-medium text-black">
        <button onClick={() => onNavigate('/')} className="hover:text-primary">Trang chủ</button>
        <span className="text-xs">›</span>
        <button onClick={() => onNavigate('/shop')} className="hover:text-primary">Danh mục</button>
        <span className="text-xs">›</span>
        <span className="text-slate-900 font-bold">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-7 space-y-6">
          <div
            className="relative aspect-square md:aspect-[4/3] rounded-[2rem] md:rounded-3xl overflow-hidden shadow-2xl bg-white border border-gold/10 cursor-pointer hover:shadow-xl transition-all"
            onClick={() => handleImageClick(currentMainImage)}
          >
            <img className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" src={displayImages[currentMainImage]} alt={product.name} />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {displayImages.map((imgUrl, i) => (
              <div
                key={i}
                className={`w-20 h-20 shrink-0 aspect-square rounded-xl md:rounded-2xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${currentMainImage === i ? 'border-primary' : 'border-transparent hover:border-primary'}`}
                onClick={() => handleThumbnailClick(i)}
                onMouseEnter={() => handleThumbnailClick(i)}
              >
                <img className="w-full h-full object-cover hover:scale-110 transition-transform" src={imgUrl} alt={`Ảnh ${i + 1}`} />
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white rounded-[2.5rem] border border-gold/10 p-8 md:p-10 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-gold/10 transition-colors"></div>

            <div className="prose prose-slate max-w-none relative">
              <div
                className={`text-slate-600 leading-[1.8] text-sm md:text-base whitespace-pre-line bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50 transition-all duration-500 overflow-hidden ${!isDescriptionExpanded ? 'max-h-[220px]' : 'max-h-none'}`}
              >
                {descriptionText}
                {!isDescriptionExpanded && descriptionText.length > 300 && (
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50/90 to-transparent pointer-events-none rounded-b-2xl"></div>
                )}
              </div>
              {descriptionText.length > 300 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="mt-4 text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-3 transition-all"
                >
                  {isDescriptionExpanded ? (
                    <><span>Rút gọn</span> <span>↑</span></>
                  ) : (
                    <><span>Xem thêm chi tiết</span> <span>↓</span></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 md:space-y-8">
          <div className="space-y-4">
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-widest rounded-md">Truyền thống</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-display font-black leading-tight text-primary">{product.name}</h1>
            <div className="flex items-baseline gap-3 md:gap-4">
              <p className="text-3xl md:text-4xl font-black text-primary tracking-tight">
                {(product.variants && activeVariantIndex !== null && product.variants[activeVariantIndex]
                  ? product.variants[activeVariantIndex].price
                  : product.price).toLocaleString()}đ
              </p>
              {product.originalPrice && (
                <p className="text-lg text-black line-through">{product.originalPrice.toLocaleString()}đ</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-gold">★</span>
                <span className="text-sm font-bold text-slate-800">
                  {product.rating} <span className="text-black font-medium">({reviewsToDisplay.length} đánh giá)</span>
                </span>
              </div>
              {product.totalSold !== undefined && product.totalSold > 0 && (
                <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
              )}
              {product.totalSold !== undefined && product.totalSold > 0 && (
                <span className="text-sm font-bold text-slate-800 italic">Đã bán {product.totalSold}</span>
              )}
            </div>


          </div>

          <div className="p-6 md:p-8 bg-white rounded-[2rem] border border-gold/10 shadow-xl space-y-6 md:space-y-8">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black block mb-4">Gói lễ vật</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {product.variants?.map((variant, index) => (
                  <button
                    key={variant.variantId}
                    onClick={() => {
                      if (selectedVariantIndex !== index) {
                        setSelectedVariantIndex(index);
                        // Reset selections when changing variants to avoid sending invalid IDs
                        setSelectedSwaps({});
                        setSelectedAddOns({});
                        
                        // Update quantity if current quantity is out of range for new variant
                        const min = variant.minOrderQuantity ?? 1;
                        const max = variant.maxOrderQuantity ?? 99;
                        if (quantity < min) setQuantity(min);
                        else if (quantity > max) setQuantity(max);
                      } else {
                        setSelectedVariantIndex(null);
                        setSelectedSwaps({});
                        setSelectedAddOns({});
                      }
                      setCurrentMainImage(0);
                    }}
                    onMouseEnter={() => {
                      setHoveredVariantIndex(index);
                      setCurrentMainImage(0);
                    }}
                    onMouseLeave={() => {
                      setHoveredVariantIndex(null);
                      setCurrentMainImage(0);
                    }}
                    className={`p-3 md:p-4 rounded-2xl border-2 text-center transition-all ${selectedVariantIndex === index ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' : 'border-slate-50 hover:border-gold hover:bg-gold/5'}`}
                  >
                    <p className={`text-xs font-bold leading-tight mb-1 ${selectedVariantIndex === index ? 'text-primary' : 'text-slate-700'}`}>{variant.tier}</p>
                    <p className="text-[10px] text-black font-medium">{variant.price.toLocaleString()}đ</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gold/10">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black block mb-4">Lễ vật bao gồm</label>
              {selectedVariantDescription && (
                <p className="text-xs font-medium text-slate-600 mb-5 leading-relaxed bg-gray-50 p-4 rounded-xl italic">"{selectedVariantDescription}"</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                {activeVariantIndex !== null && product.variants?.[activeVariantIndex]?.items?.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs font-bold text-slate-700">
                    <span className="text-gold mt-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                    <span className="leading-tight">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gold/10">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black block mb-4">Số lượng</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-100 rounded-2xl p-1">
                  <button
                    onClick={() => {
                      const min = (selectedVariantIndex !== null ? product.variants?.[selectedVariantIndex]?.minOrderQuantity : 1) ?? 1;
                      if (quantity > min) {
                        setQuantity(quantity - 1);
                      } else {
                        toast.warning(`Số lượng tối thiểu là ${min}`);
                      }
                    }}
                    className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary font-bold hover:bg-primary hover:text-white transition-all active:scale-90"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-transparent text-center text-lg font-black text-slate-800 focus:outline-none border-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => {
                      const max = (selectedVariantIndex !== null ? product.variants?.[selectedVariantIndex]?.maxOrderQuantity : 99) ?? 99;
                      if (quantity < max) {
                        setQuantity(quantity + 1);
                      } else {
                        toast.warning(`Số lượng tối đa là ${max}`);
                      }
                    }}
                    className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary font-bold hover:bg-primary hover:text-white transition-all active:scale-90"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] font-bold text-black uppercase tracking-widest italic hidden sm:block">Giao tận nơi</p>
              </div>


              {selectedVariantIndex !== null && product.variants?.[selectedVariantIndex] && (
                <div className="flex flex-wrap gap-4 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {(product.variants[selectedVariantIndex].minOrderQuantity !== undefined || product.variants[selectedVariantIndex].maxOrderQuantity !== undefined) && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {product.variants[selectedVariantIndex].minOrderQuantity !== undefined && `Tối thiểu: ${product.variants[selectedVariantIndex].minOrderQuantity}`}
                        {product.variants[selectedVariantIndex].minOrderQuantity !== undefined && product.variants[selectedVariantIndex].maxOrderQuantity !== undefined && ' • '}
                        {product.variants[selectedVariantIndex].maxOrderQuantity !== undefined && `Tối đa: ${product.variants[selectedVariantIndex].maxOrderQuantity}`}
                      </span>
                    </div>
                  )}
                  {product.variants[selectedVariantIndex].productionWeight !== undefined && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                        Điểm năng lực: {product.variants[selectedVariantIndex].productionWeight}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Available Swaps Section */}
            {selectedVariantIndex !== null && product.variants?.[selectedVariantIndex]?.availableSwaps && product.variants[selectedVariantIndex].availableSwaps!.length > 0 && (
              <div className="pt-6 border-t border-gold/10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black block mb-4">Tùy chọn thay đổi (Swaps)</label>
                <div className="space-y-3">
                  {product.variants[selectedVariantIndex].availableSwaps!.map((swap) => (
                    <div
                      key={swap.swapId}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedSwaps[swap.swapId] ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' : 'border-slate-50 hover:border-gold hover:bg-gold/5'}`}
                      onClick={() => setSelectedSwaps(prev => ({ ...prev, [swap.swapId]: !prev[swap.swapId] }))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">
                            Thay <span className="text-slate-500 line-through font-medium">{swap.originalItemName}</span>
                          </p>
                          <p className="text-sm font-black text-primary">
                            Bằng {swap.replacementItemName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-black ${swap.surcharge > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {swap.surcharge > 0 ? `+${swap.surcharge.toLocaleString()}đ` : 'Miễn phí'}
                          </p>
                          <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedSwaps[swap.swapId] ? 'border-primary bg-primary' : 'border-slate-200'}`}>
                            {selectedSwaps[swap.swapId] && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Add-ons Section */}
            {product.availableAddOns && product.availableAddOns.length > 0 && (
              <div className="pt-6 border-t border-gold/10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-black block mb-4">Mua thêm lễ vật</label>
                <div className="space-y-3">
                  {product.availableAddOns.map((addOn) => (
                    <div
                      key={addOn.addOnId}
                      className={`p-4 rounded-2xl border-2 transition-all ${selectedAddOns[addOn.addOnId] > 0 ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' : 'border-slate-50 hover:border-gold hover:bg-gold/5'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{addOn.addOnName || addOn.itemName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-primary">{addOn.retailPrice.toLocaleString()}đ</p>
                            {addOn.maxQtyPerOrder && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
                                Tối đa {addOn.maxQtyPerOrder}/mâm
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                          <button
                            onClick={() => setSelectedAddOns(prev => ({ ...prev, [addOn.addOnId]: Math.max(0, (prev[addOn.addOnId] || 0) - 1) }))}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-all ${selectedAddOns[addOn.addOnId] > 0 ? 'bg-white text-primary shadow-sm active:scale-90' : 'text-slate-300 pointer-events-none'}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={selectedAddOns[addOn.addOnId] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const limitPerItem = addOn.maxQtyPerOrder || 99;
                              const maxAllowed = limitPerItem * quantity;
                              
                              if (val > maxAllowed) {
                                toast.warning(`Số lượng tối đa cho món này là ${maxAllowed} (${limitPerItem}/mâm)`);
                                setSelectedAddOns(prev => ({ ...prev, [addOn.addOnId]: maxAllowed }));
                              } else {
                                setSelectedAddOns(prev => ({ ...prev, [addOn.addOnId]: Math.max(0, val) }));
                              }
                            }}
                            className="w-10 bg-transparent text-center text-xs font-black text-slate-800 focus:outline-none border-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => {
                              const currentQty = selectedAddOns[addOn.addOnId] || 0;
                              const limitPerItem = addOn.maxQtyPerOrder || 99;
                              const maxAllowed = limitPerItem * quantity;
                              
                              if (currentQty < maxAllowed) {
                                setSelectedAddOns(prev => ({ ...prev, [addOn.addOnId]: currentQty + 1 }));
                              } else {
                                toast.warning(`Số lượng tối đa cho món này là ${maxAllowed} (${limitPerItem}/mâm)`);
                              }
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-all bg-white text-primary shadow-sm active:scale-90 hover:bg-primary hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Updated Price Calculation */}
            <div className="pt-6 border-t border-gold/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-black">Giá gói:</span>
                <span className="text-xs font-bold text-slate-700">
                  {((product.variants && selectedVariantIndex !== null && product.variants[selectedVariantIndex]
                    ? product.variants[selectedVariantIndex].price
                    : product.price) * quantity).toLocaleString()}đ
                </span>
              </div>

              {/* Surcharges from Swaps */}
              {Object.entries(selectedSwaps).filter(([_, selected]) => selected).map(([swapId]) => {
                const swap = product.variants?.[selectedVariantIndex!]?.availableSwaps?.find(s => s.swapId === Number(swapId));
                if (swap && swap.surcharge > 0) {
                  return (
                    <div key={swapId} className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">Phụ phí đổi món: ({swap.replacementItemName}):</span>
                      <span className="text-[10px] font-bold text-amber-600">+{(swap.surcharge * quantity).toLocaleString()}đ</span>
                    </div>
                  );
                }
                return null;
              })}

              {/* Add-ons Total */}
              {Object.entries(selectedAddOns).filter(([_, qty]) => qty > 0).map(([addOnId, qty]) => {
                const addOn = product.availableAddOns?.find(a => a.addOnId === Number(addOnId));
                if (addOn) {
                  return (
                    <div key={addOnId} className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Thêm ({addOn.addOnName || addOn.itemName} x{qty}):</span>
                      <span className="text-[10px] font-bold text-primary">+{(addOn.retailPrice * qty).toLocaleString()}đ</span>
                    </div>
                  );
                }
                return null;
              })}

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-slate-200">
                <span className="text-sm font-black text-slate-900">TỔNG CỘNG:</span>
                <span className="text-xl font-black text-primary">
                  {(
                    ((product.variants && selectedVariantIndex !== null && product.variants[selectedVariantIndex]
                      ? product.variants[selectedVariantIndex].price
                      : product.price) * quantity) +
                    Object.entries(selectedSwaps)
                      .filter(([_, selected]) => selected)
                      .reduce((sum, [id]) => sum + (product.variants?.[selectedVariantIndex!]?.availableSwaps?.find(s => s.swapId === Number(id))?.surcharge || 0) * quantity, 0) +
                    Object.entries(selectedAddOns)
                      .reduce((sum, [id, qty]) => sum + (product.availableAddOns?.find(a => a.addOnId === Number(id))?.retailPrice || 0) * qty, 0)
                  ).toLocaleString()}đ
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || buyingNow}
                className="w-full border-2 border-primary text-primary py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-primary/5 active:scale-[0.98] transition-all disabled:opacity-50 text-sm md:text-base"
              >
                {addingToCart ? 'Đang xử lý...' : 'Thêm vào giỏ hàng'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={addingToCart || buyingNow}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm md:text-base border-2 border-primary"
              >
                {buyingNow ? 'Đang chuẩn bị...' : 'Mua ngay'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {vendor && (
        <div className="mt-8 bg-white border border-slate-200 overflow-hidden rounded-[2rem] shadow-xl">
          <div className="bg-slate-900 p-6 md:p-8 text-white text-sm">
            <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
              <div className="flex items-center gap-6 lg:w-[40%] shrink-0">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white flex items-center justify-center text-slate-900 text-xl font-display font-black border-4 border-white/10 shrink-0 overflow-hidden shadow-2xl transition-all active:scale-95 ${(vendor.profileId || (vendor as any).vendorProfileId) ? 'cursor-pointer hover:border-primary/50' : ''}`}
                  onClick={() => (vendor.profileId || (vendor as any).vendorProfileId) && onNavigate(`/vendor/${vendor.profileId || (vendor as any).vendorProfileId}`)}
                >
                  {(vendor.shopAvatarUrl || vendor.avatarUrl) ? (
                    <img src={vendor.shopAvatarUrl || vendor.avatarUrl || ''} alt={vendor.shopName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{vendor.shopName.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="space-y-3 flex-1 min-w-0">
                  <div>
                    <h3
                      className={`text-2xl font-display font-black tracking-tighter truncate leading-none transition-colors ${(vendor.profileId || (vendor as any).vendorProfileId) ? 'cursor-pointer hover:text-primary' : ''}`}
                      onClick={() => (vendor.profileId || (vendor as any).vendorProfileId) && onNavigate(`/vendor/${vendor.profileId || (vendor as any).vendorProfileId}`)}
                    >
                      {vendor.shopName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Cửa hàng đối tác</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleStartChat}
                      className="flex-1 lg:flex-none px-5 py-2.5 bg-white text-slate-900 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg"
                    >
                      Nhắn tin
                    </button>
                    <button
                      onClick={() => (vendor.profileId || (vendor as any).vendorProfileId) && onNavigate(`/vendor/${vendor.profileId || (vendor as any).vendorProfileId}`)}
                      className="flex-1 lg:flex-none px-5 py-2.5 bg-white/5 border border-white/20 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                    >
                      Xem Shop
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full lg:border-l border-white/10 lg:pl-10">
                <div className="grid grid-cols-3 sm:grid-cols-3 xl:grid-cols-6 gap-y-8 gap-x-4">
                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Đánh giá</span>
                    <p className="text-lg font-display font-black leading-none">
                      {vendorAvgRating} <span className="text-[10px] font-bold text-white/20">/ 5</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Sản phẩm</span>
                    <p className="text-lg font-display font-black leading-none">{vendorProducts.length || '24'}</p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Phản hồi</span>
                    <p className="text-lg font-display font-black leading-none">99%</p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Tham gia</span>
                    <p className="text-lg font-display font-black leading-none">12 <span className="text-[10px] font-bold text-white/20 ml-1">Tháng</span></p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Hạng</span>
                    <p className="text-lg font-display font-black leading-none uppercase text-gold">{vendor.tierName || 'Vàng'}</p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] block">Trạng thái</span>
                    <p className="text-lg font-display font-black leading-none text-emerald-400">Uy tín</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-16 space-y-8">
        <h2 className="text-3xl font-black text-primary">Đánh giá sản phẩm</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-gold/10 shadow-sm">
            <div className="text-center mb-6">
              <div className="text-5xl font-black text-primary mb-2">{averageRating}</div>
              <div className="flex justify-center mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} className="text-2xl" style={{ color: star <= Math.round(Number(averageRating)) ? '#FFD700' : '#cbd5e1' }}>★</span>
                ))}
              </div>
              <p className="text-sm text-slate-500">{reviewsToDisplay.length} đánh giá cho gói này</p>
            </div>
            <div className="space-y-2">
              {ratingDistribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-8">{item.stars}★</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all" style={{ width: `${item.percentage}%`, backgroundColor: '#FFD700' }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {loadingReviews ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-gold/10">
                <div className="w-10 h-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-slate-500">Đang tải đánh giá...</p>
              </div>
            ) : reviewsToDisplay.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-gold/10">
                <div className="text-6xl mb-4"></div>
                <p className="text-slate-500">Chưa có đánh giá nào cho gói lễ này.</p>
                {reviews.length > 0 && (
                  <p className="text-[10px] text-slate-300 mt-2 italic">
                    (Tìm thấy {reviews.length} đánh giá nhưng đều đang ở trạng thái ẩn)
                  </p>
                )}
              </div>
            ) : (
              reviewsToDisplay.map((review) => (
                <div
                  key={review.reviewId}
                  className={`bg-white rounded-3xl p-6 border border-gold/10 shadow-sm transition-all duration-300 ${!review.isVisible ? 'opacity-60 bg-slate-50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner flex-shrink-0">
                      {review.customerAvatar ? (
                        <img src={review.customerAvatar} alt={review.customerName} className="w-full h-full object-cover" />
                      ) : (
                        review.customerName?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900">{review.customerName}</h4>
                            {!review.isVisible && (
                              <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-200">Đã ẩn</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(star => (
                                <span key={star} className="text-sm" style={{ color: star <= review.rating ? '#FFD700' : '#cbd5e1' }}>★</span>
                              ))}
                            </div>
                            <span className="text-xs text-black">• {new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                            {review.variantName && <span className="text-[10px] text-black font-bold ml-2 italic">({review.variantName})</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-green-100">Đã mua hàng</span>
                          {isOwnerVendor && (
                            <div className="relative">
                              <button
                                onClick={() => setActiveReviewMenu(activeReviewMenu === String(review.reviewId) ? null : String(review.reviewId))}
                                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-black hover:text-slate-600"
                                title="Quản lý"
                              >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="5" r="1" />
                                  <circle cx="12" cy="12" r="1" />
                                  <circle cx="12" cy="19" r="1" />
                                </svg>
                              </button>

                              {activeReviewMenu === review.reviewId && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-black uppercase tracking-widest">Quản lý đánh giá</p>
                                  </div>
                                  <button
                                    onClick={() => handleToggleVisibility(String(review.reviewId), !!review.isVisible)}
                                    disabled={isTogglingVisibility}
                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                                  >
                                    <div className={`p-1.5 rounded-lg ${review.isVisible ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        {review.isVisible ? (
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        ) : (
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.228 8.396 6.633 5 12 5c4.183 0 7.39 2.21 8.946 5.378.345.7.345 1.503 0 2.204-1.555 3.168-4.763 5.378-8.946 5.378-4.183 0-7.39-2.21-8.946-5.378z" />
                                        )}
                                      </svg>
                                    </div>
                                    <span className={`text-xs font-bold ${review.isVisible ? 'text-red-500' : 'text-green-600'}`}>
                                      {review.isVisible ? 'Ẩn đánh giá này' : 'Hiện đánh giá này'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-4">{review.comment}</p>

                      {review.reviewImageUrls?.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-4">
                          {review.reviewImageUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt="Review"
                              className="w-20 h-20 rounded-xl object-cover border border-gray-100 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setReviewImagesForModal(review.reviewImageUrls);
                                setSelectedReviewImageIndex(idx);
                                setShowReviewImageModal(true);
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Vendor Reply Display */}
                      {review.vendorReply && vendorReplyingTo !== String(review.reviewId) ? (
                        <div className="mt-4 p-4 bg-primary/5 rounded-2xl border-l-4 border-primary relative">
                          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Phản hồi từ shop</p>
                          <p className="text-sm text-slate-600 italic">"{review.vendorReply}"</p>
                          {/* {isOwnerVendor && (
                            <button
                              onClick={() => { setVendorReplyingTo(review.reviewId); setVendorReplyText(review.vendorReply || ''); }}
                              className="absolute top-4 right-4 text-[10px] font-bold text-primary hover:underline hover:scale-110 transition-transform"
                            >
                              Sửa
                            </button>
                          )} */}
                        </div>
                      ) : isOwnerVendor && vendorReplyingTo !== String(review.reviewId) ? (
                        <button
                          onClick={() => setVendorReplyingTo(String(review.reviewId))}
                          className="mt-4 text-[11px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 px-3 py-1.5 rounded-lg border border-primary transition-all"
                        >
                          Phản hồi ngay
                        </button>
                      ) : null}

                      {/* Vendor Reply Form */}
                      {isOwnerVendor && vendorReplyingTo === String(review.reviewId) && (
                        <div className="mt-4 space-y-3 bg-slate-50 p-5 rounded-2xl border border-gold/10 animate-in fade-in slide-in-from-top-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><span></span> Phản hồi cho khách hàng</p>
                          <textarea
                            value={vendorReplyText}
                            onChange={(e) => setVendorReplyText(e.target.value)}
                            placeholder="Cảm ơn khách hàng hoặc giải đáp thắc mắc..."
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleVendorReply(String(review.reviewId))} disabled={isSubmittingReply} className="px-6 py-2 bg-primary text-white font-black rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 text-[10px] uppercase">Gửi phản hồi</button>
                            <button onClick={() => { setVendorReplyingTo(null); setVendorReplyText(''); }} disabled={isSubmittingReply} className="px-6 py-2 border border-slate-300 text-slate-500 font-black rounded-lg hover:bg-gray-100 transition-all text-[10px] uppercase">Hủy</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showImageModal && (
        <ImageModal
          images={displayImages}
          initialIndex={selectedImageIndex}
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
      <ImageModal
        isOpen={showReviewImageModal}
        onClose={() => setShowReviewImageModal(false)}
        images={reviewImagesForModal}
        initialIndex={selectedReviewImageIndex}
      />
    </div>
  );
};

export default ProductDetailPage;
