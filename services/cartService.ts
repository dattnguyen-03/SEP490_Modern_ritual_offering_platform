import { ApiResponse } from '../types';
import { getAuthToken } from './auth';

const API_BASE_URL = '/api';

// Cart API Types
export interface CartItemAddOnApi {
  cartItemAddOnId: number;
  addOnId: number;
  itemName: string;
  retailPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CartItemSwapApi {
  cartItemSwapId: number;
  swapId: number;
  originalItemName: string;
  replacementItemName: string;
  surcharge: number;
}

export interface CartItemApi {
  cartItemId: number;
  variantId: number;
  variantName: string;
  packageId: number;
  packageName: string;
  imageUrl?: string;
  price: number;
  quantity: number;
  variantSubTotal: number;
  swaps: CartItemSwapApi[];
  swapSubTotal: number;
  addOns: CartItemAddOnApi[];
  addOnSubTotal: number;
  lineTotal: number;
  // UI helper fields
  cartId?: number;
}

export interface CartVendorApi {
  vendorId: string;
  vendorName: string;
  totalItems: number;
  subTotal: number;
  items: CartItemApi[];
}

export interface CartApi {
  cartId: number;
  userId: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string | null;
  vendors: CartVendorApi[];
  totalItems: number;
  cartTotal: number;
  // Backward compatibility
  cartItems: CartItemApi[];
  subtotal: number;
}

export interface AddToCartRequest {
  variantId: number;
  quantity: number;
  swapIds?: number[];
  addOns?: { addOnId: number; quantity: number }[];
}

export interface UpdateCartItemRequest {
  cartItemId: number;
  quantity: number;
  swaps?: { swapId: number }[];
  addOns?: { addOnId: number; quantity: number }[];
}

class CartService {
  private getHeaders(method: string = 'GET'): HeadersInit {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    // Only set Content-Type for methods that actually have a body
    if (method !== 'GET' && method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Helper to extract cart data from various API response formats
   */
  private extractCartData(data: any): CartApi | null {
    if (!data) return null;

    let payload = data;

    // If the response is wrapped in ApiResponse { isSuccess, result, ... }
    if (data.isSuccess !== undefined || data.isSucceeded !== undefined || data.statusCode !== undefined) {
      if (data.isSuccess === false || data.isSucceeded === false) {
        // Some backends might return isSuccess: false for an empty cart instead of 404
        if (data.statusCode === 'NotFound' || data.errorMessages?.some((m: string) => m.toLowerCase().includes('not found'))) {
          return null;
        }
        console.error('❌ API Error in Cart Response:', data.errorMessages);
        return null;
      }
      payload = data.result || data;
    }

    // If the payload is an array, it's a list of items
    if (Array.isArray(payload)) {
      const cartItems = payload.map(item => this.mapCartItem(item));
      const subtotal = payload.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
      return {
        cartId: 0,
        userId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vendors: [],       // required by CartApi
        cartTotal: subtotal,
        cartItems,
        totalItems: payload.reduce((sum, item) => sum + (item.quantity || 1), 0),
        subtotal,
      };
    }

    // Handle the new structure with 'vendors'
    const vendors = Array.isArray(payload.vendors) ? payload.vendors : [];
    const flattenedItems: CartItemApi[] = [];

    const mappedVendors: CartVendorApi[] = vendors.map((v: any) => {
      const vendorItems = Array.isArray(v.items) ? v.items.map((item: any) => this.mapCartItem(item)) : [];
      flattenedItems.push(...vendorItems);
      return {
        vendorId: v.vendorId || '',
        vendorName: v.vendorName || 'Vendor',
        totalItems: v.totalItems || 0,
        subTotal: v.subTotal || 0,
        items: vendorItems
      };
    });

    return {
      cartId: payload.cartId || payload.id || 0,
      userId: payload.userId || payload.customerId || '',
      customerId: payload.customerId,
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: payload.updatedAt || null,
      vendors: mappedVendors,
      cartItems: flattenedItems,
      totalItems: payload.totalItems || flattenedItems.length,
      cartTotal: payload.cartTotal || payload.subtotal || payload.subTotal || 0,
      subtotal: payload.cartTotal || payload.subtotal || payload.subTotal || 0
    };
  }

  private mapCartItem(item: any): CartItemApi {
    const imageUrl =
      item.imageUrl
      || item.packageAvatarUrl
      || item.packageImageUrl
      || item.productImageUrl
      || item.avatarUrl
      || item.thumbnailUrl
      || item.image
      || item.package?.avatarUrl
      || item.package?.imageUrl
      || item.package?.image
      || item.package?.thumbnailUrl
      || item.product?.imageUrl
      || item.product?.avatarUrl
      || item.product?.thumbnailUrl
      || null;

    return {
      cartItemId: item.cartItemId || item.id || 0,
      cartId: item.cartId || 0,
      packageId: item.packageId || 0,
      variantId: item.variantId || 0,
      quantity: item.quantity || 0,
      price: item.price || 0,
      packageName: item.packageName || item.name || 'Sản phẩm',
      variantName: item.variantName || 'Mặc định',
      imageUrl,
      variantSubTotal: item.variantSubTotal || (item.price * item.quantity) || 0,
      swaps: Array.isArray(item.swaps) ? item.swaps.map((s: any) => ({
        cartItemSwapId: s.cartItemSwapId,
        swapId: s.swapId,
        originalItemName: s.originalItemName,
        replacementItemName: s.replacementItemName,
        surcharge: s.surcharge
      })) : [],
      swapSubTotal: item.swapSubTotal || 0,
      addOns: Array.isArray(item.addOns) ? item.addOns.map((a: any) => ({
        cartItemAddOnId: a.cartItemAddOnId,
        addOnId: a.addOnId,
        itemName: a.itemName,
        retailPrice: a.retailPrice,
        quantity: a.quantity,
        lineTotal: a.lineTotal
      })) : [],
      addOnSubTotal: item.addOnSubTotal || 0,
      lineTotal: item.lineTotal || (item.price * item.quantity) || 0
    };
  }

  /**
   * Lấy giỏ hàng của người dùng hiện tại
   * GET /api/cart
   */
  async getCart(): Promise<CartApi | null> {
    try {
      console.log('🛒 Fetching cart from API...');

      // OpenAPI: GET /api/cart only (no GET on /api/cart/items)
      const response = await fetch(`${API_BASE_URL}/cart`, {
        method: 'GET',
        headers: this.getHeaders('GET'),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`❌ Fetch Cart API Error (Status: ${response.status}):`, errorText);

        if (response.status === 404) return null;
        if (response.status === 500) {
          console.warn('💡 Tip: A 500 error on GET /api/cart might mean a backend bug or missing user profile data.');
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.extractCartData(data);
    } catch (error) {
      console.error('❌ Failed to fetch cart:', error);
      throw error;
    }
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  async addToCart(request: AddToCartRequest): Promise<boolean> {
    try {
      console.log('➕ Adding to cart:', request);

      // Backend OpenAPI: only POST /api/cart/add (GET is /api/cart; /api/cart/items is PUT/DELETE only).
      let response = await fetch(`${API_BASE_URL}/cart/add`, {
        method: 'POST',
        headers: this.getHeaders('POST'),
        body: JSON.stringify(request),
      });

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart`, {
          method: 'POST',
          headers: this.getHeaders('POST'),
          body: JSON.stringify(request),
        });
      }

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/items`, {
          method: 'POST',
          headers: this.getHeaders('POST'),
          body: JSON.stringify(request),
        });
      }

      if (!response.ok) {
        let errorData: any = {};
        const errorText = await response.text().catch(() => '');
        try {
          if (errorText) errorData = JSON.parse(errorText);
        } catch {
          // ignore parsing error
        }
        console.error(`❌ Add to Cart API Error (Status: ${response.status}):`, errorText);
        throw new Error(errorData?.errorMessages?.[0] || `Thêm vào giỏ hàng thất bại (Lỗi ${response.status})`);
      }

      const data = await response.json().catch(() => ({}));
      return !!(data.isSuccess || data.isSucceeded || data.statusCode === 'OK' || response.ok);
    } catch (error) {
      console.error('❌ Failed to add to cart:', error);
      throw error;
    }
  }

  /**
   * Cập nhật số lượng item (quantity only - server only supports this)
   */
  async updateCartItem(request: UpdateCartItemRequest): Promise<boolean> {
    try {

      const isFullUpdate = request.swaps !== undefined || request.addOns !== undefined;
      const payload = isFullUpdate
        ? {
          cartItemId: request.cartItemId,
          quantity: request.quantity,
          swaps: request.swaps ?? [],     // empty array when no swaps
          addOns: request.addOns ?? [],   // empty array when no add-ons
        }
        : { cartItemId: request.cartItemId, quantity: request.quantity };

      console.log('📝 Updating cart item (payload):', payload);

      let response = await fetch(`${API_BASE_URL}/cart/items`, {
        method: 'PUT',
        headers: this.getHeaders('PUT'),
        body: JSON.stringify(payload),
      });

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart`, {
          method: 'PUT',
          headers: this.getHeaders('PUT'),
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return !!(data.isSuccess || data.isSucceeded || data.statusCode === 'OK' || response.ok);
    } catch (error) {
      console.error('❌ Failed to update cart item:', error);
      throw error;
    }
  }

  /**
   * Xóa item khỏi giỏ hàng
   */
  async removeCartItem(cartItemId: number): Promise<boolean> {
    try {
      console.log('🗑️ Removing cart item:', cartItemId);

      // OpenAPI: DELETE /api/cart/items?itemId=
      let response = await fetch(`${API_BASE_URL}/cart/items?itemId=${encodeURIComponent(String(cartItemId))}`, {
        method: 'DELETE',
        headers: this.getHeaders('DELETE'),
      });

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/items/${cartItemId}`, {
          method: 'DELETE',
          headers: this.getHeaders('DELETE'),
        });
      }

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/${cartItemId}`, {
          method: 'DELETE',
          headers: this.getHeaders('DELETE'),
        });
      }

      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart?itemId=${encodeURIComponent(String(cartItemId))}`, {
          method: 'DELETE',
          headers: this.getHeaders('DELETE'),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      return !!(data.isSuccess || data.isSucceeded || data.statusCode === 'OK' || response.ok);
    } catch (error) {
      console.error('❌ Failed to remove cart item:', error);
      throw error;
    }
  }

  /**
   * Xóa toàn bộ giỏ hàng
   */
  async clearCart(): Promise<boolean> {
    try {
      console.log('🧹 Clearing cart...');

      // Try DELETE /api/cart/clear (based on Swagger)
      let response = await fetch(`${API_BASE_URL}/cart/clear`, {
        method: 'DELETE',
        headers: this.getHeaders('DELETE'),
      });

      // Try DELETE /api/cart/items/clear
      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/items/clear`, {
          method: 'DELETE',
          headers: this.getHeaders('DELETE'),
        });
      }

      // Try POST /api/cart/clear
      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/clear`, {
          method: 'POST',
          headers: this.getHeaders('POST'),
        });
      }

      // Try DELETE /api/cart/items
      if (response.status === 405 || response.status === 404) {
        response = await fetch(`${API_BASE_URL}/cart/items`, {
          method: 'DELETE',
          headers: this.getHeaders('DELETE'),
        });
      }

      return response.ok;
    } catch (error) {
      console.error('❌ Failed to clear cart:', error);
      return false;
    }
  }

  /**
   * Tính tổng giá trị giỏ hàng (dùng subtotal từ API)
   */
  calculateTotal(cart: CartApi | null): { subtotal: number; shipping: number; tax: number; total: number } {
    if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
      return { subtotal: 0, shipping: 0, tax: 0, total: 0 };
    }

    const subtotal = cart.subtotal || cart.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal > 0 ? 50000 : 0;
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + shipping + tax;

    return { subtotal, shipping, tax, total };
  }
}

// Export singleton instance
export const cartService = new CartService();
export default cartService;
