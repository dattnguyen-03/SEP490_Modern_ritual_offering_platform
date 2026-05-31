import { getAuthToken, getCurrentUser, fetchWithAuth } from './auth';
import { packageService } from './packageService';
const API_BASE_URL = '/api';

export interface OrderItemAddOn {
    orderItemAddOnId?: string;
    addOnId?: number;
    addOnName?: string;
    itemName?: string;
    retailPrice?: number;
    quantity: number;
    lineTotal?: number;
    isRefunded?: boolean;
}

export interface OrderItemSwap {
    orderItemSwapId?: string;
    swapId?: number | string;
    originalItemName?: string;
    replacementItemName?: string;
    replacementDescription?: string;
    addOnName?: string;
    surcharge?: number;
    isRefunded?: boolean;
}

export interface OrderItem {
    itemId: string;
    variantId?: string | number;
    variantName: string;
    variantSubTotal?: number;
    packageName: string;
    quantity: number;
    price: number;
    lineTotal: number;
    decorationNote?: string;
    packageId?: string | number;
    imageUrl?: string | null;
    isRequestRefund?: boolean;
    addOns?: OrderItemAddOn[];
    swaps?: OrderItemSwap[];
    addOnSubTotal?: number;
    swapSubTotal?: number;
    // Fields from API response
    totalAmount?: number;
    subTotal?: number;
    shippingFee?: number;
}

export interface Order {
    orderId: string;
    orderStatus: string;
    trackingLists: Array<{
        trackingId: string;
        title: string;
        status: string;
        description: string;
        createdAt: string;
    }>;
    customer: {
        profileId: string;
        customerId?: string;
        fullName: string;
        email: string;
        phoneNumber: string;
        avatarUrl?: string;
    };
    customerName?: string;
    customerAvatar?: string;
    customerPhone?: string;
    vendor: {
        profileId: string | null;
        shopName: string;
        email: string;
        phoneNumber: string;
        address: string;
        avatarUrl?: string | null;
    };
    delivery: {
        deliveryDate: string;
        deliveryTime: string;
        deliveryAddress: string;
        shippingDistanceKm: number;
        deliveryProofImageUrl?: string | null;
        deliveryProofImages?: string[] | null;
        preparationProofImages?: string[] | null;
    };
    items: OrderItem[];
    pricing: {
        totalQuantity?: number;
        subTotal: number;
        shippingFee: number;
        totalAmount: number;
        finalAmount?: number;
        discountAmount?: number;
        discountBreakdown?: unknown;
        commissionRate: number;
        platformFee: number;
        vendorNetAmount: number;
        holdFee?: number;
    };
    payment: {
        paymentMethod: string;
        paymentStatus: string;
        paidAt: string | null;
        transactionId: string | null;
        isPaidToVendor: boolean | null;
        paidToVendorDate: string | null;
    };
    vendorPricingDetails: {
        commissionRate: number;
        platformFee: number;
        vendorNetAmount: number;
        isPaidToVendor: boolean | null;
        paidToVendorDate: string | null;
        transactionId: string | null;
    };
    createdAt: string;
    updatedAt: string | null;
    cancelReason: string | null;
    refundAmount: number;
    confirmDeadline?: string | null;
    deliveredDeadline?: string;
    slaStatus?: string | null;
}

export interface VendorOrderItem {
    itemId: string;
    variantId: number | string;
    variantName: string;
    packageName: string;
    quantity: number;
    price: number;
    lineTotal: number;
    decorationNote?: string;
    imageUrl?: string;
    isRequestRefund?: boolean;
    addOns?: OrderItemAddOn[];
    swaps?: OrderItemSwap[];
}

export interface VendorOrder {
    orderId: string;
    orderStatus: string;
    customerProfileId: string;
    customerName: string;
    customerPhone?: string;
    vendorProfileId: string;
    vendorName: string;
    deliveryDate: string;
    deliveryTime: string;
    deliveryAddress: string;
    items: VendorOrderItem[];
    subTotal: number;
    shippingDistanceKm: number;
    shippingFee: number;
    totalAmount: number;
    finalAmount?: number;
    commissionRate: number;
    platformFee: number;
    vendorNetAmount: number;
    paymentMethod: string;
    createdAt: string;
    customerAvatar?: string;
    preparationProofImages?: string[];
    deliveredDeadline?: string;
}

export interface VendorOrderCalendarItem {
    date: string;
    totalOrders: number;
    totalRevenue: number;
    paidCount?: number;
    confirmedCount?: number;
    processingCount?: number;
    deliveringCount?: number;
    deliveredCount?: number;
    completedCount?: number;
    cancelledCount?: number;
    capacityStatus?: string | null;
    totalProductionWeight?: number;
    dailyCapacityWeight?: number;
    isClosed?: boolean;
    closeReason?: string | null;
}

export interface PreparationPlan {
    targetDate: string;
    totalPendingOrders: number;
    totalAllOrders?: number;
    totalAddOnsToPrepare: Array<{
        addOnName: string;
        totalQuantity: number;
    }>;
    variantsToPrepare: Array<{
        packageId: number;
        variantId: number;
        packageName: string;
        variantName: string;
        totalQuantityRequired: number;
        allocations: Array<{
            orderId: string;
            deliveryTime: string;
            allocatedQuantity: number;
            decorationNote: string;
            addOns: string[];
            swaps: string[];
        }>;
    }>;
    ordersByStatus?: Array<{
        orderId: string;
        customerName?: string;
        customerPhone?: string;
        deliveryTime?: string;
        finalAmount?: number;
        orderStatus?: string;
        orderStatusLabel?: string;
        totalItems?: number;
        hasRefund?: boolean;
    }>;
}

interface VendorOrdersApiItem {
    orderId?: string;
    orderStatus?: string;
    vendorId?: string;
    shopName?: string;
    customerProfileId?: string;
    CustomerProfileId?: string;
    customerName?: string;
    CustomerName?: string;
    customerId?: string;
    CustomerId?: string;
    customerPhone?: string;
    CustomerPhone?: string;
    customer?: {
        profileId?: string;
        customerId?: string;
        fullName?: string;
        customerName?: string;
        phoneNumber?: string;
        customerPhone?: string;
    };
    deliveryDate?: string;
    deliveryTime?: string;
    deliveryAddress?: string;
    createdAt?: string;
    finalAmount?: number;
    subTotal?: number;
    shippingFee?: number;
    shippingDistanceKm?: number;
    commissionRate?: number;
    platformFee?: number;
    vendorNetAmount?: number;
    paymentMethod?: string;
    items?: Array<{
        itemId?: string;
        variantId?: number | string;
        variantName?: string;
        packageName?: string;
        quantity?: number;
        unitPrice?: number;
        price?: number;
        lineTotal?: number;
        decorationNote?: string;
        packageId?: string | number;
        productId?: string | number;
        imageUrl?: string | null;
        isRequestRefund?: boolean;
    }>;
    preparationProofImages?: string[];
    deliveredDeadline?: string;
}

interface OrderDetailsApiItem {
    orderId?: string;
    orderStatus?: string;
    trackingLists?: Array<{
        trackingId?: string;
        title?: string;
        status?: string;
        description?: string;
        createdAt?: string;
    }>;
    customer?: {
        profileId?: string;
        customerId?: string;
        fullName?: string;
        customerName?: string;
        email?: string;
        phoneNumber?: string;
        customerPhone?: string;
        avatarUrl?: string;
    };
    vendor?: {
        profileId?: string;
        vendorId?: string;
        shopName?: string;
        email?: string;
        phoneNumber?: string;
        address?: string;
        avatarUrl?: string;
        shopAvatarUrl?: string;
    };
    delivery?: {
        deliveryDate?: string;
        deliveryTime?: string;
        deliveryAddress?: string;
        shippingDistanceKm?: number;
        deliveryProofImageUrl?: string | string[] | null;
        imageUrl?: string | null;
        deliveryProofImages?: string[] | null;
        preparationProofImages?: string[] | null;
    };
    items?: Array<{
        itemId?: string;
        variantId?: number | string;
        variantName?: string;
        packageName?: string;
        quantity?: number;
        unitPrice?: number;
        price?: number;
        lineTotal?: number;
        decorationNote?: string;
        packageId?: string | number;
        productId?: string | number;
        imageUrl?: string | null;
        isRequestRefund?: boolean;
    }>;
    pricing?: {
        totalQuantity?: number;
        subTotal?: number;
        shippingFee?: number;
        totalAmount?: number;
        finalAmount?: number;
        discountAmount?: number;
        discountBreakdown?: unknown;
        commissionRate?: number;
        platformFee?: number;
        vendorNetAmount?: number;
    };
    payment?: {
        paymentMethod?: string;
        paymentStatus?: string;
        paidAt?: string | null;
        transactionId?: string | null;
        isPaidToVendor?: boolean;
        paidToVendorDate?: string | null;
    };
    vendorPricingDetails?: {
        commissionRate?: number;
        platformFee?: number;
        vendorNetAmount?: number;
        isPaidToVendor?: boolean;
        paidToVendorDate?: string | null;
        transactionId?: string | null;
    };
    createdAt?: string;
    updatedAt?: string | null;
    cancelReason?: string | null;
    refundAmount?: number;
    confirmDeadline?: string | null;
    slaStatus?: string | null;
    // Flat fields commonly seen in API responses
    customerProfileId?: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    vendorId?: string;
    shopName?: string;
    vendorName?: string;
    vendorEmail?: string;
    vendorPhone?: string;
    vendorAddress?: string;
    deliveryDate?: string;
    deliveryTime?: string;
    deliveryAddress?: string;
    shippingDistanceKm?: number;
    vendorAvatarUrl?: string;
    shopAvatarUrl?: string;
    deliveredDeadline?: string;
}

class OrderService {
    private normalizeCommissionRate(value: unknown): number {
        const raw = Number(value);
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        return raw > 1 ? raw / 100 : raw;
    }

    private derivePaymentStatus(raw: OrderDetailsApiItem): string {
        const explicitStatus = String(raw.payment?.paymentStatus || '').trim();
        if (explicitStatus) return explicitStatus;

        const paidByOrderStatus = ['Paid', 'Delivering', 'Completed', 'Delivered', 'Refunded']
            .includes(String(raw.orderStatus || ''));

        const paidByTracking = Array.isArray(raw.trackingLists)
            && raw.trackingLists.some((item) => String(item?.status || '').toLowerCase() === 'paid');

        if (paidByOrderStatus || paidByTracking || raw.payment?.paidAt) {
            return 'Paid';
        }

        return 'Pending';
    }

    private getHeaders(method: string = 'GET'): HeadersInit {
        const headers: Record<string, string> = {
            'Accept': '*/*',
        };

        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }

    // Get all orders for the current customer
    async getMyOrders(): Promise<Order[]> {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders/customer`, {
                method: 'GET',
                headers: this.getHeaders('GET'),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(`Fetch My Orders API Error (Status: ${response.status}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const isSuccess = data.isSuccess || data.statusCode === 'OK';
            if (isSuccess && data.result) {
                const payload = data.result;
                const rawItems = Array.isArray(payload) ? payload : (payload.items || []);

                const orders: Order[] = rawItems.map((raw: any) => {
                    const items: OrderItem[] = Array.isArray(raw.items)
                        ? raw.items.map((item: any) => {
                            const quantity = Number(item.quantity) || 0;
                            const unitPrice = Number(item.unitPrice ?? item.price) || 0;
                            
                            const addOnsTotal = Array.isArray(item.addOns) 
                                ? item.addOns.reduce((sum: number, ao: any) => sum + (Number(ao.lineTotal) || (Number(ao.retailPrice) * Number(ao.quantity)) || 0), 0)
                                : 0;
                            const swapsSurcharge = Array.isArray(item.swaps)
                                ? item.swaps.reduce((sum: number, sw: any) => sum + (Number(sw.surcharge) || 0), 0)
                                : 0;
                            
                            const calculatedLineTotal = (unitPrice * quantity) + addOnsTotal + swapsSurcharge;
                            const lineTotal = Number(item.lineTotal) > 0 ? Number(item.lineTotal) : calculatedLineTotal;
                            return {
                                itemId: item.itemId || item.orderItemId || item.id || `item-${Math.random().toString(36).slice(2, 10)}`,
                                variantId: item.variantId ?? '',
                                variantName: item.variantName || 'N/A',
                                packageName: item.packageName || 'N/A',
                                quantity,
                                price: unitPrice || (quantity > 0 ? lineTotal / quantity : 0),
                                lineTotal,
                                decorationNote: item.decorationNote || '',
                                packageId:
                                    item.packageId ||
                                    (item as any).PackageId ||
                                    (item as any).package?.packageId ||
                                    (item as any).package?.id ||
                                    (item as any).productId ||
                                    (item as any).ProductId ||
                                    (item as any).package_id ||
                                    (item as any).product_id || '',
                                imageUrl:
                                    item.imageUrl ||
                                    item.imageURL ||
                                    item.packageAvatarUrl ||
                                    item.packageAvatar ||
                                    item.avatarUrl ||
                                    item.packageImageUrl ||
                                    item.packageImageURL ||
                                    item.productImageUrl ||
                                    item.productImageURL ||
                                    null,
                                isRequestRefund: !!item.isRequestRefund,
                                addOns: Array.isArray(item.addOns) ? item.addOns.map((ao: any) => ({
                                    ...ao,
                                    addOnName: ao.addOnName || ao.itemName
                                })) : [],
                                swaps: Array.isArray(item.swaps) ? item.swaps.map((sw: any) => ({
                                    ...sw,
                                    orderItemSwapId: sw.orderItemSwapId || sw.id
                                })) : [],
                            };
                        })
                        : [];

                    return {
                        ...raw,
                        orderId: raw.orderId || '',
                        orderStatus: raw.orderStatus || 'Pending',
                        items,
                        customer: raw.customer || {
                            profileId: raw.customerProfileId || raw.customerId || '',
                            fullName: raw.customerName || 'Khách hàng',
                            phoneNumber: raw.customerPhone || '',
                            email: raw.customerEmail || '',
                        },
                        vendor: raw.vendor ? {
                            profileId: raw.vendor.profileId || raw.vendorId || '',
                            shopName: raw.vendor.shopName || raw.shopName || raw.vendorName || 'Tiệm Cúng Bái',
                            phoneNumber: raw.vendor.phoneNumber || raw.vendorPhone || '',
                            address: raw.vendor.address || raw.vendorAddress || '',
                            avatarUrl: raw.vendor.avatarUrl || raw.vendor.shopAvatarUrl || raw.vendorAvatarUrl || raw.shopAvatarUrl || null,
                        } : {
                            profileId: raw.vendorId || '',
                            shopName: raw.shopName || raw.vendorName || 'Tiệm Cúng Bái',
                            phoneNumber: raw.vendorPhone || '',
                            address: raw.vendorAddress || '',
                            avatarUrl: raw.vendorAvatarUrl || raw.shopAvatarUrl || null,
                        },
                        delivery: raw.delivery || {
                            deliveryDate: raw.deliveryDate || '',
                            deliveryTime: raw.deliveryTime || '',
                            deliveryAddress: raw.deliveryAddress || 'N/A',
                            shippingDistanceKm: Number(raw.shippingDistanceKm) || 0,
                        },
                        pricing: {
                            subTotal: Number(raw.pricing?.subTotal || raw.subTotal) || items.reduce((sum, item) => sum + item.lineTotal, 0),
                            shippingFee: Number(raw.pricing?.shippingFee || raw.shippingFee) || 0,
                            totalAmount: Number(raw.pricing?.totalAmount || raw.pricing?.finalAmount || raw.totalAmount || raw.finalAmount) || 0,
                            finalAmount: Number(raw.pricing?.finalAmount || raw.pricing?.totalAmount || raw.finalAmount || raw.totalAmount) || 0,
                        },
                        createdAt: raw.createdAt || new Date().toISOString(),
                    } as Order;
                });

                // Map images from packages if missing (backend often omits images in order history)
                try {
                    const allItems = orders.flatMap(o => o.items);
                    const itemsMissingImage = allItems.filter(it => !it.imageUrl);
                    if (itemsMissingImage.length > 0) {
                        const packages = await packageService.getAllPackages(1, 100);
                        const packageImageMap = new Map<string, string>();

                        packages.forEach(pkg => {
                            const pid = String(pkg.packageId || (pkg as any).id || (pkg as any).PackageId);
                            const img = pkg.packageAvatarUrl || (pkg as any).imageUrl || (pkg as any).avatarUrl || (pkg as any).packageImage;
                            if (pid && img) packageImageMap.set(pid, img);
                        });

                        orders.forEach(o => {
                            o.items.forEach(it => {
                                if (!it.imageUrl && it.packageId) {
                                    it.imageUrl = packageImageMap.get(String(it.packageId)) || null;
                                }
                            });
                        });
                    }
                } catch (err) {
                    console.warn("Failed to map package images for My Orders:", err);
                }

                return orders;
            }
            return [];
        } catch (error) {
            console.error("Failed to fetch My Orders:", error);
            throw error;
        }
    }

    // Get details for a specific order
    async getOrderDetails(orderId: string): Promise<Order | null> {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders/customer/${orderId}`, {
                method: 'GET',
                headers: this.getHeaders('GET'),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(`Order Detail API Error (ID: ${orderId}, Status: ${response.status}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.isSuccess && data.result) {
                const raw: OrderDetailsApiItem = data.result;
                console.log('🔍 [OrderDetail] raw.vendor:', raw.vendor);
                console.log('🔍 [OrderDetail] raw.vendorId:', (raw as any).vendorId, '| raw.vendorProfileId:', (raw as any).vendorProfileId, '| raw.shopAvatarUrl:', (raw as any).shopAvatarUrl);

                const items: OrderItem[] = Array.isArray(raw.items)
                    ? raw.items.map((item) => {
                        console.log('🔍 Raw Order Item from API:', item);
                        const quantity = Number(item.quantity) || 0;
                        const lineTotal = Number(item.lineTotal) || 0;
                        const unitPrice = Number(item.unitPrice ?? item.price) || (quantity > 0 ? lineTotal / quantity : 0);

                        return {
                            itemId: item.itemId || (item as any).orderItemId || (item as any).id || `item-${Math.random().toString(36).slice(2, 10)}`,
                            variantId: item.variantId ?? '',
                            variantName: item.variantName || 'N/A',
                            variantSubTotal: Number((item as any).variantSubTotal) || 0,
                            packageName: item.packageName || 'N/A',
                            quantity,
                            price: unitPrice,
                            lineTotal,
                            decorationNote: item.decorationNote || '',
                            packageId:
                                item.packageId ||
                                (item as any).PackageId ||
                                (item as any).package?.packageId ||
                                (item as any).package?.id ||
                                (item as any).packageID ||
                                (item as any).productId ||
                                (item as any).ProductId ||
                                (item as any).productID ||
                                (item as any).package_id ||
                                (item as any).product_id || '',
                            imageUrl:
                                item.imageUrl ||
                                (item as any).imageURL ||
                                (item as any).packageAvatarUrl ||
                                (item as any).packageAvatar ||
                                (item as any).avatarUrl ||
                                (item as any).packageImageUrl ||
                                (item as any).packageImageURL ||
                                (item as any).productImageUrl ||
                                (item as any).productImageURL ||
                                null,
                            isRequestRefund: !!item.isRequestRefund,
                            // Preserve add-ons and swaps from backend
                            addOns: Array.isArray((item as any).addOns) ? (item as any).addOns.map((ao: any) => ({
                                ...ao,
                                addOnName: ao.addOnName || ao.itemName
                            })) : [],
                            swaps: Array.isArray((item as any).swaps) ? (item as any).swaps.map((sw: any) => ({
                                ...sw,
                                orderItemSwapId: sw.orderItemSwapId || sw.id
                            })) : [],
                            addOnSubTotal: Number((item as any).addOnSubTotal) || 0,
                            swapSubTotal: Number((item as any).swapSubTotal) || 0,
                        };
                    })
                    : [];

                const subTotal = Number(raw.pricing?.subTotal) || items.reduce((sum, item) => sum + item.lineTotal, 0);
                const shippingFee = Number(raw.pricing?.shippingFee) || 0;
                const totalAmount = Number(raw.pricing?.totalAmount ?? raw.pricing?.finalAmount) || (subTotal + shippingFee);
                const commissionRate = this.normalizeCommissionRate(
                    raw.vendorPricingDetails?.commissionRate ?? raw.pricing?.commissionRate,
                );
                const platformFee = Number(raw.vendorPricingDetails?.platformFee ?? raw.pricing?.platformFee) || (subTotal * commissionRate);
                const vendorNetAmount = Number(raw.vendorPricingDetails?.vendorNetAmount ?? raw.pricing?.vendorNetAmount) || Math.max(subTotal - platformFee, 0);

                const rawDeliveryProof = (
                    raw.delivery?.deliveryProofImageUrl
                    || raw.delivery?.imageUrl
                    || (raw as any).deliveryProofImageUrl
                    || (raw as any).imageUrl
                    || null
                );

                let deliveryProofImageUrl: string | null = null;
                let deliveryProofImages: string[] | null = null;

                if (Array.isArray(rawDeliveryProof)) {
                    const cleaned = (rawDeliveryProof as unknown[])
                        .filter((url) => typeof url === 'string' && (url as string).trim()) as string[];
                    deliveryProofImages = cleaned.length ? cleaned : null;
                    deliveryProofImageUrl = cleaned[0] || null;
                } else if (typeof rawDeliveryProof === 'string' && rawDeliveryProof.trim()) {
                    deliveryProofImageUrl = rawDeliveryProof;
                    deliveryProofImages = [rawDeliveryProof];
                }

                const rawPreparationProof = (
                    raw.delivery?.preparationProofImages
                    || (raw.delivery as any)?.preparationProofImageUrl
                    || (raw as any).preparationProofImages
                    || (raw as any).preparationProofImageUrl
                    || null
                );

                const preparationProofImages = Array.isArray(rawPreparationProof)
                    ? (rawPreparationProof as unknown[])
                        .filter((url) => typeof url === 'string' && (url as string).trim()) as string[]
                    : typeof rawPreparationProof === 'string' && rawPreparationProof.trim()
                        ? [rawPreparationProof]
                        : null;

                const trackingLists = Array.isArray(raw.trackingLists)
                    ? raw.trackingLists.map((item, index) => ({
                        trackingId: String((item as any)?.trackingId || `tracking-${index}`),
                        title: String(item?.title || 'Cập nhật đơn hàng'),
                        status: String(item?.status || ''),
                        description: String(item?.description || ''),
                        createdAt: String(item?.createdAt || ''),
                    }))
                    : [];

                const customerName =
                    raw.customerName
                    || (raw as any).CustomerName
                    || raw.customer?.fullName
                    || (raw.customer as any)?.customerName
                    || 'Khách hàng';

                const customerPhone =
                    raw.customerPhone
                    || (raw as any).CustomerPhone
                    || raw.customer?.phoneNumber
                    || (raw.customer as any)?.customerPhone
                    || '';

                const customerEmail =
                    raw.customerEmail
                    || (raw as any).CustomerEmail
                    || raw.customer?.email
                    || (raw.customer as any)?.customerEmail
                    || '';

                const order: Order = {
                    orderId: raw.orderId || orderId,
                    orderStatus: raw.orderStatus || 'Pending',
                    trackingLists,
                    customer: {
                        profileId: raw.customer?.profileId || raw.customerProfileId || raw.customerId || '',
                        customerId: raw.customer?.customerId || raw.customerProfileId || raw.customerId || '',
                        fullName: customerName,
                        email: customerEmail,
                        phoneNumber: customerPhone,
                        avatarUrl: raw.customer?.avatarUrl || (raw as any).customerAvatar || '',
                    },
                    customerName,
                    customerPhone,
                    customerAvatar: raw.customer?.avatarUrl || (raw as any).customerAvatar || '',
                    vendor: raw.vendor ? {
                        profileId: raw.vendor.profileId || raw.vendorId || null,
                        shopName: raw.vendor.shopName || raw.shopName || raw.vendorName || 'Cúng Bái Tâm Linh',
                        email: raw.vendor.email || raw.vendorEmail || '',
                        phoneNumber: raw.vendor.phoneNumber || raw.vendorPhone || '',
                        address: raw.vendor.address || raw.vendorAddress || '',
                        avatarUrl: raw.vendor.avatarUrl || raw.vendor.shopAvatarUrl || raw.vendorAvatarUrl || raw.shopAvatarUrl || null,
                    } : {
                        profileId: raw.vendorId || null,
                        shopName: raw.shopName || raw.vendorName || 'Cúng Bái Tâm Linh',
                        email: raw.vendorEmail || '',
                        phoneNumber: raw.vendorPhone || '',
                        address: raw.vendorAddress || '',
                        avatarUrl: raw.vendorAvatarUrl || raw.shopAvatarUrl || null,
                    },
                    delivery: {
                        deliveryDate: raw.delivery?.deliveryDate || raw.deliveryDate || '',
                        deliveryTime: raw.delivery?.deliveryTime || raw.deliveryTime || '',
                        deliveryAddress: raw.delivery?.deliveryAddress || raw.deliveryAddress || 'N/A',
                        shippingDistanceKm: Number(raw.delivery?.shippingDistanceKm || raw.shippingDistanceKm) || 0,
                        deliveryProofImageUrl,
                        deliveryProofImages,
                        preparationProofImages,
                    },
                    items,
                    pricing: {
                        totalQuantity: Number(raw.pricing?.totalQuantity) || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
                        subTotal,
                        shippingFee,
                        totalAmount,
                        finalAmount: Number(raw.pricing?.finalAmount) || totalAmount,
                        discountAmount: Number(raw.pricing?.discountAmount) || 0,
                        discountBreakdown: raw.pricing?.discountBreakdown ?? null,
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                        holdFee: Number((raw.pricing as any)?.holdFee ?? (raw as any)?.holdFee) || 0,
                    },
                    payment: {
                        paymentMethod: raw.payment?.paymentMethod || 'N/A',
                        paymentStatus: this.derivePaymentStatus(raw),
                        paidAt: raw.payment?.paidAt || null,
                        transactionId: (
                            raw.payment?.transactionId
                            || raw.vendorPricingDetails?.transactionId
                            || null
                        ),
                        isPaidToVendor: typeof raw.vendorPricingDetails?.isPaidToVendor === 'boolean'
                            ? raw.vendorPricingDetails.isPaidToVendor
                            : null,
                        paidToVendorDate: raw.vendorPricingDetails?.paidToVendorDate || null,
                    },
                    vendorPricingDetails: {
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                        isPaidToVendor: typeof raw.vendorPricingDetails?.isPaidToVendor === 'boolean'
                            ? raw.vendorPricingDetails.isPaidToVendor
                            : null,
                        paidToVendorDate: raw.vendorPricingDetails?.paidToVendorDate || null,
                        transactionId: raw.vendorPricingDetails?.transactionId || raw.payment?.transactionId || null,
                    },
                    createdAt: raw.createdAt || new Date().toISOString(),
                    updatedAt: raw.updatedAt || null,
                    cancelReason: raw.cancelReason || null,
                    refundAmount: Number(raw.refundAmount) || 0,
                    deliveredDeadline: raw.deliveredDeadline,
                };

                // Map images from packages for individual order detail
                try {
                    const missingImages = order.items.filter(it => !it.imageUrl);
                    if (missingImages.length > 0) {
                        const packageIds = [...new Set(missingImages.map(it => it.packageId).filter(pid => pid))];
                        for (const pid of packageIds) {
                            const pkg = await packageService.getPackageById(String(pid));
                            if (pkg) {
                                const img = pkg.packageAvatarUrl || (pkg as any).imageUrl || (pkg as any).avatarUrl;
                                if (img) {
                                    order.items.forEach(it => {
                                        if (String(it.packageId) === String(pid) && !it.imageUrl) {
                                            it.imageUrl = img;
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Failed to map package images for Order Detail:", err);
                }

                return order;
            }
            return null;
        } catch (error) {
            console.error("Failed to get Order Details:", error);
            throw error;
        }
    }

    // Get all orders for the current vendor
    async getVendorOrders(pageNumber: number = 1, pageSize: number = 100): Promise<VendorOrder[]> {
        try {
            const url = `${API_BASE_URL}/orders/vendor?PageNumber=${pageNumber}&PageSize=${pageSize}`;
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const isSuccess = data?.isSuccess || data?.isSucceeded || data?.statusCode === 'OK';
            if (isSuccess && data?.result) {
                const payload = data.result;
                const rawItems = Array.isArray(payload) ? payload : (payload.items || []);

                const mappedOrders: VendorOrder[] = rawItems.map((raw: VendorOrdersApiItem) => {
                    const items = Array.isArray(raw.items)
                        ? raw.items.map((item) => {
                            const quantity = Number(item.quantity) || 0;
                            const unitPrice = Number(item.unitPrice ?? item.price) || 0;
                            const lineTotal = Number(item.lineTotal) || (unitPrice * quantity);

                            return {
                                itemId: item.itemId || `item-${Math.random().toString(36).slice(2, 10)}`,
                                variantId: item.variantId ?? '',
                                variantName: item.variantName || 'N/A',
                                packageName: item.packageName || 'N/A',
                                quantity,
                                price: unitPrice,
                                lineTotal,
                                decorationNote: item.decorationNote || '',
                                imageUrl: item.imageUrl || (item as any).packageAvatarUrl || (item as any).packageImageUrl || (item as any).productImageUrl || '',
                                isRequestRefund: !!item.isRequestRefund,
                            };
                        })
                        : [];

                    const subTotal = Number(raw.subTotal) || items.reduce((sum, item) => sum + item.lineTotal, 0);
                    const shippingFee = Number(raw.shippingFee) || 0;
                    const finalAmountFromApi = Number(raw.finalAmount);
                    const totalAmount = Number.isFinite(finalAmountFromApi) ? finalAmountFromApi : (subTotal + shippingFee);

                    const commissionRate = this.normalizeCommissionRate(raw.commissionRate);
                    const platformFee = Number(raw.platformFee) || (totalAmount * commissionRate);
                    const vendorNetAmount = Number(raw.vendorNetAmount) || (totalAmount - platformFee);

                    return {
                        orderId: raw.orderId || '',
                        orderStatus: raw.orderStatus || 'Pending',
                        customerProfileId: raw.customerProfileId || raw.CustomerProfileId || raw.customer?.profileId || raw.customer?.customerId || raw.customerId || '',
                        customerName: raw.customerName || raw.CustomerName || raw.customer?.fullName || raw.customer?.customerName || 'N/A',
                        customerPhone: raw.customerPhone || raw.CustomerPhone || raw.customer?.phoneNumber || raw.customer?.customerPhone || '',
                        vendorProfileId: raw.vendorId || '',
                        vendorName: raw.shopName || 'Shop',
                        deliveryDate: raw.deliveryDate || '',
                        deliveryTime: raw.deliveryTime || '',
                        deliveryAddress: raw.deliveryAddress || 'N/A',
                        items,
                        subTotal,
                        shippingDistanceKm: Number(raw.shippingDistanceKm) || 0,
                        shippingFee,
                        totalAmount,
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                        paymentMethod: raw.paymentMethod || 'N/A',
                        createdAt: raw.createdAt || raw.deliveryDate || new Date().toISOString(),
                        customerAvatar: (raw.customer as any)?.avatarUrl || (raw as any).customerAvatar || '',
                        preparationProofImages: raw.preparationProofImages || [],
                        finalAmount: totalAmount,
                        deliveredDeadline: raw.deliveredDeadline,
                    };
                });

                return mappedOrders;
            }
            return [];
        } catch (error) {
            console.error("Failed to fetch Vendor Orders:", error);
            throw error;
        }
    }

    // Get all vendor orders for admin views
    async getAllVendorOrders(pageNumber: number = 1, pageSize: number = 100): Promise<VendorOrder[]> {
        try {
            const url = `${API_BASE_URL}/orders/all-vendor?PageNumber=${pageNumber}&PageSize=${pageSize}`;
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const isSuccess = data?.isSuccess || data?.isSucceeded || data?.statusCode === 'OK';
            if (isSuccess && data?.result) {
                const payload = data.result;
                const rawItems = Array.isArray(payload) ? payload : (payload.items || []);

                return rawItems.map((raw: VendorOrdersApiItem) => {
                    const items = Array.isArray(raw.items)
                        ? raw.items.map((item) => {
                            const quantity = Number(item.quantity) || 0;
                            const unitPrice = Number(item.unitPrice ?? item.price) || 0;
                            const lineTotal = Number(item.lineTotal) || (unitPrice * quantity);

                            return {
                                itemId: item.itemId || `item-${Math.random().toString(36).slice(2, 10)}`,
                                variantId: item.variantId ?? '',
                                variantName: item.variantName || 'N/A',
                                packageName: item.packageName || 'N/A',
                                quantity,
                                price: unitPrice,
                                lineTotal,
                                decorationNote: item.decorationNote || '',
                                imageUrl: item.imageUrl || (item as any).packageAvatarUrl || (item as any).packageImageUrl || (item as any).productImageUrl || '',
                                isRequestRefund: !!item.isRequestRefund,
                            };
                        })
                        : [];

                    const subTotal = Number(raw.subTotal) || items.reduce((sum, item) => sum + item.lineTotal, 0);
                    const shippingFee = Number(raw.shippingFee) || 0;
                    const finalAmountFromApi = Number(raw.finalAmount);
                    const totalAmount = Number.isFinite(finalAmountFromApi) ? finalAmountFromApi : (subTotal + shippingFee);

                    const commissionRate = this.normalizeCommissionRate(raw.commissionRate);
                    const platformFee = Number(raw.platformFee) || (totalAmount * commissionRate);
                    const vendorNetAmount = Number(raw.vendorNetAmount) || (totalAmount - platformFee);

                    return {
                        orderId: raw.orderId || '',
                        orderStatus: raw.orderStatus || 'Pending',
                        customerProfileId: raw.customerProfileId || raw.CustomerProfileId || raw.customer?.profileId || raw.customer?.customerId || raw.customerId || '',
                        customerName: raw.customerName || raw.CustomerName || raw.customer?.fullName || raw.customer?.customerName || 'N/A',
                        customerPhone: raw.customerPhone || raw.CustomerPhone || raw.customer?.phoneNumber || raw.customer?.customerPhone || '',
                        vendorProfileId: raw.vendorId || '',
                        vendorName: raw.shopName || 'Shop',
                        deliveryDate: raw.deliveryDate || '',
                        deliveryTime: raw.deliveryTime || '',
                        deliveryAddress: raw.deliveryAddress || 'N/A',
                        items,
                        subTotal,
                        shippingDistanceKm: Number(raw.shippingDistanceKm) || 0,
                        shippingFee,
                        totalAmount,
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                        paymentMethod: raw.paymentMethod || 'N/A',
                        createdAt: raw.createdAt || new Date().toISOString(),
                        customerAvatar: (raw.customer as any)?.avatarUrl || (raw as any).customerAvatar || '',
                        preparationProofImages: raw.preparationProofImages || [],
                        finalAmount: totalAmount,
                        deliveredDeadline: raw.deliveredDeadline,
                    };
                });
            }
            return [];
        } catch (error) {
            console.error("Failed to fetch All Vendor Orders:", error);
            throw error;
        }
    }

    // Get calendar orders for the current vendor
    async getVendorOrderCalendar(year: number, month: number): Promise<VendorOrderCalendarItem[]> {
        try {
            const url = `${API_BASE_URL}/orders/vendor/calendar?year=${year}&month=${month}`;
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: this.getHeaders('GET'),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(`Vendor Order Calendar API Error (Status: ${response.status}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const isSuccess = data?.isSuccess || data?.isSucceeded || data?.statusCode === 'OK';
            const payload = isSuccess ? (data?.result ?? data?.data ?? data) : data;
            const rawDays = Array.isArray(payload?.days) ? payload.days : (Array.isArray(payload) ? payload : []);

            return rawDays
                .map((day: any) => ({
                    date: String(day.date || '').slice(0, 10),
                    totalOrders: Number(day.totalOrders) || 0,
                    totalRevenue: Number(day.totalRevenue) || 0,
                    paidCount: Number(day.paidCount) || 0,
                    confirmedCount: Number(day.confirmedCount) || 0,
                    processingCount: Number(day.processingCount) || 0,
                    deliveringCount: Number(day.deliveringCount) || 0,
                    deliveredCount: Number(day.deliveredCount) || 0,
                    completedCount: Number(day.completedCount) || 0,
                    cancelledCount: Number(day.cancelledCount) || 0,
                    capacityStatus: day.capacityStatus ?? null,
                    totalProductionWeight: Number(day.totalProductionWeight) || 0,
                    dailyCapacityWeight: Number(day.dailyCapacityWeight) || 0,
                    isClosed: !!day.isClosed,
                    closeReason: day.closeReason ?? null,
                }))
                .filter((item: { date: string }) => item.date);
        } catch (error) {
            console.error('Failed to fetch Vendor Order Calendar:', error);
            throw error;
        }
    }

    // Get details for a specific order as a vendor
    async getVendorOrderDetails(orderId: string): Promise<Order | null> {
        try {
            const url = `${API_BASE_URL}/orders/vendor/${orderId}`;
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: this.getHeaders('GET'),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(`Vendor Order Detail API Error (ID: ${orderId}, Status: ${response.status}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const isSuccess = data?.isSuccess || data?.isSucceeded || data?.statusCode === 'OK';

            if (isSuccess && data.result) {
                const raw = data.result;
                
                // Map items with support for add-ons and swaps
                const items: OrderItem[] = Array.isArray(raw.items)
                    ? raw.items.map((item: any) => {
                        const quantity = Number(item.quantity) || 0;
                        const lineTotal = Number(item.lineTotal) || 0;
                        const unitPrice = Number(item.unitPrice ?? item.price) || (quantity > 0 ? lineTotal / quantity : 0);

                        return {
                            itemId: item.itemId || item.id || `item-${Math.random().toString(36).slice(2, 10)}`,
                            variantId: item.variantId ?? '',
                            variantName: item.variantName || 'N/A',
                            variantSubTotal: Number(item.variantSubTotal) || 0,
                            packageName: item.packageName || 'N/A',
                            quantity,
                            price: unitPrice,
                            lineTotal,
                            decorationNote: item.decorationNote || '',
                            packageId: item.packageId || item.productId || '',
                            imageUrl: item.imageUrl || null,
                            isRequestRefund: !!item.isRequestRefund,
                            addOns: Array.isArray(item.addOns) ? (item.addOns as any[]).map((ao: any) => ({
                                ...ao,
                                addOnName: ao.addOnName || ao.itemName
                            })) : [],
                            swaps: Array.isArray(item.swaps) ? (item.swaps as any[]).map((sw: any) => ({
                                ...sw,
                                orderItemSwapId: sw.orderItemSwapId || sw.id
                            })) : [],
                            addOnSubTotal: Number(item.addOnSubTotal) || 0,
                            swapSubTotal: Number(item.swapSubTotal) || 0,
                        };
                    })
                    : [];

                // Normalizing pricing data
                const subTotal = Number(raw.pricing?.subTotal) || items.reduce((sum, item) => sum + item.lineTotal, 0);
                const shippingFee = Number(raw.pricing?.shippingFee) || 0;
                const totalAmount = Number(raw.pricing?.finalAmount ?? raw.pricing?.totalAmount) || (subTotal + shippingFee);
                
                const vendorPricing = raw.vendorPricingDetails || {};
                const commissionRate = this.normalizeCommissionRate(vendorPricing.commissionRate);
                const platformFee = Number(vendorPricing.platformFee) || (subTotal * commissionRate);
                const vendorNetAmount = Number(vendorPricing.vendorNetAmount) || (totalAmount - platformFee);

                const order: Order = {
                    orderId: raw.orderId || orderId,
                    orderStatus: raw.orderStatus || 'Pending',
                    trackingLists: Array.isArray(raw.trackingLists) ? raw.trackingLists : [],
                    customer: {
                        profileId: raw.customer?.customerId || raw.customer?.profileId || '',
                        fullName: raw.customer?.customerName || raw.customer?.fullName || 'Khách hàng',
                        email: raw.customer?.email || '',
                        phoneNumber: raw.customer?.customerPhone || raw.customer?.phoneNumber || '',
                        avatarUrl: raw.customer?.avatarUrl || null,
                    },
                    customerName: raw.customer?.customerName || raw.customer?.fullName || 'Khách hàng',
                    customerPhone: raw.customer?.customerPhone || raw.customer?.phoneNumber || '',
                    vendor: {
                        profileId: raw.vendor?.profileId || null,
                        shopName: raw.vendor?.shopName || 'Shop',
                        email: raw.vendor?.email || '',
                        phoneNumber: raw.vendor?.phoneNumber || '',
                        address: raw.vendor?.address || '',
                    },
                    delivery: {
                        deliveryDate: raw.delivery?.deliveryDate || '',
                        deliveryTime: raw.delivery?.deliveryTime || '',
                        deliveryAddress: raw.delivery?.deliveryAddress || 'N/A',
                        shippingDistanceKm: Number(raw.delivery?.shippingDistanceKm) || 0,
                        deliveryProofImageUrl: Array.isArray(raw.delivery?.deliveryProofImageUrl) ? raw.delivery.deliveryProofImageUrl[0] : raw.delivery?.deliveryProofImageUrl,
                        preparationProofImages: Array.isArray(raw.delivery?.preparationProofImageUrl) ? raw.delivery.preparationProofImageUrl : [],
                    },
                    items,
                    pricing: {
                        subTotal,
                        shippingFee,
                        totalAmount,
                        finalAmount: totalAmount,
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                    },
                    payment: {
                        paymentMethod: raw.payment?.paymentMethod || 'N/A',
                        paymentStatus: raw.payment?.paymentStatus || 'Pending',
                        paidAt: raw.payment?.paidAt || null,
                        transactionId: raw.payment?.transactionId || vendorPricing.transactionId || null,
                        isPaidToVendor: typeof vendorPricing.isPaidToVendor === 'boolean' ? vendorPricing.isPaidToVendor : null,
                        paidToVendorDate: vendorPricing.paidToVendorDate || null,
                    },
                    vendorPricingDetails: {
                        commissionRate,
                        platformFee,
                        vendorNetAmount,
                        isPaidToVendor: typeof vendorPricing.isPaidToVendor === 'boolean' ? vendorPricing.isPaidToVendor : null,
                        paidToVendorDate: vendorPricing.paidToVendorDate || null,
                        transactionId: vendorPricing.transactionId || null,
                    },
                    createdAt: raw.createdAt || new Date().toISOString(),
                    updatedAt: raw.updatedAt || null,
                    cancelReason: raw.cancelReason || null,
                    refundAmount: Number(raw.refundAmount) || 0,
                    confirmDeadline: raw.confirmDeadline || (raw.delivery as any)?.confirmDeadline || null,
                    deliveredDeadline: raw.deliveredDeadline || (raw.delivery as any)?.deliveredDeadline || null,
                    slaStatus: raw.slaStatus || (raw.delivery as any)?.slaStatus || null,
                };

                return order;
            }
            return null;
        } catch (error) {
            console.error("Failed to get Vendor Order Details:", error);
            throw error;
        }
    }

    // Update order status (vendor)
    async updateOrderStatus(
        orderId: string,
        newStatus: string,
        reason?: string,
        deliveryProofImages: File[] = [],
        estimatedDelivery?: string
    ): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const formData = new FormData();
            formData.append('NewStatus', newStatus);
            if (reason) {
                const normalizedReason = String(reason).trim();
                formData.append('Reason', normalizedReason);
            }
            if (estimatedDelivery) {
                formData.append('EstimatedDelivery', estimatedDelivery);
            }
            if (newStatus === 'Delivering' || newStatus === 'Delivered') {
                const targetField = (newStatus === 'Delivering') ? 'PreparationProofImages' : 'DeliveryProofImages';
                const otherField = (newStatus === 'Delivering') ? 'DeliveryProofImages' : 'PreparationProofImages';

                if (deliveryProofImages?.length) {
                    deliveryProofImages.forEach(file => formData.append(targetField, file));
                } else {
                    formData.append(targetField, '');
                }
                // Send dummy string for the alternative field as Swagger does
                formData.append(otherField, '');
            }

            const token = getAuthToken();
            const user = getCurrentUser();
            const isVendor = user?.role === 'vendor' || user?.roles?.includes('vendor');

            // Special case for completing order
            if (newStatus === 'Completed') {
                const url = `${API_BASE_URL}/orders/customer/${orderId}/completed`;
                fetchWithAuth(url, {
                    method: 'PUT',
                    headers: { 'Accept': '*/*' }
                }).then(async (response) => {
                    if (response.ok) {
                        resolve(true);
                    } else {
                        const errorText = await response.text().catch(() => '');
                        try {
                            const errorData = JSON.parse(errorText);
                            reject(new Error(errorData.errorMessages?.[0] || errorData.message || `HTTP error! status: ${response.status}`));
                        } catch {
                            reject(new Error(`HTTP error! status: ${response.status}`));
                        }
                    }
                }).catch(err => reject(err));
                return;
            }

            const url = isVendor 
                ? `${API_BASE_URL}/orders/vendor/${orderId}/status`
                : `${API_BASE_URL}/orders/customer/${orderId}/status`;
            
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Accept', '*/*');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(true);
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        const errorMessage = errorData.errorMessages?.[0] || errorData.message || `HTTP error! status: ${xhr.status}`;
                        reject(new Error(errorMessage));
                    } catch {
                        reject(new Error(`HTTP error! status: ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => {
                reject(new Error('Lỗi mạng khi cập nhật trạng thái đơn hàng.'));
            };

            xhr.send(formData);
        });
    }

    // Cancel an order
    async cancelOrder(
        orderId: string,
        reason?: string,
        scope: 'auto' | 'customer' | 'vendor' = 'auto',
    ): Promise<boolean> {
        try {
            const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
            const user = getCurrentUser();
            const isVendorByRole = user?.role === 'vendor' || user?.roles?.includes('vendor');
            const isVendor = scope === 'vendor' ? true : scope === 'customer' ? false : isVendorByRole;
            const url = isVendor
                ? `${API_BASE_URL}/orders/vendor/${orderId}/cancel`
                : `${API_BASE_URL}/orders/customer/${orderId}/cancel`;

            const response = await fetchWithAuth(url, {
                method: 'PUT',
                headers: this.getHeaders('PUT'),
                body: JSON.stringify({ cancelReason: normalizedReason || 'Không có lý do' }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Error cancelling order:", errorData);
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK';
        } catch (error) {
            console.error("Failed to cancel order:", error);
            throw error;
        }
    }

    // Get preparation plan for a specific date (vendor)
    async getPreparationPlan(date: string, allOrders: boolean = false): Promise<PreparationPlan | null> {
        try {
            const url = `${API_BASE_URL}/orders/vendor/daily-plan?date=${date}${allOrders ? '&allOrders=true' : ''}`;
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: this.getHeaders('GET'),
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.isSuccess && data.result) {
                return data.result as PreparationPlan;
            }
            return null;
        } catch (error) {
            console.error("Failed to get preparation plan:", error);
            throw error;
        }
    }
}

export const orderService = new OrderService();
