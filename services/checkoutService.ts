import { ApiResponse, ApiPackage, PackageVariant } from '../types';
import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';
import { packageService } from './packageService';

export interface CheckoutItem {
  cartItemId: number;
  variantId: number;
  variantName: string;
  packageName: string;
  quantity: number;
  price: number;
  totalPrice?: number;
  lineTotal: number;
  vendorProfileId: string;
  vendorName: string;
  imageUrl?: string | null;
}

export interface VendorOrder {
  vendorProfileId: string;
  shopName: string;
  items: CheckoutItem[];
  subTotal: number;
  shippingDistanceKm: number;
  shippingFee: number;
  commissionRate: number;
  platformFee: number;
  vendorNetAmount: number;
  // Các field bổ sung từ backend
  isFreeShipping?: boolean;
  feeBreakdown?: string;
  discountAmount?: number;
  discountBreakdown?: string;
  totalAmount?: number;
  holdFee?: number;
}

export interface CheckoutSummary {
  totalItems: number;
  items: CheckoutItem[];
  subTotal: number;
  shippingFee: number;
  totalAmount: number;
  totalDiscount?: number;
  vendorOrders: VendorOrder[];
  deliveryAddress?: string;
  // Các field bổ sung để khớp backend
  customerPhone?: string;
  totalShippingFee?: number;
  finalAmount?: number;
  totalHoldFee?: number;
}

export interface CheckoutRequestItem {
  cartItemId: number;
}

export interface ProcessCheckoutItem {
  cartItemId: number;
  decorationNote?: string;
}

export interface ProcessCheckoutRequest {
  deliveryDate: string;
  deliveryTime: string;
  paymentMethod?: string;
  items: ProcessCheckoutItem[];
}

export interface ProcessCheckoutResponse {
  orderId: string;
  totalAmount: number;
  paymentUrl?: string;
  message: string;
}

class CheckoutService {
  private getHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  /**
   * Lấy thông tin tóm tắt checkout
   * POST /api/checkout/summary
   * Request body: Array of { cartItemId: number }
   */
  async getSummary(cartItemIds: number[]): Promise<CheckoutSummary | null> {
    try {
      // Backend expects: Array of { cartItemId: number }
      const requestBody = cartItemIds.map(id => ({ cartItemId: id }));
      console.log(' Fetching checkout summary (body):', requestBody);
      const response = await fetch(`${API_BASE_URL}/checkout/summary`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Checkout summary error:', response.status, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.errorMessages && errorJson.errorMessages.length > 0) {
            throw new Error(errorJson.errorMessages[0]);
          }
          if (errorJson.message) {
            throw new Error(errorJson.message);
          }
        } catch (e: any) {
          if (e.message && (e.message.toLowerCase().includes('json') || e.message.toLowerCase().includes('token'))) {
            // This was a JSON parse error, proceed to throw generic error
          } else {
            // This was our deliberate 'throw new Error(...)' or another real error
            throw e;
          }
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<CheckoutSummary> = await response.json();
      console.log(' Checkout summary:', data);
      
      let result: any = null;
      if (data.isSuccess && data.result) {
        result = data.result;
      } else if ((data as any).vendors || (data as any).items) {
        result = data;
      }

      if (result) {
        if (!result.items) {
          let allItems: any[] = [];
          const vendorsList = result.vendors || result.vendorOrders || [];
          if (Array.isArray(vendorsList)) {
            vendorsList.forEach((v: any) => {
              const nestedItems = v.items || v.cartItems || v.packageItems || v.products || v.packages || [];
              if (Array.isArray(nestedItems)) {
                // Thêm thông tin vendor vào item để hiển thị
                const itemsWithVendor = nestedItems.map(item => ({
                  ...item,
                  vendorName: item.vendorName || v.shopName || v.vendorName || 'Shop',
                  vendorProfileId: item.vendorProfileId || v.vendorId || v.id,
                  price: item.price || item.unitPrice,
                  totalPrice: item.lineTotal || (item.unitPrice * item.quantity),
                  imageUrl: item.imageUrl || item.packageAvatarUrl || item.packageImageUrl || item.productImageUrl || item.imageUrls?.[0] || null,
                }));
                allItems = [...allItems, ...itemsWithVendor];
              }
            });
          }
          result.items = allItems;
        }
        // Map thêm ảnh từ packages nếu item chưa có imageUrl
        try {
          const itemsWithoutImage = (result.items || []).filter((it: any) => !it.imageUrl);
          if (itemsWithoutImage.length > 0) {
            const normalizeKey = (value: unknown) => String(value || '').trim().toLowerCase();
            const packageImageById = new Map<number, string>();
            const packageImageByName = new Map<string, string>();
            const variantImageById = new Map<number, string>();
            const variantImageByKey = new Map<string, string>();

            const uniquePackageIds: number[] = Array.from(new Set(
              itemsWithoutImage
                .map((item: any) => Number(item.packageId ?? item.packageID ?? item.package?.packageId ?? item.package?.id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
            ));

            const packageDetails = await Promise.all(
              uniquePackageIds.map(async (packageId) => {
                const detail = await packageService.getPackageById(packageId, false);
                return detail ? { packageId, detail } : null;
              })
            );

            packageDetails.forEach((entry) => {
              if (!entry) return;
              const pkg = entry.detail as any;
              const rawImages = pkg.imageUrls || pkg.packageImages || [];
              const avatarUrl = pkg.packageAvatarUrl || pkg.imageUrl || pkg.packageImageUrl || '';
              const primaryIndexRaw = pkg.primaryImageIndex;
              const primaryIndex = typeof primaryIndexRaw === 'number' && primaryIndexRaw >= 0 && primaryIndexRaw < rawImages.length
                ? primaryIndexRaw
                : 0;
              const packageImage = avatarUrl || rawImages[primaryIndex] || rawImages[0] || '';

              if (packageImage) {
                packageImageById.set(Number(entry.packageId), packageImage);
                const packageNameKey = normalizeKey(pkg.packageName || pkg.name);
                if (packageNameKey && !packageImageByName.has(packageNameKey)) {
                  packageImageByName.set(packageNameKey, packageImage);
                }
              }

              const variants = pkg.packageVariants || pkg.variants || [];
              (Array.isArray(variants) ? variants : []).forEach((variant: any) => {
                const rawVariantId = variant.variantId ?? variant.id ?? variant.packageVariantId;
                const variantId = Number(rawVariantId);
                const variantImages = variant.imageUrls || variant.variantImageUrls || variant.images || [];
                const variantPrimaryIndexRaw = variant.primaryImageIndex ?? variant.primaryVariantImageIndex;
                const variantPrimaryIndex = typeof variantPrimaryIndexRaw === 'number' && variantPrimaryIndexRaw >= 0 && variantPrimaryIndexRaw < variantImages.length
                  ? variantPrimaryIndexRaw
                  : 0;
                const variantImage = variant.imageUrl || variant.image || variant.imageUrl || variantImages[variantPrimaryIndex] || variantImages[0] || packageImage || '';

                if (Number.isFinite(variantId) && variantImage) {
                  variantImageById.set(variantId, variantImage);
                }

                const packageNameKey = normalizeKey(pkg.packageName || pkg.name);
                const variantNameKey = normalizeKey(variant.variantName);
                if (packageNameKey && variantNameKey && variantImage) {
                  const combinedKey = `${packageNameKey}::${variantNameKey}`;
                  if (!variantImageByKey.has(combinedKey)) {
                    variantImageByKey.set(combinedKey, variantImage);
                  }
                }
              });
            });

            result.items = (result.items || []).map((item: any) => {
              if (item.imageUrl) return item;

              const itemPackageId = Number(item.packageId ?? item.packageID ?? item.package?.packageId ?? item.package?.id);
              const itemVariantId = Number(item.variantId ?? item.packageVariantId);
              const packageNameKey = normalizeKey(item.packageName || item.name || item.productName);
              const variantNameKey = normalizeKey(item.variantName || item.tier);

              const resolvedImage =
                (Number.isFinite(itemVariantId) && variantImageById.get(itemVariantId)) ||
                (packageNameKey && variantNameKey ? variantImageByKey.get(`${packageNameKey}::${variantNameKey}`) : undefined) ||
                (Number.isFinite(itemPackageId) && packageImageById.get(itemPackageId)) ||
                (packageNameKey ? packageImageByName.get(packageNameKey) : undefined) ||
                item.packageAvatarUrl ||
                item.packageImageUrl ||
                item.productImageUrl ||
                item.imageUrls?.[0] ||
                null;

              return {
                ...item,
                imageUrl: resolvedImage,
              };
            });
          }
        } catch (imageError) {
          console.warn('⚠️ Unable to map package images for checkout summary:', imageError);
        }

        // Chuẩn hóa vendorOrders, áp dụng rule phí giữ chỗ theo từng order
        const rawVendors = result.vendors || result.vendorOrders || [];
        if (Array.isArray(rawVendors)) {
          result.vendorOrders = rawVendors.map((v: any) => {
            const subTotal = Number(v.subTotal ?? v.subtotal ?? 0) || 0;
            const shippingFee = Number(v.shippingFee ?? 0) || 0;
            const discountAmount = Number(v.discountAmount ?? 0) || 0;

            const vendorFinalRaw =
              v.finalTotal ??
              v.finalAmount ??
              v.totalAmount ??
              (subTotal + shippingFee - discountAmount);

            const vendorFinal = Number(vendorFinalRaw) || 0;

            let holdFee: number;
            if (typeof v.holdFee === 'number' && v.holdFee > 0) {
              // Tôn trọng giá trị holdFee từ backend nếu đã tính sẵn
              holdFee = v.holdFee;
            } else if (vendorFinal >= 2_000_000) {
              // Tự tính phí giữ chỗ 5% cho từng order nếu FinalAmount >= 2 triệu
              holdFee = Math.round(vendorFinal * 0.05);
            } else {
              holdFee = 0;
            }

            return {
              ...v,
              finalAmount: v.finalAmount ?? vendorFinal,
              holdFee,
            };
          });
        } else {
          result.vendorOrders = result.vendorOrders || result.vendors || [];
        }

        result.totalItems = result.totalItems || result.items.length;
        // Đồng bộ các field tổng theo backend
        result.totalShippingFee = result.totalShippingFee !== undefined
          ? result.totalShippingFee
          : (result.shippingFee !== undefined ? result.shippingFee : (result.totalShippingFee || 0));

        result.shippingFee = result.shippingFee !== undefined
          ? result.shippingFee
          : (result.totalShippingFee || 0);

        result.totalDiscount = result.totalDiscount !== undefined
          ? result.totalDiscount
          : (result.discountAmount || 0);

        // Tính tổng phí giữ chỗ từ vendorOrders nếu backend chưa set totalHoldFee
        if (result.totalHoldFee === undefined) {
          const vendorHoldTotal = Array.isArray(result.vendorOrders)
            ? result.vendorOrders.reduce((sum: number, v: any) => sum + (typeof v.holdFee === 'number' ? v.holdFee : 0), 0)
            : 0;
          result.totalHoldFee = typeof result.totalHoldFee === 'number' ? result.totalHoldFee : vendorHoldTotal;
        }

        // Phí giữ chỗ chỉ là khoản dự kiến bị trừ nếu khách hủy,
        // KHÔNG cộng vào số tiền khách phải thanh toán ngay.
        result.totalHoldFee = typeof result.totalHoldFee === 'number' ? result.totalHoldFee : 0;

        const baseFinalAmount = result.finalAmount !== undefined
          ? Number(result.finalAmount) || 0
          : ((Number(result.subTotal) || 0) + (Number(result.shippingFee) || 0) - (Number(result.totalDiscount) || 0));

        // Tổng cộng hiển thị cho khách: chỉ gồm hàng + ship - giảm giá (không gồm phí giữ chỗ)
        result.totalAmount = result.totalAmount !== undefined
          ? result.totalAmount
          : baseFinalAmount;
        
        return result as CheckoutSummary;
      } else {
        console.error(' API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error(' Failed to fetch checkout summary:', error);
      throw error;
    }
  }

  /**
   * Xử lý thanh toán đơn hàng
   * POST /api/checkout/process
   */
  async processCheckout(request: ProcessCheckoutRequest): Promise<ProcessCheckoutResponse | null> {
    try {
      const formattedTime = request.deliveryTime.length > 5 
        ? request.deliveryTime.substring(0, 5) 
        : request.deliveryTime;

      const formattedRequest = {
        ...request,
        deliveryTime: formattedTime + ":00"
      };

      console.log(' Processing checkout:', formattedRequest);
      console.log(' Request body:', JSON.stringify(formattedRequest, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/checkout/process`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(formattedRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', response.status, errorText);
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Error details:', errorData);
          if (errorData.errorMessages && errorData.errorMessages.length > 0) {
            errorMessage = errorData.errorMessages[0];
          }
        } catch (e) {
        }
        throw new Error(errorMessage);
      }

      const data: ApiResponse<ProcessCheckoutResponse> = await response.json();
      console.log(' Checkout processed:', data);
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error(' API Error:', data.errorMessages);
        if (data.errorMessages && data.errorMessages.length > 0) {
          throw new Error(data.errorMessages[0]);
        }
        throw new Error('Thanh toán thất bại');
      }
    } catch (error) {
      console.error(' Failed to process checkout:', error);
      throw error;
    }
  }

  /**
   * Lấy URL trả về sau thanh toán
   * GET /api/payments/payment-return
   */
  async getPaymentReturnUrl(): Promise<string | null> {
    try {
      console.log(' Fetching payment return URL');
      const response = await fetch(`${API_BASE_URL}/payments/payment-return`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(' Payment return URL:', data);
      
      return data.result || data;
    } catch (error) {
      console.error(' Failed to fetch payment return URL:', error);
      return null;
    }
  }

  /**
   * Khởi tạo thanh toán PayOS
   * POST /api/payos/create-topup-link
   */
  async initiatePayOSPayment(amount: number): Promise<{ paymentUrl?: string; checkoutUrl?: string } | null> {
    try {
      console.log(' Initiating PayOS payment');
      
      // PayOS bounds the amount between 10,000 and 100,000,000
      let safeAmount = amount;
      if (safeAmount < 10000) safeAmount = 10000;
      if (safeAmount > 100000000) safeAmount = 100000000;

      const requestBody = {
        amount: safeAmount,
        type: "customer"
      };
      const response = await fetch(`${API_BASE_URL}/payos/create-topup-link`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(' PayOS initiation error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<{ paymentUrl?: string; checkoutUrl?: string }> = await response.json();
      console.log(' PayOS payment initiated:', data);
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else if ((data as any).checkoutUrl || (data as any).paymentUrl) {
        return data as any;
      } else {
        console.error(' API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error(' Failed to initiate PayOS payment:', error);
      return null;
    }
  }

  /**
   * Lấy thông tin giao dịch
   * GET /api/payments/{transactionId}
   */
  async getTransaction(transactionId: string): Promise<any | null> {
    try {
      console.log(' Getting transaction:', transactionId);
      const response = await fetch(`${API_BASE_URL}/payments/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(' Get transaction error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      console.log(' Transaction retrieved:', data);
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error(' API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error(' Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Xử lý giao dịch
   * POST /api/payments/{transactionId}
   */
  async processTransaction(transactionId: string): Promise<any | null> {
    try {
      console.log(' Processing transaction:', transactionId);
      const response = await fetch(`${API_BASE_URL}/payments/${transactionId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(' Transaction processing error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      console.log(' Transaction processed:', data);
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error(' API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error(' Failed to process transaction:', error);
      return null;
    }
  }
}

export const checkoutService = new CheckoutService();
