import { getAuthToken, fetchWithAuth } from './auth';

const API_BASE_URL = '/api';

export interface CreateReviewRequest {
    itemId: string;
    rating: number;
    comment?: string;
    reviewImages?: File[];
}

export interface ReviewResponse {
    reviewId: string;
    itemId: string;
    rating: number;
    comment: string;
    reviewImages: string[];
    createdAt: string;
}

export interface Review {
    reviewId: string | number;
    packageId?: number;
    packageName?: string;
    itemId: string;
    variantId: number;
    variantName: string;
    customerId: string;
    customerName: string;
    customerAvatar: string | null;
    vendorId: string;
    rating: number;
    comment: string;
    reviewImageUrls: string[];
    vendorReply: string | null;
    isVisible: boolean;
    createdAt: string;
}

class ReviewService {
    private extractReviewArray(data: any): Review[] {
        if (!data) return [];
        
        if (Array.isArray(data)) {
            return data as Review[];
        }

        // Try various path patterns based on known API response structures
        const items = 
            data?.result?.items || 
            data?.Result?.Items || 
            data?.result?.reviews || 
            data?.result || 
            data?.Result ||
            data?.data || 
            data?.Data ||
            data?.items ||
            data?.Items;

        if (Array.isArray(items)) {
            return items as Review[];
        }

        // Deep nested checks if needed
        if (data?.result && typeof data.result === 'object') {
            if (Array.isArray(data.result.items)) return data.result.items;
            if (Array.isArray(data.result.data)) return data.result.data;
        }

        return [];
    }

    private getHeaders(isMultipart = false): HeadersInit {
        const headers: HeadersInit = {
            'Accept': 'application/json',
        };
        
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        
        return headers;
    }

    async createReview(request: CreateReviewRequest): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('ItemId', request.itemId);
            formData.append('Rating', request.rating.toString());
            
            if (request.comment) {
                formData.append('Comment', request.comment);
            }
            
            if (request.reviewImages && request.reviewImages.length > 0) {
                request.reviewImages.forEach((image) => {
                    formData.append('ReviewImages', image);
                });
            }

            const response = await fetchWithAuth(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Create Review error response:', errorData);
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to create review:', error);
            throw error;
        }
    }

    /**
     * OpenAPI: GET /api/reviews/package/{packageId} (public, paginated).
     */
    async getReviewsByPackageId(packageId: number): Promise<Review[]> {
        try {
            if (!Number.isFinite(packageId) || packageId <= 0) return [];
            const qs = new URLSearchParams({ PageNumber: '1', PageSize: '50' });
            const response = await fetchWithAuth(`${API_BASE_URL}/reviews/package/${packageId}?${qs.toString()}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('❌ Failed to fetch reviews by package:', error);
            return [];
        }
    }

    /** @deprecated Backend exposes reviews per package; prefer getReviewsByPackageId(route package id). */
    async getReviewsByVariant(variantId: number | string): Promise<Review[]> {
        try {
            console.log(`🔍 Fetching reviews (legacy variant path) for: ${variantId}`);
            let response = await fetchWithAuth(`${API_BASE_URL}/reviews/variant/${variantId}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (response.status === 404 || response.status === 405) {
                response = await fetchWithAuth(`${API_BASE_URL}/reviews?variantId=${variantId}`, {
                    method: 'GET',
                    headers: this.getHeaders(),
                });
            }

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('❌ Failed to fetch reviews by variant:', error);
            return [];
        }
    }

    async getVendorReviews(): Promise<Review[]> {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/reviews/vendor`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('Failed to fetch vendor reviews:', error);
            return [];
        }
    }

    async getReviewsByVendorId(vendorId: string, pageNumber = 1, pageSize = 50): Promise<Review[]> {
        try {
            const qs = new URLSearchParams({ 
                PageNumber: pageNumber.toString(), 
                PageSize: pageSize.toString() 
            });
            const response = await fetchWithAuth(`${API_BASE_URL}/reviews/vendor/${vendorId}?${qs.toString()}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('Failed to fetch reviews by vendor ID:', error);
            return [];
        }
    }

    async updateVendorReply(reviewId: string | number, vendorReply: string): Promise<boolean> {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/reviews/${reviewId}/vendor-reply`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ vendorReply }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to update vendor reply:', error);
            throw error;
        }
    }

    async updateReviewVisibility(reviewId: string | number, isVisible: boolean): Promise<boolean> {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/reviews/${reviewId}/visibility`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ isVisible }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to update review visibility:', error);
            throw error;
        }
    }
}

export const reviewService = new ReviewService();
