import { ApiResponse, ApiPackage, PackageVariant } from '../types';
import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';
import { packageService } from './packageService';

export interface CheckoutItemAddOn {
  lineTotal: number;
  addOnId: number;
  itemName: string;
  retailPrice: number;
  quantity: number;
}

export interface CheckoutItemSwap {
  lineTotal: number;
  swapId: number;
  itemName: string;
  retailPrice: number;
  quantity: number;
}

export interface CheckoutItem {
  cartItemId: number;
  variantId: number;
  variantName: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  variantSubTotal: number;
  addOns: CheckoutItemAddOn[];
  addOnSubTotal: number;
  swaps: CheckoutItemSwap[];
  swapSubTotal: number;
  lineTotal: number;
  // UI helpers
  vendorProfileId?: string;
  vendorName?: string;
  imageUrl?: string | null;
  price?: number; 
}

export interface VendorOrder {
  finalTotal: number;
  vendorId: string;
  shopName: string;
  shippingDistanceKm: number;
  isFreeShipping: boolean;
  feeBreakdown: string;
  shippingFee: number;
  discountAmount: number;
  discountBreakdown?: string | null;
  totalAmount: number;
  holdFee: number;
  items: CheckoutItem[];
}

export interface CheckoutSummary {
  finalAmount: number;
  deliveryAddress: string;
  customerPhone: string;
  subTotal: number;
  totalShippingFee: number;
  totalDiscount: number;
  totalHoldFee: number;
  vendors: VendorOrder[];
  // UI compatibility helpers
  items: CheckoutItem[];
  totalItems: number;
  shippingFee: number;
  totalAmount: number;
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
        // Flatten items for legacy UI components
        const flattenedItems: CheckoutItem[] = [];
        const vendors = result.vendors || result.vendorOrders || [];
        
        if (Array.isArray(vendors)) {
          vendors.forEach((v: any) => {
            if (Array.isArray(v.items)) {
              v.items.forEach((item: any) => {
                const mappedItem: CheckoutItem = {
                  ...item,
                  vendorProfileId: v.vendorId || v.vendorProfileId || '',
                  vendorName: v.shopName || v.vendorName || 'Shop',
                  price: item.unitPrice || item.price || 0
                };
                flattenedItems.push(mappedItem);
              });
            }
          });
        }
        
        result.items = flattenedItems;
        result.totalItems = flattenedItems.length;
        result.totalAmount = result.finalAmount || 0;
        result.shippingFee = result.totalShippingFee || 0;

        // Map images
        try {
          const itemsWithoutImage = flattenedItems.filter((it: any) => !it.imageUrl);
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
