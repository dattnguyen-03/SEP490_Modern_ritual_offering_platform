import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useLocation } from 'react-router-dom';
import toast from '../../services/toast';
import { packageService } from '../../services/packageService';
import { addOnService } from '../../services/addOnService';
import { getCurrentUser } from '../../services/auth';
import { CeremonyCategory, PackageAddOn } from '../../types';
import ImageModal from '../../components/ImageModal';

interface ProductManagementProps {
  onNavigate: (path: string) => void;
}

interface Product {
  id: string;
  name: string;
  categoryId: number;
  category: string;
  price: number;
  stock: number;
  image: string;
  rating: number;
  orders: number;
  status: 'active' | 'inactive' | 'draft';
  approvalStatus?: string;
  created: string;
}

interface VariantSwap {
  originalItemName: string;
  originalItemAllocatedPrice: number;
  replacementItemName: string;
  surcharge: number;
  displayOrder: number;
}

type PackageStatusFilter = '' | 'Draft' | 'Pending' | 'Approved' | 'Rejected';

const ProductManagement: React.FC<ProductManagementProps> = ({ onNavigate }) => {
  const location = useLocation();
  const PRODUCTS_PER_PAGE = 5;

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(null);
  const [vendorProfileResolved, setVendorProfileResolved] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<PackageStatusFilter>('');
  const [viewProductDetails, setViewProductDetails] = useState<any | null>(null);
  const [aiScreeningLoading, setAiScreeningLoading] = useState<boolean>(false);
  const [aiScreeningError, setAiScreeningError] = useState<string | null>(null);
  const [aiScreeningResult, setAiScreeningResult] = useState<any | null>(null);
  const [aiReasonExpanded, setAiReasonExpanded] = useState(false);
  const [viewDisplayImageIndex, setViewDisplayImageIndex] = useState<number>(0);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    packageName: string;
    description: string;
    categoryId: number;
    packageImageUrls: string[];
    primaryImageIndex: number;
    addOnIds: number[];
    variants: {
      variantId?: string | number;
      variantName: string;
      description: string;
      price: number;
      imageUrls: string[];
      primaryImageIndex?: number;
      swaps?: {
        originalItemName: string;
        originalItemAllocatedPrice: number;
        replacementItemName: string;
        surcharge: number;
        displayOrder: number;
      }[];
    }[];
  } | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVariantIndex, setUploadingVariantIndex] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<{
    packageName: string;
    description: string;
    categoryId: number;
    packageImageUrls: string[];
    primaryImageIndex: number;
    addOnIds: number[];
    variants: {
      variantId?: string | number;
      variantName: string;
      description: string;
      price: number;
      imageUrls: string[];
      primaryImageIndex?: number;
      swaps?: {
        originalItemName: string;
        originalItemAllocatedPrice: number;
        replacementItemName: string;
        surcharge: number;
        displayOrder: number;
      }[];
    }[];
  }>({
    packageName: '',
    description: '',
    categoryId: 1,
    packageImageUrls: [],
    primaryImageIndex: 0,
    addOnIds: [],
    variants: [{ variantName: '', description: '', price: 0, imageUrls: [], primaryImageIndex: 0, swaps: [] }],
  });

  const [categories, setCategories] = useState<CeremonyCategory[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<PackageAddOn[]>([]);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageModalImages, setImageModalImages] = useState<string[]>([]);
  const [imageModalInitialIndex, setImageModalInitialIndex] = useState(0);
  const [imageModalAltText, setImageModalAltText] = useState('');
  const [handledAutoOpenKey, setHandledAutoOpenKey] = useState<string>('');

  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch categories and vendor add-ons for package form
        const [catData, addOnData] = await Promise.all([
          packageService.getCeremonyCategories(),
          addOnService.getAllAddOns(),
        ]);
        setCategories(catData.filter(c => c.isActive));
        setAvailableAddOns((addOnData || []).filter(a => a.isActive));

        // Fetch vendor profile to get the correct profileId for filtering
        const { getVendorProfile } = await import('../../services/auth');
        const profile = await getVendorProfile();
        if (profile) {
          // Look for profileId in the profile response. Usually it's in the profile object.
          // Based on services/auth.ts getProfile response, it's profileId.
          // But getVendorProfile returns VendorCurrentProfile which might not have it.
          // Let's try to get it from getProfile if getVendorProfile doesn't have it.
          const { getProfile } = await import('../../services/auth');
          const fullProfile = await getProfile();
          if (fullProfile?.profileId) {
            console.log('✅ Found Vendor Profile ID:', fullProfile.profileId);
            setVendorProfileId(fullProfile.profileId);
          } else {
            setProductsError('Không xác định được vendor hiện tại.');
          }
        }
      } catch (error) {
        console.error('Failed to initialize vendor data:', error);
        setProductsError('Không thể tải dữ liệu vendor.');
      } finally {
        setVendorProfileResolved(true);
        setLoadingProducts(false);
      }
    };
    initData();
  }, []);

  const fallbackProductImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
      <rect width="88" height="88" rx="14" fill="#F1F5F9"/>
      <rect x="18" y="18" width="52" height="52" rx="10" fill="#E2E8F0"/>
      <text x="44" y="52" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#64748B">SP</text>
    </svg>`
  )}`;

  const toImageSrc = (value: string): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return fallbackProductImage;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return fallbackProductImage;
  };

  const categoryLabelMap: Record<number, string> = {
    1: 'Đầy Tháng',
    2: 'Tân Gia',
    3: 'Khai Trương',
    4: 'Tổ Tiên',
    5: 'Khác',
  };

  const mapCategory = (categoryId: number): string => {
    const found = categories.find(c => c.categoryId === categoryId);
    if (found) return found.name;
    return categoryLabelMap[categoryId] || 'Khác';
  };

  const mapItemTypeLabel = (itemType?: string): string => {
    const normalized = String(itemType || '').trim().toLowerCase();
    if (normalized === 'food') return 'Thực phẩm';
    if (normalized === 'object') return 'Vật phẩm';
    if (normalized === 'service') return 'Dịch vụ';
    return 'Khác';
  };

  const parseCurrencyInput = (value: string): number => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits);
  };

  const formatCurrencyInput = (value: number): string => {
    return Number(value || 0).toLocaleString('vi-VN');
  };

  const createEmptySwap = (displayOrder: number): VariantSwap => ({
    originalItemName: '',
    originalItemAllocatedPrice: 0,
    replacementItemName: '',
    surcharge: 0,
    displayOrder,
  });

  const normalizeSwaps = (swaps: any): VariantSwap[] => {
    if (!Array.isArray(swaps)) return [];
    return swaps.map((s: any, idx: number) => ({
      originalItemName: String(s?.originalItemName || ''),
      originalItemAllocatedPrice: Number(s?.originalItemAllocatedPrice || 0),
      replacementItemName: String(s?.replacementItemName || ''),
      surcharge: Number(s?.surcharge || 0),
      displayOrder: Number(s?.displayOrder ?? (idx + 1)),
    }));
  };

  const extractSelectedAddOnIds = (pkg: any): number[] => {
    if (!pkg) return [];
    const source = Array.isArray(pkg.availableAddOns)
      ? pkg.availableAddOns
      : (Array.isArray(pkg.addOns) ? pkg.addOns : []);

    return source
      .map((a: any) => Number(a?.addOnId ?? a?.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
  };

  const normalizeApprovalStatus = (raw: unknown): PackageStatusFilter => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value === 'Approved') return 'Approved';
    if (value === 'Rejected') return 'Rejected';
    if (value === 'Draft') return 'Draft';

    // Role-based pending states from backend should be treated as "Chờ duyệt"
    if (
      value === 'Pending' ||
      value === 'WaitingStaffApproval' ||
      value === 'WaitingAdminApproval' ||
      value === 'WaitingVendorApproval' ||
      value === 'WaitingApproval' ||
      value === 'VendorActionRequired' ||
      value === 'StaffActionRequired' ||
      value === 'AdminActionRequired'
    ) {
      return 'Pending';
    }

    return '';
  };

  const getCategoryId = (label: string) => {
    const entry = Object.entries(categoryLabelMap).find(([k, v]) => v === label);
    return entry ? parseInt(entry[0]) : 5;
  };

  const clearNotificationFocusParams = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has('productId') && !params.has('productName')) return;

    params.delete('productId');
    params.delete('productName');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, nextUrl);
  };

  const handleViewDetails = async (
    product: Pick<Product, 'id'>,
    options?: { silent?: boolean },
  ) => {
    const silent = Boolean(options?.silent);

    try {
      setAiScreeningLoading(true);
      setAiScreeningError(null);
      setAiScreeningResult(null);
      setAiReasonExpanded(false);

      if (!silent) {
        Swal.fire({
          title: 'Đang tải...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
      }

      const pkgDetails: any = await packageService.getPackageById(product.id, true);

      if (!silent) {
        Swal.close();
      }

      if (!pkgDetails) {
        throw new Error('Không tìm thấy thông tin chi tiết sản phẩm');
      }

      // Normalize approvalStatus từ nhiều field khả dĩ của API
      // Fallback về selectedStatus vì product đang ở filter đó (e.g. "Approved")
      const rawApproval = pkgDetails.approvalStatus || pkgDetails.packageStatus || pkgDetails.status || selectedStatus || '';
      pkgDetails.approvalStatus = rawApproval;
      pkgDetails.normalizedApprovalStatus = normalizeApprovalStatus(rawApproval);

      // Khi package isActive=true, force variant isActive=true
      // Vì API thường trả isActive=false cho variant dù package đang hoạt động
      if (pkgDetails.isActive && Array.isArray(pkgDetails.packageVariants)) {
        pkgDetails.packageVariants = pkgDetails.packageVariants.map((v: any) => ({
          ...v,
          isActive: true,
        }));
      }

      setViewDisplayImageIndex(pkgDetails.primaryImageIndex || 0);
      setViewProductDetails(pkgDetails);

      try {
        const screening = await packageService.getPackageAIScreening(String(pkgDetails.packageId || pkgDetails.id || product.id));
        setAiScreeningResult(screening);
      } catch (screeningError) {
        const message = screeningError instanceof Error ? screeningError.message : 'Không thể tải kết quả AI screening.';
        setAiScreeningError(message);
      } finally {
        setAiScreeningLoading(false);
      }

      setEditProductOpen(false);
    } catch (error) {
      setAiScreeningLoading(false);

      if (!silent) {
        Swal.close();
      }

      const message = error instanceof Error ? error.message : 'Lỗi khi lấy thông tin sản phẩm';
      if (silent) {
        toast.error(message);
      } else {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: message });
      }
    }
  };

  const reloadAIScreening = async () => {
    if (!viewProductDetails) return;

    setAiScreeningLoading(true);
    setAiScreeningError(null);
    setAiScreeningResult(null);
    setAiReasonExpanded(false);

    try {
      const screening = await packageService.getPackageAIScreening(String(viewProductDetails.packageId || viewProductDetails.id));
      setAiScreeningResult(screening);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải kết quả AI screening.';
      setAiScreeningError(message);
    } finally {
      setAiScreeningLoading(false);
    }
  };

  const mapAiDecisionLabel = (decision: string) => {
    switch (decision) {
      case 'Approved':
        return { text: 'AI đánh giá tốt', className: 'bg-green-100 text-green-700 border border-green-200' };
      case 'VendorActionRequired':
        return { text: 'Cần bạn chỉnh sửa', className: 'bg-amber-100 text-amber-700 border border-amber-200' };
      case 'StaffActionRequired':
        return { text: 'Chờ nhân viên kiểm duyệt', className: 'bg-blue-100 text-blue-700 border border-blue-200' };
      case 'AdminActionRequired':
        return { text: 'Chờ quản trị phê duyệt', className: 'bg-indigo-100 text-indigo-700 border border-indigo-200' };
      case 'Rejected':
        return { text: 'Không đạt kiểm duyệt', className: 'bg-red-100 text-red-700 border border-red-200' };
      default:
        return { text: 'Đang chờ kết quả', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
  };

  const getAISummary = (raw: any) => {
    const source = raw?.fullAiResponse && typeof raw.fullAiResponse === 'object' ? { ...raw, ...raw.fullAiResponse } : raw;

    return {
      decision: String(source?.decision || '').trim(),
      reasoning: String(source?.reasoning || '').trim(),
      issues: Array.isArray(source?.issuesDetected) ? source.issuesDetected.filter((x: any) => String(x || '').trim()) : [],
      recommendations: Array.isArray(source?.recommendations) ? source.recommendations.filter((x: any) => String(x || '').trim()) : [],
      confidenceScore: typeof source?.confidenceScore === 'number' ? source.confidenceScore : (typeof source?.confidence === 'number' ? source.confidence : null),
      requiresManualReview: typeof source?.requiresManualReview === 'boolean' ? source.requiresManualReview : null,
      screenedAt: source?.screenedAt ? String(source.screenedAt) : '',
    };
  };

  const closeViewProductModal = () => {
    setViewProductDetails(null);
    setAiScreeningLoading(false);
    setAiScreeningError(null);
    setAiScreeningResult(null);
    setAiReasonExpanded(false);
  };

  const openEditForm = () => {
    if (!viewProductDetails) return;
    let imgs: string[] = [];
    let primaryIdx = viewProductDetails.primaryImageIndex || 0;

    if (Array.isArray(viewProductDetails.imageUrls) && viewProductDetails.imageUrls.length > 0) {
      imgs = [...viewProductDetails.imageUrls];
    } else {
      const pkgImages: any[] = viewProductDetails.packageImages || viewProductDetails.images || [];
      if (pkgImages.length > 0) {
        const sorted = [...pkgImages].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        sorted.forEach((img: any, i: number) => {
          imgs.push(String(img.imageUrl || img.url || ''));
          if (img.isPrimary) primaryIdx = i;
        });
      } else if (viewProductDetails.imageUrl) {
        imgs.push(viewProductDetails.imageUrl);
      }
    }

    setEditForm({
      packageName: viewProductDetails.packageName || '',
      description: viewProductDetails.description || '',
      categoryId: viewProductDetails.categoryId || 1,
      packageImageUrls: imgs.filter(url => url.trim() !== ''),
      primaryImageIndex: primaryIdx,
      addOnIds: extractSelectedAddOnIds(viewProductDetails),
      variants: (viewProductDetails.packageVariants || []).map((v: any) => {
        const raw = (v as any).imageUrls ?? (v as any).variantImageUrls ?? (v as any).variantImages ?? (v as any).images ?? [];
        const rawUrls = Array.isArray(raw)
          ? raw.map((it: any) => String((it && typeof it === 'object') ? (it.imageUrl || it.url || '') : it)).filter((u: string) => u.trim())
          : [];

        const single = String((v as any).imageUrl || '').trim();
        const merged = Array.from(new Set([single, ...rawUrls])).filter((u) => String(u || '').trim());
        const primary = typeof (v as any).primaryVariantImageIndex === 'number' ? Number((v as any).primaryVariantImageIndex) : 0;
        const safePrimary = primary >= 0 && primary < merged.length ? primary : 0;
        return {
          variantId: v.variantId ?? v.id ?? v.packageVariantId,
          variantName: v.variantName || '',
          description: v.description || '',
          price: Number(v.price) || 0,
          imageUrls: merged,
          primaryImageIndex: safePrimary,
          swaps: normalizeSwaps((v as any).availableSwaps ?? (v as any).swaps),
        };
      }),
    });
    setEditProductOpen(true);
  };

  const handleSaveEdit = async (action: 'draft' | 'submit') => {
    if (!viewProductDetails || !editForm) return;
    if (editForm.packageImageUrls.length === 0) {
      toast.warning('Vui lòng tải ít nhất 1 ảnh sản phẩm!');
      return;
    }
    setEditSaving(true);
    try {
      const normalizedAction = action === 'draft' ? 'Draft' : 'Submit';
      const safePrimaryIndex = editForm.primaryImageIndex >= 0 && editForm.primaryImageIndex < editForm.packageImageUrls.length
        ? editForm.primaryImageIndex
        : 0;
      await packageService.updatePackage(viewProductDetails.packageId || viewProductDetails.id, {
        packageName: editForm.packageName,
        description: editForm.description,
        categoryId: editForm.categoryId,
        packageImageUrls: editForm.packageImageUrls.filter(u => u.trim()),
        primaryImageIndex: safePrimaryIndex,
        action: normalizedAction,
        addOnIds: editForm.addOnIds,
        newAddOns: [],
        variants: editForm.variants.map(v => {
          const base = {
            variantId: v.variantId,
            variantName: v.variantName,
            description: v.description,
            price: v.price,
          } as {
            variantId?: string | number;
            variantName: string;
            description: string;
            price: number;
            imageUrl?: string;
            variantImageUrls?: string[];
            primaryVariantImageIndex?: number;
            swaps?: {
              originalItemName: string;
              originalItemAllocatedPrice: number;
              replacementItemName: string;
              surcharge: number;
              displayOrder: number;
            }[];
          };

          const cleaned = (v.imageUrls || []).filter(u => u.trim());
          const preferredPrimary = typeof v.primaryImageIndex === 'number' ? v.primaryImageIndex : 0;
          const safePrimary = preferredPrimary >= 0 && preferredPrimary < cleaned.length ? preferredPrimary : 0;
          base.variantImageUrls = cleaned;
          base.primaryVariantImageIndex = safePrimary;
          base.swaps = Array.isArray(v.swaps)
            ? v.swaps.map((s, idx) => ({
              originalItemName: String(s.originalItemName || ''),
              originalItemAllocatedPrice: Number(s.originalItemAllocatedPrice || 0),
              replacementItemName: String(s.replacementItemName || ''),
              surcharge: Number(s.surcharge || 0),
              displayOrder: Number(s.displayOrder ?? (idx + 1)),
            })).filter((s) => s.originalItemName && s.replacementItemName)
            : [];

          return base;
        }),
      });
      toast.success(action === 'draft' ? 'Lưu chỉnh sửa bản nháp thành công!' : 'Đã gửi duyệt thay đổi!');
      // Reload details
      const updated = await packageService.getPackageById(viewProductDetails.packageId || viewProductDetails.id, true);
      setViewProductDetails(updated);
      setEditProductOpen(false);
      loadPackages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật sản phẩm';
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const loadPackages = async () => {
    setLoadingProducts(true);
    setProductsError(null);
    setCurrentPage(1);

    try {
      console.log('🔄 Loading packages for vendor...', { selectedStatus, vendorProfileId });
      const packages = await packageService.getPackagesByStatus('', 1, 100);

      const statusFiltered = selectedStatus
        ? packages.filter((item: any) => {
          const normalized = normalizeApprovalStatus(item.approvalStatus || item.packageStatus || item.status);
          return normalized === selectedStatus;
        })
        : packages;

      // Lọc chỉ lấy sản phẩm của vendor hiện tại
      // Ưu tiên dùng vendorProfileId đã fetch từ profile
      const source = vendorProfileId
        ? statusFiltered.filter((item: any) => {
          const itemVendorId = String(item.vendorProfileId || item.vendorId || '').trim();
          const match = itemVendorId === vendorProfileId;
          return match;
        })
        : statusFiltered;

      console.log(`📦 Loaded ${source.length} products after filtering (Total from API: ${packages.length})`);

      const mapped: Product[] = source.map((item: any) => {
        const variants = Array.isArray(item.packageVariants) ? item.packageVariants : (Array.isArray(item.variants) ? item.variants : []);
        const activeVariants = variants.filter((variant: any) => Boolean(variant?.isActive));
        const selectedVariant = activeVariants[0] || variants[0];
        const price = Number(selectedVariant?.price || 0);

        // Map images from various possible field names
        const imageUrls = item.imageUrls || item.packageImages || [];
        const primaryIdx = item.primaryImageIndex || 0;
        const imageUrl = item.imageUrl || item.packageAvatarUrl || (Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[primaryIdx] || imageUrls[0] : '');

        return {
          id: String(item.packageId ?? item.id ?? ''),
          name: String(item.packageName || item.name || 'Sản phẩm'),
          categoryId: Number(item.categoryId || 0),
          category: mapCategory(Number(item.categoryId || 0)),
          price: Number.isFinite(price) ? price : 0,
          stock: activeVariants.length || variants.length,
          image: String(imageUrl),
          rating: Number(item.ratingAvg || 0),
          orders: Number(item.totalSold || 0),
          status: Boolean(item.isActive) ? 'active' : 'inactive',
          approvalStatus: normalizeApprovalStatus(item.approvalStatus || item.packageStatus || item.status),
          created: String(item.createdAt || ''),
        };
      });

      setProducts(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.';
      setProductsError(message);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };


  useEffect(() => {
    if (!vendorProfileResolved || !vendorProfileId) return;
    loadPackages();
  }, [selectedStatus, vendorProfileId, vendorProfileResolved]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusFromQuery = String(params.get('status') || '').trim();
    const allowedStatuses: PackageStatusFilter[] = ['', 'Draft', 'Pending', 'Approved', 'Rejected'];

    if (statusFromQuery && allowedStatuses.includes(statusFromQuery as PackageStatusFilter) && selectedStatus !== statusFromQuery) {
      setSelectedStatus(statusFromQuery as PackageStatusFilter);
    }
  }, [location.search, selectedStatus]);

  useEffect(() => {
    if (!vendorProfileResolved) return;

    const params = new URLSearchParams(location.search);
    const productId = String(params.get('productId') || '').trim();
    if (!productId) return;

    const autoOpenKey = `direct:${productId}|${selectedStatus}`;
    if (handledAutoOpenKey === autoOpenKey) return;

    setHandledAutoOpenKey(autoOpenKey);
    handleViewDetails({ id: productId }, { silent: true });
    clearNotificationFocusParams();
  }, [vendorProfileResolved, location.search, selectedStatus, handledAutoOpenKey]);

  useEffect(() => {
    if (loadingProducts || products.length === 0) return;

    const params = new URLSearchParams(location.search);
    const productId = String(params.get('productId') || '').trim();
    const productName = String(params.get('productName') || '').trim().toLowerCase();

    if (productId || !productName) return;

    const autoOpenKey = `name:${productName}|${selectedStatus}`;
    if (handledAutoOpenKey === autoOpenKey) return;

    const targetProduct = products.find((p) => String(p.name || '').trim().toLowerCase() === productName);

    if (!targetProduct) return;

    setHandledAutoOpenKey(autoOpenKey);
    handleViewDetails(targetProduct, { silent: true });
    clearNotificationFocusParams();
  }, [loadingProducts, products, location.search, selectedStatus, handledAutoOpenKey]);

  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE));
  const categoryOptions = Array.from(new Set(products.map((product) => mapCategory(product.categoryId)))).sort((a, b) => a.localeCompare(b));

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((product) => mapCategory(product.categoryId) === selectedCategory);

  const filteredTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, filteredTotalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * PRODUCTS_PER_PAGE,
    safeCurrentPage * PRODUCTS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > filteredTotalPages) {
      setCurrentPage(filteredTotalPages);
    }
  }, [currentPage, filteredTotalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedStatus]);

  const handleCreatePackage = async (action: 'Draft' | 'Submit') => {
    if (!createForm.packageName.trim()) {
      toast.warning('Vui lòng nhập tên sản phẩm!');
      return;
    }
    if (createForm.packageImageUrls.length === 0) {
      toast.warning('Vui lòng tải ít nhất 1 ảnh sản phẩm!');
      return;
    }
    if (createForm.variants.some(v => !v.variantName.trim() || v.price <= 0)) {
      toast.warning('Vui lòng điền đầy đủ tên và giá cho từng biến thể!');
      return;
    }
    setCreateSaving(true);
    try {
      const safePrimaryIndex = createForm.primaryImageIndex >= 0 && createForm.primaryImageIndex < createForm.packageImageUrls.length
        ? createForm.primaryImageIndex
        : 0;
      await packageService.createPackage({
        packageName: createForm.packageName,
        description: createForm.description,
        categoryId: createForm.categoryId,
        packageImageUrls: createForm.packageImageUrls,
        primaryImageIndex: safePrimaryIndex,
        action,
        addOnIds: createForm.addOnIds,
        newAddOns: [],
        variants: createForm.variants.map(v => {
          const base = {
            variantName: v.variantName,
            description: v.description,
            price: v.price,
          } as {
            variantName: string;
            description: string;
            price: number;
            imageUrl?: string;
            variantImageUrls?: string[];
            primaryVariantImageIndex?: number;
            swaps?: {
              originalItemName: string;
              originalItemAllocatedPrice: number;
              replacementItemName: string;
              surcharge: number;
              displayOrder: number;
            }[];
          };

          const cleaned = (v.imageUrls || []).filter(u => u.trim());
          base.variantImageUrls = cleaned;
          base.primaryVariantImageIndex = cleaned.length > 0 ? 0 : 0;
          base.swaps = Array.isArray(v.swaps)
            ? v.swaps.map((s, idx) => ({
              originalItemName: String(s.originalItemName || ''),
              originalItemAllocatedPrice: Number(s.originalItemAllocatedPrice || 0),
              replacementItemName: String(s.replacementItemName || ''),
              surcharge: Number(s.surcharge || 0),
              displayOrder: Number(s.displayOrder ?? (idx + 1)),
            })).filter((s) => s.originalItemName && s.replacementItemName)
            : [];

          return base;
        }),
      });
      toast.success(action === 'Draft' ? 'Lưu nháp thành công!' : 'Gửi phê duyệt thành công!');
      setShowAddForm(false);
      setCreateForm({ packageName: '', description: '', categoryId: 1, packageImageUrls: [], primaryImageIndex: 0, addOnIds: [], variants: [{ variantName: '', description: '', price: 0, imageUrls: [], swaps: [] }] });
      loadPackages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo sản phẩm';
      toast.error(msg);
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans text-slate-800">
      <div className="max-w-[1650px] mx-auto">
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-start gap-5">
            <button
              onClick={() => onNavigate('/vendor/dashboard')}
              className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 hover:bg-slate-900 hover:text-white transition-all group font-black text-[10px] uppercase tracking-widest gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại Dashboard
            </button>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Sản Phẩm</h1>
              <p className="text-black font-bold text-sm">Quản lý danh mục sản phẩm mâm cúng của bạn.</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-1 transition-all flex items-center gap-3 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Thêm sản phẩm</span>
          </button>
        </div>


        {/* Create Product Modal */}
        {showAddForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
          >
            <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 bg-white rounded-t-[2rem] flex-shrink-0">
                <div className="flex-1">
                  <h2 className="text-xl font-black text-gray-900">Thêm Sản Phẩm Mới</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Nhập thông tin và chọn lưu nháp hoặc gửi phê duyệt</p>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-500 flex-shrink-0"
                >×</button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Tên sản phẩm <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={createForm.packageName}
                    onChange={e => setCreateForm({ ...createForm, packageName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 focus:border-primary focus:outline-none transition font-semibold"
                    placeholder="Ví dụ: Mâm Cúng Đầy Tháng Truyền Thống..."
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Danh mục</label>
                  <select
                    value={createForm.categoryId}
                    onChange={e => setCreateForm({ ...createForm, categoryId: Number(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-sky-700 font-bold bg-sky-50 focus:border-primary focus:outline-none transition"
                  >
                    {categories.length > 0 ? (
                      categories.map(cat => (
                        <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                      ))
                    ) : (
                      <>
                        <option value={1}>Đầy Tháng</option>
                        <option value={2}>Tân Gia</option>
                        <option value={3}>Khai Trương</option>
                        <option value={4}>Tổ Tiên</option>
                        <option value={5}>Khác</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Images */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Hình ảnh sản phẩm</label>
                    <label className={`text-xs font-bold text-white px-3 py-1 rounded-full cursor-pointer transition ${uploadingImages ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'
                      }`}>
                      {uploadingImages ? ' Đang tải...' : '⬆ Tải ảnh lên'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingImages}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setUploadingImages(true);
                          try {
                            const urls = await packageService.uploadPackageImages(files);
                            setCreateForm(f => ({ ...f, packageImageUrls: [...f.packageImageUrls, ...urls] }));
                          } catch (err) {
                            toast.error('Lỗi upload ảnh: ' + (err instanceof Error ? err.message : 'Unknown'));
                          } finally {
                            setUploadingImages(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  {createForm.packageImageUrls.length === 0 ? (
                    <div className="w-full h-28 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                      <i className="fas fa-image text-3xl mb-1 opacity-40"></i>
                      <span className="text-xs text-gray-400">Chưa có ảnh</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {createForm.packageImageUrls.map((url, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={url}
                            alt={`preview-${i}`}
                            className={`w-20 h-20 object-cover rounded-2xl border-2 transition ${createForm.primaryImageIndex === i ? 'border-yellow-400 shadow-md' : 'border-gray-200'
                              }`}
                            onError={(e) => { (e.target as HTMLImageElement).src = fallbackProductImage; }}
                          />
                          <div className="absolute inset-0 flex gap-1 items-start justify-end p-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => setCreateForm(f => ({ ...f, primaryImageIndex: i }))}
                              title="Ảnh đại diện"
                              className={`w-5 h-5 rounded-full text-xs flex items-center justify-center shadow ${createForm.primaryImageIndex === i ? 'bg-yellow-400 text-white' : 'bg-white text-gray-400 hover:bg-yellow-100'
                                }`}
                            >★</button>
                            <button
                              onClick={() => {
                                const urls = createForm.packageImageUrls.filter((_, idx) => idx !== i);
                                const newPrimary = createForm.primaryImageIndex >= urls.length ? Math.max(0, urls.length - 1) : createForm.primaryImageIndex === i ? 0 : createForm.primaryImageIndex > i ? createForm.primaryImageIndex - 1 : createForm.primaryImageIndex;
                                setCreateForm(f => ({ ...f, packageImageUrls: urls, primaryImageIndex: newPrimary }));
                              }}
                              className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
                            >×</button>
                          </div>
                          {createForm.primaryImageIndex === i && (
                            <div className="absolute bottom-0 left-0 right-0 bg-yellow-400 text-white text-[9px] font-black text-center rounded-b-xl">CHÍNH</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Mô tả sản phẩm</label>
                    <span className={`text-[10px] font-bold ${createForm.description.length >= 255 ? 'text-red-500' : 'text-gray-400'}`}>
                      {createForm.description.length}/255
                    </span>
                  </div>
                  <textarea
                    value={createForm.description}
                    onChange={e => setCreateForm({ ...createForm, description: e.target.value.slice(0, 255) })}
                    maxLength={255}
                    rows={3}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm text-gray-700 focus:outline-none transition resize-none ${createForm.description.length >= 255 ? 'border-amber-400 focus:border-amber-500' : 'border-gray-200 focus:border-primary'
                      }`}
                    placeholder="Mô tả chi tiết sản phẩm..."
                  />
                  {createForm.description.length >= 255 && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">Đã đạt giới hạn tối đa 255 ký tự.</p>
                  )}
                </div>

                {/* Add-ons */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Món thêm đi kèm</label>
                    <span className="text-[10px] font-bold text-gray-500">Đã chọn: {createForm.addOnIds.length}</span>
                  </div>

                  {availableAddOns.length === 0 ? (
                    <div className="text-xs text-gray-400 italic bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">Hiện chưa có món thêm khả dụng.</div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-2xl border border-gray-200 p-3 bg-white space-y-2">
                      {availableAddOns.map((addOn) => {
                        const checked = createForm.addOnIds.includes(addOn.addOnId);
                        return (
                          <label key={addOn.addOnId} className={`flex items-start gap-3 p-2 rounded-xl cursor-pointer border transition ${checked ? 'border-primary/40 bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setCreateForm((prev) => ({
                                  ...prev,
                                  addOnIds: checked
                                    ? prev.addOnIds.filter((id) => id !== addOn.addOnId)
                                    : [...prev.addOnIds, addOn.addOnId],
                                }));
                              }}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800 truncate">{addOn.addOnName || addOn.itemName}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">{mapItemTypeLabel(addOn.itemType)} • {Number(addOn.retailPrice || 0).toLocaleString('vi-VN')}đ</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Variants */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Biến thể gói <span className="text-red-500">*</span></label>
                    <button
                      onClick={() => setCreateForm({ ...createForm, variants: [...createForm.variants, { variantName: '', description: '', price: 0, imageUrls: [], swaps: [] }] })}
                      className="text-xs font-bold text-primary hover:text-primary/70 transition px-3 py-1 border border-primary/30 rounded-full bg-primary/5"
                    >
                      + Thêm biến thể
                    </button>
                  </div>
                  <div className="space-y-3">
                    {createForm.variants.map((v, idx) => (
                      <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 rounded-full px-2 py-0.5">Gói #{idx + 1}</span>
                          {createForm.variants.length > 1 && (
                            <button
                              onClick={() => { const vars = createForm.variants.filter((_, i) => i !== idx); setCreateForm({ ...createForm, variants: vars }); }}
                              className="ml-auto text-red-400 hover:text-red-600 text-xs font-bold px-2 py-0.5 rounded-lg border border-red-200 hover:bg-red-50 transition"
                            >× Xóa</button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Tên gói <span className="text-red-400">*</span></label>
                            <input
                              type="text"
                              value={v.variantName}
                              onChange={e => { const vars = [...createForm.variants]; vars[idx] = { ...vars[idx], variantName: e.target.value }; setCreateForm({ ...createForm, variants: vars }); }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                              placeholder="Gói Cơ Bản, Gói VIP..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Giá (VNĐ) <span className="text-red-400">*</span></label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrencyInput(v.price)}
                              onChange={e => { const vars = [...createForm.variants]; vars[idx] = { ...vars[idx], price: parseCurrencyInput(e.target.value) }; setCreateForm({ ...createForm, variants: vars }); }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                              placeholder="500000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 block mb-1">Mô tả gói</label>
                          <input
                            type="text"
                            value={v.description}
                            onChange={e => { const vars = [...createForm.variants]; vars[idx] = { ...vars[idx], description: e.target.value }; setCreateForm({ ...createForm, variants: vars }); }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                            placeholder="Mô tả gói..."
                          />
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách đổi món (Swaps)</label>
                            <button
                              type="button"
                              onClick={() => {
                                const vars = [...createForm.variants];
                                const current = vars[idx] || { variantName: '', description: '', price: 0, imageUrls: [], swaps: [] as VariantSwap[] };
                                const currentSwaps = Array.isArray(current.swaps) ? current.swaps : [];
                                vars[idx] = { ...current, swaps: [...currentSwaps, createEmptySwap(currentSwaps.length + 1)] };
                                setCreateForm({ ...createForm, variants: vars });
                              }}
                              className="text-[10px] font-black text-primary border border-primary/30 rounded-full px-2 py-1 hover:bg-primary/5"
                            >
                              + Thêm swap
                            </button>
                          </div>

                          {Array.isArray(v.swaps) && v.swaps.length > 0 ? (
                            <div className="space-y-2">
                              {v.swaps.map((swap, sIdx) => (
                                <div key={`create-swap-${idx}-${sIdx}`} className="rounded-lg border border-gray-200 bg-white p-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={swap.originalItemName}
                                      onChange={(e) => {
                                        const vars = [...createForm.variants];
                                        const current = vars[idx];
                                        const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                        swaps[sIdx] = { ...swaps[sIdx], originalItemName: e.target.value };
                                        vars[idx] = { ...current, swaps };
                                        setCreateForm({ ...createForm, variants: vars });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                      placeholder="Món gốc"
                                    />
                                    <input
                                      type="text"
                                      value={swap.replacementItemName}
                                      onChange={(e) => {
                                        const vars = [...createForm.variants];
                                        const current = vars[idx];
                                        const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                        swaps[sIdx] = { ...swaps[sIdx], replacementItemName: e.target.value };
                                        vars[idx] = { ...current, swaps };
                                        setCreateForm({ ...createForm, variants: vars });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                      placeholder="Món thay thế"
                                    />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={formatCurrencyInput(swap.originalItemAllocatedPrice)}
                                      onChange={(e) => {
                                        const vars = [...createForm.variants];
                                        const current = vars[idx];
                                        const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                        swaps[sIdx] = { ...swaps[sIdx], originalItemAllocatedPrice: parseCurrencyInput(e.target.value) };
                                        vars[idx] = { ...current, swaps };
                                        setCreateForm({ ...createForm, variants: vars });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                      placeholder="Giá món gốc"
                                    />
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatCurrencyInput(swap.surcharge)}
                                        onChange={(e) => {
                                          const vars = [...createForm.variants];
                                          const current = vars[idx];
                                          const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                          swaps[sIdx] = { ...swaps[sIdx], surcharge: parseCurrencyInput(e.target.value) };
                                          vars[idx] = { ...current, swaps };
                                          setCreateForm({ ...createForm, variants: vars });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                        placeholder="Phụ thu"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const vars = [...createForm.variants];
                                          const current = vars[idx];
                                          const swaps = Array.isArray(current?.swaps) ? current.swaps.filter((_, i) => i !== sIdx) : [];
                                          vars[idx] = {
                                            ...current,
                                            swaps: swaps.map((s, i) => ({ ...s, displayOrder: i + 1 })),
                                          };
                                          setCreateForm({ ...createForm, variants: vars });
                                        }}
                                        className="shrink-0 px-2 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-black hover:bg-red-50"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg px-3 py-2 bg-white">Chưa có swap nào cho gói này.</div>
                          )}
                        </div>

                        {/* Variant Images */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-gray-400 block">Hình ảnh gói</label>
                            <label className={`text-[10px] font-bold text-white px-3 py-1 rounded-full cursor-pointer transition ${uploadingVariantIndex === idx ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'}`}>
                              {uploadingVariantIndex === idx ? ' Đang tải...' : 'Tải ảnh lên'}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                disabled={uploadingVariantIndex === idx}
                                onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  setUploadingVariantIndex(idx);
                                  try {
                                    const urls = await packageService.uploadVariantImages(files);
                                    setCreateForm(f => {
                                      const vars = [...f.variants];
                                      const current = vars[idx] || { variantName: '', description: '', price: 0, imageUrls: [], swaps: [] };
                                      vars[idx] = { ...current, imageUrls: [...(current.imageUrls || []), ...urls] };
                                      return { ...f, variants: vars };
                                    });
                                  } catch (err) {
                                    toast.error('Lỗi upload ảnh biến thể: ' + (err instanceof Error ? err.message : 'Unknown'));
                                  } finally {
                                    setUploadingVariantIndex(null);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                          {(v.imageUrls || []).length === 0 ? (
                            <div className="text-xs text-gray-400 italic bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">Chưa có ảnh</div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {(v.imageUrls || []).map((url, i) => (
                                <div key={url + i} className="relative group">
                                  <img src={toImageSrc(url)} className="w-full h-16 object-cover rounded-xl border border-gray-200" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCreateForm(f => {
                                        const vars = [...f.variants];
                                        const current = vars[idx];
                                        if (!current) return f;
                                        const nextUrls = (current.imageUrls || []).filter((_, j) => j !== i);
                                        vars[idx] = { ...current, imageUrls: nextUrls };
                                        return { ...f, variants: vars };
                                      });
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition"
                                    aria-label="Xóa ảnh"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-5 border-t border-gray-200 bg-white rounded-b-[2rem] flex-shrink-0">
                <button
                  onClick={() => handleCreatePackage('Draft')}
                  disabled={createSaving}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {createSaving ? '...' : ' Lưu Nháp'}
                </button>
                <button
                  onClick={() => handleCreatePackage('Submit')}
                  disabled={createSaving}
                  className="flex-1 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md"
                >
                  {createSaving ? ' Đang gửi...' : 'Gửi Phê Duyệt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-primary">
            <p className="text-gray-600 text-sm font-semibold mb-2">Tổng Sản Phẩm</p>
            <p className="text-3xl font-black text-primary">{products.length}</p>
            <p className="text-xs text-gray-500 mt-2">Đang bán: {products.filter(p => p.status === 'active').length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">Tổng Đơn Hàng</p>
            <p className="text-3xl font-black text-blue-600">{products.reduce((sum, p) => sum + p.orders, 0)}</p>
            <p className="text-xs text-gray-500 mt-2">Từ tất cả sản phẩm</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">Đánh Giá Trung Bình</p>
            <p className="text-3xl font-black text-yellow-600">{products.length > 0 ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1) : '0.0'} ⭐</p>
            <p className="text-xs text-gray-500 mt-2">Dựa trên dữ liệu hiện có</p>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gold/20">
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Lọc danh sách sản phẩm</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label htmlFor="product-status-filter" className="text-sm text-slate-600 font-medium">Trạng thái</label>
              <select
                id="product-status-filter"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as PackageStatusFilter)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Tất cả</option>
                <option value="Draft">Nháp</option>
                <option value="Pending">Chờ duyệt</option>
                <option value="Approved">Đã duyệt</option>
                <option value="Rejected">Bị từ chối</option>
              </select>

              <label htmlFor="product-category-filter" className="text-sm text-slate-600 font-medium">Danh mục</label>
              <select
                id="product-category-filter"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="all">Tất cả</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingProducts && (
            <div className="px-6 py-8 text-center text-black font-semibold">Đang tải danh sách sản phẩm...</div>
          )}

          {!loadingProducts && productsError && (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 font-semibold mb-4">{productsError}</p>
              <button
                onClick={loadPackages}
                className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-bold text-sm uppercase hover:bg-primary/5 transition-all"
              >
                Thử lại
              </button>
            </div>
          )}

          {!loadingProducts && !productsError && filteredProducts.length === 0 && (
            <div className="px-6 py-8 text-center text-black font-semibold">
              {products.length === 0 ? 'Không có sản phẩm cho trạng thái đã chọn.' : 'Không có sản phẩm thuộc danh mục đã chọn.'}
            </div>
          )}

          {!loadingProducts && !productsError && filteredProducts.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Sản Phẩm</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Danh Mục</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Giá</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Đơn Hàng</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Đánh Giá</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Trạng Thái</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800 whitespace-nowrap">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={toImageSrc(product.image)}
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = fallbackProductImage;
                              }}
                            />
                            <div>
                              <p className="font-semibold text-gray-800">{product.name}</p>
                              {/* <p className="text-xs text-gray-500">ID: {product.id}</p> */}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold whitespace-nowrap">
                            {mapCategory(product.categoryId)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-primary">
                          {product.price.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800">{product.orders}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-800">{product.rating > 0 ? product.rating.toFixed(1) : '0'}</span>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const approval = normalizeApprovalStatus(product.approvalStatus);
                            if (approval === 'Pending') {
                              return <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap bg-yellow-100 text-yellow-700">Chờ Duyệt</span>;
                            }
                            if (approval === 'Rejected') {
                              return <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap bg-red-100 text-red-700">Bị Từ Chối</span>;
                            }
                            if (approval === 'Draft') {
                              return <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap bg-amber-100 text-amber-700">Nháp</span>;
                            }
                            return (
                              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {product.status === 'active' ? 'Hoạt Động' : 'Ngừng'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewDetails(product)}
                              className="px-3 py-2 text-blue-600 border border-blue-300 hover:bg-blue-100 rounded-lg transition-colors text-sm font-semibold whitespace-nowrap"
                              title="Xem chi tiết"
                            >
                              Chi Tiết
                            </button>

                            {/* <button
                              className="px-3 py-2 text-red-600 border border-red-300 hover:bg-red-100 rounded-lg transition-colors text-sm font-semibold"
                              title="Xóa"
                              onClick={async () => {
                                const result = await toast.confirm({
                                  title: 'Xóa sản phẩm?',
                                  text: `Bạn có chắc chắn muốn xóa "${product.name}"?`,
                                  icon: 'warning',
                                  confirmButtonText: 'Xóa',
                                  cancelButtonText: 'Hủy'
                                });
                                if (result.isConfirmed) {
                                  toast.success('Xóa sản phẩm thành công!');
                                }
                              }}
                            >
                              Xóa
                            </button> */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredProducts.length > PRODUCTS_PER_PAGE && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 md:px-6 py-4 bg-white">
                  <p className="text-sm text-slate-600">
                    Hiển thị{' '}
                    <span className="font-semibold">{(safeCurrentPage - 1) * PRODUCTS_PER_PAGE + 1}</span>
                    {' - '}
                    <span className="font-semibold">{Math.min(safeCurrentPage * PRODUCTS_PER_PAGE, filteredProducts.length)}</span>
                    {' / '}
                    <span className="font-semibold">{filteredProducts.length}</span>
                    {' sản phẩm'}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeCurrentPage === 1}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Trước
                    </button>

                    {Array.from({ length: filteredTotalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-9 h-9 px-2 rounded-lg text-sm font-bold transition-all ${safeCurrentPage === page
                          ? 'bg-primary text-white'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(filteredTotalPages, prev + 1))}
                      disabled={safeCurrentPage === filteredTotalPages}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Product Details Modal (like Order Details) */}
        {viewProductDetails && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
            onClick={closeViewProductModal}
          >
            <div
              className="bg-gray-50 w-full max-w-5xl my-4 rounded-[2rem] shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-white px-6 md:px-8 py-5 flex flex-wrap items-center gap-4 border-b border-gray-100">
                <button
                  onClick={closeViewProductModal}
                  className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
                >
                  Đóng
                </button>
                {/* <div className="flex-1 min-w-[200px]">
                  <h2 className="text-2xl font-black text-gray-900 font-display">Chi tiết sản phẩm</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Mã sản phẩm: #{String(viewProductDetails.packageId || viewProductDetails.id || '').padStart(5, '0')}
                  </p>
                </div> */}
                <div className="flex gap-2 items-center">

                  {(() => {
                    const approval = viewProductDetails.approvalStatus || viewProductDetails.packageStatus || viewProductDetails.status || '';
                    const isApproved = approval === 'Approved';
                    const isRejected = approval === 'Rejected';
                    return (
                      <>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex-shrink-0 ${isApproved ? 'bg-green-100 text-green-700 border border-green-200' :
                            isRejected ? 'bg-red-100 text-red-700 border border-red-200' :
                              'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          }`}>
                          {isApproved ? 'Đã Duyệt' : isRejected ? 'Từ Chối' : 'Chờ Duyệt'}
                        </span>
                        {!isApproved && (
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex-shrink-0 ${viewProductDetails.isActive ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {viewProductDetails.isActive ? 'Đang Bán' : 'Tạm Ngừng'}
                          </span>
                        )}
                      </>
                    );
                  })()}
                  {editProductOpen ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit('draft')}
                        disabled={editSaving}
                        className="px-5 py-2 rounded-full text-xs font-black text-white bg-yellow-500 uppercase tracking-widest hover:opacity-90 shadow-sm flex-shrink-0 transition-opacity disabled:opacity-50"
                      >
                        {editSaving ? ' Đang lưu...' : 'Lưu Nháp'}
                      </button>
                      <button
                        onClick={() => handleSaveEdit('submit')}
                        disabled={editSaving}
                        className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest text-white bg-green-600 hover:opacity-90 shadow-sm flex-shrink-0 transition-opacity disabled:opacity-50"
                      >
                        {editSaving ? ' Đang gửi...' : 'Lưu & Gửi Duyệt'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={openEditForm}
                      className="px-5 py-2 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm flex-shrink-0"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                  {editProductOpen && (
                    <button
                      onClick={() => setEditProductOpen(false)}
                      className="px-5 py-2 bg-gray-100 text-gray-700 rounded-full text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex-shrink-0"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 overflow-y-auto custom-scrollbar">

                {/* Left column */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Main Info Card */}
                  <div className="bg-white rounded-[2rem] border border-gray-200 p-6 shadow-sm group">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Thông tin cơ bản
                    </h3>
                    {editProductOpen && editForm ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Tên sản phẩm</label>
                          <input
                            type="text"
                            value={editForm.packageName}
                            onChange={e => setEditForm({ ...editForm, packageName: e.target.value })}
                            className="w-full px-4 py-2.5 border-2 border-primary/30 rounded-xl text-base font-bold text-gray-900 focus:border-primary focus:outline-none transition bg-primary/5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Danh mục</label>
                          <select
                            value={editForm.categoryId}
                            onChange={e => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}
                            className="w-full px-4 py-2 border-2 border-primary/30 rounded-xl text-sm font-bold text-sky-700 bg-sky-50 focus:border-primary focus:outline-none transition"
                          >
                            {categories.length > 0 ? (
                              categories.map(cat => (
                                <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                              ))
                            ) : (
                              <>
                                <option value={1}>Đầy Tháng</option>
                                <option value={2}>Tân Gia</option>
                                <option value={3}>Khai Trương</option>
                                <option value={4}>Tổ Tiên</option>
                                <option value={5}>Khác</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block font-bold">Mô tả sản phẩm</label>
                            <span className={`text-[9px] font-bold ${editForm.description.length >= 255 ? 'text-red-500' : 'text-gray-400'}`}>
                              {editForm.description.length}/255
                            </span>
                          </div>
                          <textarea
                            value={editForm.description}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value.slice(0, 255) })}
                            maxLength={255}
                            rows={5}
                            className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm text-gray-700 focus:outline-none transition resize-none ${editForm.description.length >= 255 ? 'border-amber-400 bg-amber-50/10 focus:border-amber-500' : 'border-primary/30 bg-primary/5 focus:border-primary'
                              }`}
                          />
                          {editForm.description.length >= 255 && (
                            <p className="text-[9px] text-amber-600 font-bold mt-1">Đã đạt giới hạn tối đa 255 ký tự.</p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Món thêm đi kèm</label>
                            <span className="text-[10px] font-bold text-gray-500">Đã chọn: {editForm.addOnIds.length}</span>
                          </div>

                          {availableAddOns.length === 0 ? (
                            <div className="text-xs text-gray-400 italic bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">Hiện chưa có món thêm khả dụng.</div>
                          ) : (
                            <div className="max-h-40 overflow-y-auto rounded-xl border border-primary/30 p-2 bg-white/90 space-y-2">
                              {availableAddOns.map((addOn) => {
                                const checked = editForm.addOnIds.includes(addOn.addOnId);
                                return (
                                  <label key={addOn.addOnId} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition ${checked ? 'border-primary/40 bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setEditForm((prev) => {
                                          if (!prev) return prev;
                                          return {
                                            ...prev,
                                            addOnIds: checked
                                              ? prev.addOnIds.filter((id) => id !== addOn.addOnId)
                                              : [...prev.addOnIds, addOn.addOnId],
                                          };
                                        });
                                      }}
                                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-gray-800 truncate">{addOn.addOnName || addOn.itemName}</p>
                                      <p className="text-[11px] text-gray-500 mt-0.5">{mapItemTypeLabel(addOn.itemType)} • {Number(addOn.retailPrice || 0).toLocaleString('vi-VN')}đ</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{viewProductDetails.packageName}</h4>
                        <div className="inline-block px-4 py-1.5 bg-sky-50 text-sky-700 font-bold text-xs rounded-xl mb-4 border border-sky-100">
                          {mapCategory(viewProductDetails.categoryId)}
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-2">Mô tả sản phẩm</p>
                          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50/80 p-4 rounded-[1.25rem] border border-gray-100">
                            {viewProductDetails.description || 'Không có mô tả chi tiết cho sản phẩm này.'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-2">Món thêm đi kèm</p>
                          {Array.isArray(viewProductDetails.availableAddOns) && viewProductDetails.availableAddOns.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {viewProductDetails.availableAddOns.map((addOn: any) => (
                                <span
                                  key={String(addOn?.addOnId ?? addOn?.id)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold"
                                >
                                  {String(addOn?.addOnName || addOn?.itemName || 'Món thêm')}
                                  <span className="text-emerald-600/80">{Number(addOn?.retailPrice || 0).toLocaleString('vi-VN')}đ</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Chưa chọn món thêm nào cho sản phẩm này.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Variants Card */}
                  <div className="bg-white rounded-[2rem] border border-gray-200 p-6 shadow-sm">
                    <div className="mb-5 pb-3 border-b border-gray-100 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <i className="fas fa-layer-group text-primary"></i>
                        Danh sách gói biến thể ({editProductOpen && editForm ? editForm.variants.length : (viewProductDetails.packageVariants || []).length})
                      </h3>
                      {editProductOpen && editForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(f => f ? {
                              ...f,
                              variants: [...f.variants, { variantName: '', description: '', price: 0, imageUrls: [], primaryImageIndex: 0, swaps: [] }]
                            } : f);
                          }}
                          className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary text-white hover:opacity-90 transition"
                        >
                          + Thêm gói
                        </button>
                      )}
                    </div>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      {(() => {
                        const isEditing = !!(editProductOpen && editForm);
                        const variantsForRender: any[] = isEditing ? editForm!.variants : (viewProductDetails.packageVariants || []);

                        if (!variantsForRender || variantsForRender.length === 0) {
                          return (
                            <div className="text-center py-8 bg-gray-50 rounded-[1.5rem] border border-dashed border-gray-200">
                              <p className="text-xl mb-2 opacity-30">📦</p>
                              <p className="text-black text-sm font-medium">Sản phẩm này chưa có biến thể nào.</p>
                            </div>
                          );
                        }

                        return variantsForRender.map((v: any, idx: number) => {
                          const viewV = (viewProductDetails.packageVariants || [])[idx];
                          const name = isEditing ? (v.variantName || '') : (v.variantName || '');
                          const price = isEditing ? Number(v.price || 0) : Number(v.price || 0);
                          const desc = isEditing ? (v.description || '') : (v.description || '');
                          const imageUrls: string[] = Array.isArray(v.imageUrls) ? v.imageUrls : [];
                          const primaryIdx: number = typeof v.primaryImageIndex === 'number' ? v.primaryImageIndex : 0;

                          return (
                            <div key={(isEditing ? `edit-${idx}` : (v.variantId || v.id || idx))} className={`rounded-[1.5rem] border p-5 transition-all ${isEditing ? 'border-primary/30 bg-primary/5' : 'border-gray-100 bg-gray-50 hover:bg-white hover:shadow-md hover:border-gray-200'}`}>
                              <div className="flex items-start justify-between gap-4 mb-3 border-b border-gray-100 pb-3">
                                <div className="flex-1 min-w-0">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={name}
                                      onChange={e => {
                                        setEditForm(f => {
                                          if (!f) return f;
                                          const vars = [...f.variants];
                                          vars[idx] = { ...vars[idx], variantName: e.target.value };
                                          return { ...f, variants: vars };
                                        });
                                      }}
                                      className="w-full px-3 py-2 border-2 border-primary/30 rounded-xl text-sm font-bold text-gray-800 focus:border-primary focus:outline-none bg-white"
                                      placeholder="Tên gói..."
                                    />
                                  ) : (
                                    <p className="font-bold text-gray-800 text-base group-hover:text-primary transition-colors truncate">{name}</p>
                                  )}
                                </div>

                                <div className="text-right flex flex-col items-end shrink-0">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatCurrencyInput(Number.isFinite(price) ? price : 0)}
                                        onChange={e => {
                                          setEditForm(f => {
                                            if (!f) return f;
                                            const vars = [...f.variants];
                                            vars[idx] = { ...vars[idx], price: parseCurrencyInput(e.target.value) };
                                            return { ...f, variants: vars };
                                          });
                                        }}
                                        className="w-28 px-3 py-2 border-2 border-primary/30 rounded-xl text-sm font-bold text-primary focus:border-primary focus:outline-none bg-white text-right"
                                      />
                                      <span className="text-gray-500 text-sm font-bold">đ</span>
                                    </div>
                                  ) : (
                                    <p className="font-black text-primary text-lg">{price.toLocaleString('vi-VN')}đ</p>
                                  )}

                                  {!isEditing && viewV && (() => {
                                    const approval = viewProductDetails.approvalStatus || viewProductDetails.packageStatus || viewProductDetails.status || '';
                                    if (approval === 'Approved') return null;
                                    return (
                                      <span className={`inline-block mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${viewV.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-200 text-gray-600 border border-gray-300'}`}>
                                        {viewV.isActive ? 'Hoạt động' : 'Tạm ngừng'}
                                      </span>
                                    );
                                  })()}

                                  {isEditing && editForm && editForm.variants.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditForm(f => {
                                          if (!f) return f;
                                          const vars = f.variants.filter((_, i) => i !== idx);
                                          return { ...f, variants: vars };
                                        });
                                      }}
                                      className="mt-2 text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
                                    >
                                      Xóa gói
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing ? (
                                <>
                                  <input
                                    type="text"
                                    value={desc}
                                    onChange={e => {
                                      setEditForm(f => {
                                        if (!f) return f;
                                        const vars = [...f.variants];
                                        vars[idx] = { ...vars[idx], description: e.target.value };
                                        return { ...f, variants: vars };
                                      });
                                    }}
                                    className="w-full px-3 py-2 border-2 border-primary/30 rounded-xl text-sm text-gray-700 focus:border-primary focus:outline-none bg-white"
                                    placeholder="Mô tả gói..."
                                  />

                                  <div className="mt-4 rounded-xl border border-primary/20 bg-white/80 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách đổi món (Swaps)</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditForm((f) => {
                                            if (!f) return f;
                                            const vars = [...f.variants];
                                            const current = vars[idx] || { variantName: '', description: '', price: 0, imageUrls: [], primaryImageIndex: 0, swaps: [] as VariantSwap[] };
                                            const currentSwaps = Array.isArray(current.swaps) ? current.swaps : [];
                                            vars[idx] = { ...current, swaps: [...currentSwaps, createEmptySwap(currentSwaps.length + 1)] };
                                            return { ...f, variants: vars };
                                          });
                                        }}
                                        className="text-[10px] font-black text-primary border border-primary/30 rounded-full px-2 py-1 hover:bg-primary/5"
                                      >
                                        + Thêm swap
                                      </button>
                                    </div>

                                    {Array.isArray(v.swaps) && v.swaps.length > 0 ? (
                                      <div className="space-y-2">
                                        {v.swaps.map((swap: VariantSwap, sIdx: number) => (
                                          <div key={`edit-swap-${idx}-${sIdx}`} className="rounded-lg border border-gray-200 bg-white p-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <input
                                                type="text"
                                                value={swap.originalItemName}
                                                onChange={(e) => {
                                                  setEditForm((f) => {
                                                    if (!f) return f;
                                                    const vars = [...f.variants];
                                                    const current = vars[idx];
                                                    const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                                    swaps[sIdx] = { ...swaps[sIdx], originalItemName: e.target.value };
                                                    vars[idx] = { ...current, swaps };
                                                    return { ...f, variants: vars };
                                                  });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                                placeholder="Món gốc"
                                              />
                                              <input
                                                type="text"
                                                value={swap.replacementItemName}
                                                onChange={(e) => {
                                                  setEditForm((f) => {
                                                    if (!f) return f;
                                                    const vars = [...f.variants];
                                                    const current = vars[idx];
                                                    const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                                    swaps[sIdx] = { ...swaps[sIdx], replacementItemName: e.target.value };
                                                    vars[idx] = { ...current, swaps };
                                                    return { ...f, variants: vars };
                                                  });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                                placeholder="Món thay thế"
                                              />
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                value={formatCurrencyInput(swap.originalItemAllocatedPrice)}
                                                onChange={(e) => {
                                                  setEditForm((f) => {
                                                    if (!f) return f;
                                                    const vars = [...f.variants];
                                                    const current = vars[idx];
                                                    const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                                    swaps[sIdx] = { ...swaps[sIdx], originalItemAllocatedPrice: parseCurrencyInput(e.target.value) };
                                                    vars[idx] = { ...current, swaps };
                                                    return { ...f, variants: vars };
                                                  });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                                placeholder="Giá món gốc"
                                              />
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  value={formatCurrencyInput(swap.surcharge)}
                                                  onChange={(e) => {
                                                    setEditForm((f) => {
                                                      if (!f) return f;
                                                      const vars = [...f.variants];
                                                      const current = vars[idx];
                                                      const swaps = Array.isArray(current?.swaps) ? [...current.swaps] : [];
                                                      swaps[sIdx] = { ...swaps[sIdx], surcharge: parseCurrencyInput(e.target.value) };
                                                      vars[idx] = { ...current, swaps };
                                                      return { ...f, variants: vars };
                                                    });
                                                  }}
                                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-primary focus:outline-none"
                                                  placeholder="Phụ thu"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditForm((f) => {
                                                      if (!f) return f;
                                                      const vars = [...f.variants];
                                                      const current = vars[idx];
                                                      const swaps = Array.isArray(current?.swaps) ? current.swaps.filter((_, i) => i !== sIdx) : [];
                                                      vars[idx] = {
                                                        ...current,
                                                        swaps: swaps.map((s, i) => ({ ...s, displayOrder: i + 1 })),
                                                      };
                                                      return { ...f, variants: vars };
                                                    });
                                                  }}
                                                  className="shrink-0 px-2 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-black hover:bg-red-50"
                                                >
                                                  Xóa
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg px-3 py-2 bg-white">Chưa có swap nào cho gói này.</div>
                                    )}
                                  </div>

                                  <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hình ảnh gói</label>
                                      <label className={`text-[10px] font-bold text-white px-3 py-1 rounded-full cursor-pointer transition ${uploadingVariantIndex === idx ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'}`}>
                                        {uploadingVariantIndex === idx ? ' Đang tải...' : 'Tải ảnh lên'}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          className="hidden"
                                          disabled={uploadingVariantIndex === idx}
                                          onChange={async (e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (!files.length) return;
                                            setUploadingVariantIndex(idx);
                                            try {
                                              const urls = await packageService.uploadVariantImages(files);
                                              setEditForm(f => {
                                                if (!f) return f;
                                                const vars = [...f.variants];
                                                const current = vars[idx] || { variantName: '', description: '', price: 0, imageUrls: [], primaryImageIndex: 0, swaps: [] };
                                                const nextUrls = [...(current.imageUrls || []), ...urls];
                                                vars[idx] = { ...current, imageUrls: nextUrls, primaryImageIndex: typeof current.primaryImageIndex === 'number' ? current.primaryImageIndex : 0 };
                                                return { ...f, variants: vars };
                                              });
                                            } catch (err) {
                                              toast.error('Lỗi upload ảnh biến thể: ' + (err instanceof Error ? err.message : 'Unknown'));
                                            } finally {
                                              setUploadingVariantIndex(null);
                                              e.target.value = '';
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>

                                    {imageUrls.length === 0 ? (
                                      <div className="text-xs text-gray-400 italic bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">Chưa có ảnh</div>
                                    ) : (
                                      <div className="grid grid-cols-4 gap-2">
                                        {imageUrls.map((url, i) => (
                                          <div key={url + i} className="relative group">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditForm(f => {
                                                  if (!f) return f;
                                                  const vars = [...f.variants];
                                                  const current = vars[idx];
                                                  if (!current) return f;
                                                  const safe = i >= 0 && i < (current.imageUrls || []).length ? i : 0;
                                                  vars[idx] = { ...current, primaryImageIndex: safe };
                                                  return { ...f, variants: vars };
                                                });
                                              }}
                                              className={`w-full rounded-xl overflow-hidden border-2 transition ${primaryIdx === i ? 'border-primary shadow-md' : 'border-gray-200 hover:border-primary/40'}`}
                                              title={primaryIdx === i ? 'Ảnh đại diện của gói' : 'Chọn làm ảnh đại diện của gói'}
                                            >
                                              <img src={toImageSrc(url)} className="w-full h-16 object-cover" />
                                            </button>
                                            {primaryIdx === i && (
                                              <div className="absolute top-1 left-1 bg-primary text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">★</div>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditForm(f => {
                                                  if (!f) return f;
                                                  const vars = [...f.variants];
                                                  const current = vars[idx];
                                                  if (!current) return f;
                                                  const nextUrls = (current.imageUrls || []).filter((_, j) => j !== i);
                                                  const currentPrimary = typeof current.primaryImageIndex === 'number' ? current.primaryImageIndex : 0;
                                                  const nextPrimary = nextUrls.length === 0 ? 0 : Math.min(currentPrimary, nextUrls.length - 1);
                                                  vars[idx] = { ...current, imageUrls: nextUrls, primaryImageIndex: nextPrimary };
                                                  return { ...f, variants: vars };
                                                });
                                              }}
                                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition"
                                              aria-label="Xóa ảnh"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                  </div>
                                </>
                              ) : (
                                <>
                                  {desc && (
                                    <p className="text-sm text-slate-600 bg-white p-3.5 rounded-xl border border-gray-100 italic leading-relaxed shadow-sm">{desc}</p>
                                  )}

                                  {(() => {
                                    const raw = (v as any).variantImages ?? (v as any).variantImageUrls ?? (v as any).imageUrls ?? (v as any).images ?? [];
                                    const rawUrls = Array.isArray(raw)
                                      ? raw.map((it: any) => String((it && typeof it === 'object') ? (it.imageUrl || it.url || '') : it)).filter((u: string) => u.trim())
                                      : [];
                                    const single = String((v as any).imageUrl || '').trim();
                                    const urls = Array.from(new Set([single, ...rawUrls])).filter((u) => String(u || '').trim());
                                    const primary = typeof (v as any).primaryVariantImageIndex === 'number' ? Number((v as any).primaryVariantImageIndex) : 0;
                                    const primaryIdx = primary >= 0 && primary < urls.length ? primary : 0;

                                    if (urls.length === 0) return null;

                                    return (
                                      <div className="mt-4">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Ảnh gói</p>
                                        <div className="grid grid-cols-5 gap-2">
                                          {urls.map((url: string, i: number) => (
                                            <div key={url + i} className="relative">
                                              <button
                                                type="button"
                                                className="block w-full"
                                                onClick={() => {
                                                  setImageModalImages(urls.map((u) => toImageSrc(u)));
                                                  setImageModalInitialIndex(i);
                                                  setImageModalAltText(`Ảnh gói - ${name || 'Biến thể'}`);
                                                  setIsImageModalOpen(true);
                                                }}
                                                aria-label="Xem ảnh gói"
                                              >
                                                <img
                                                  src={toImageSrc(url)}
                                                  className={`w-full h-16 object-cover rounded-xl border transition ${i === primaryIdx ? 'border-primary shadow-sm' : 'border-gray-200 hover:border-primary/40'}`}
                                                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackProductImage; }}
                                                />
                                              </button>
                                              {i === primaryIdx && (
                                                <div className="absolute top-1 left-1 bg-primary text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">★</div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Product Image Card */}
                  <div className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm">
                    {/* Primary image display */}
                    <div className="w-full aspect-square relative rounded-t-[2rem] overflow-hidden">
                      {(() => {
                        const primarySrc = editProductOpen && editForm
                          ? (editForm.packageImageUrls[editForm.primaryImageIndex] || editForm.packageImageUrls[0] || '')
                          : (viewProductDetails.imageUrls && viewProductDetails.imageUrls.length > 0 ? (viewProductDetails.imageUrls[viewDisplayImageIndex] || viewProductDetails.imageUrls[0]) : viewProductDetails.imageUrl);
                        return primarySrc ? (
                          <img
                            src={primarySrc}
                            alt={viewProductDetails.packageName}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = fallbackProductImage; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                            <i className="fas fa-image text-5xl mb-3 opacity-40"></i>
                            <span className="text-sm font-medium text-gray-400">Chưa có ảnh sản phẩm</span>
                          </div>
                        );
                      })()}
                      {editProductOpen && editForm && (
                        <div className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                          Ảnh đại diện
                        </div>
                      )}
                      {!editProductOpen && viewProductDetails.imageUrls && viewProductDetails.imageUrls.length > 0 && viewDisplayImageIndex === (viewProductDetails.primaryImageIndex || 0) && (
                        <div className="absolute top-4 left-4 bg-yellow-400 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
                          ★ Ảnh đại diện
                        </div>
                      )}
                    </div>

                    {/* View mode: multi-image thumbnail list */}
                    {!editProductOpen && viewProductDetails.imageUrls && viewProductDetails.imageUrls.length > 1 && (
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 overflow-x-auto custom-scrollbar">
                        {viewProductDetails.imageUrls.map((url: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setViewDisplayImageIndex(idx)}
                            className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${viewDisplayImageIndex === idx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                              }`}
                          >
                            <img src={url} alt={`thumb-${idx}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallbackProductImage; }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Edit mode: multi-image URL list */}
                    {editProductOpen && editForm && (
                      <div className="p-4 border-t border-gray-100 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách ảnh</label>
                          <label className={`text-xs font-bold text-white px-3 py-1 rounded-full cursor-pointer transition ${uploadingImages ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'}`}>
                            {uploadingImages ? ' Đang tải...' : 'Tải ảnh lên'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={uploadingImages}
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (!files.length || !editForm) return;
                                setUploadingImages(true);
                                try {
                                  const urls = await packageService.uploadPackageImages(files);
                                  setEditForm(f => f ? { ...f, packageImageUrls: [...f.packageImageUrls, ...urls] } : f);
                                } catch (err) {
                                  toast.error('Lỗi upload ảnh: ' + (err instanceof Error ? err.message : 'Unknown'));
                                } finally {
                                  setUploadingImages(false);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>
                        {editForm.packageImageUrls.length === 0 ? (
                          <div className="w-full h-28 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                            <i className="fas fa-image text-3xl mb-1 opacity-40"></i>
                            <span className="text-xs text-gray-400">Chưa có ảnh</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {editForm.packageImageUrls.map((url, i) => (
                              <div key={i} className="relative group">
                                <img
                                  src={url}
                                  alt={`preview-${i}`}
                                  className={`w-20 h-20 object-cover rounded-2xl border-2 transition ${editForm.primaryImageIndex === i ? 'border-yellow-400 shadow-md' : 'border-gray-200'
                                    }`}
                                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackProductImage; }}
                                />
                                <div className="absolute inset-0 flex gap-1 items-start justify-end p-1 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => setEditForm(f => f ? { ...f, primaryImageIndex: i } : f)}
                                    title="Đặt làm ảnh đại diện"
                                    className={`w-5 h-5 rounded-full text-xs flex items-center justify-center shadow ${editForm.primaryImageIndex === i ? 'bg-yellow-400 text-white' : 'bg-white text-gray-400 hover:bg-yellow-100'
                                      }`}
                                  >★</button>
                                  <button
                                    onClick={() => {
                                      const urls = editForm.packageImageUrls.filter((_, idx) => idx !== i);
                                      const newPrimary = editForm.primaryImageIndex >= urls.length ? Math.max(0, urls.length - 1) : editForm.primaryImageIndex === i ? 0 : editForm.primaryImageIndex > i ? editForm.primaryImageIndex - 1 : editForm.primaryImageIndex;
                                      setEditForm(f => f ? { ...f, packageImageUrls: urls, primaryImageIndex: newPrimary } : f);
                                    }}
                                    className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
                                  >×</button>
                                </div>
                                {editForm.primaryImageIndex === i && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-yellow-400 text-white text-[9px] font-black text-center rounded-b-xl">CHÍNH</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary Details */}
                  <div className="bg-white rounded-[2rem] border border-gray-200 p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
                      <i className="fas fa-info-circle text-primary"></i> Tóm tắt thông tin
                    </h3>
                    <div className="space-y-4 text-sm relative z-10">
                      <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                        <span className="text-gray-500 font-semibold">Ngày khởi tạo</span>
                        <span className="font-bold text-gray-800 bg-gray-50 px-3 py-1.5 rounded-xl">{viewProductDetails.createdAt ? new Date(viewProductDetails.createdAt).toLocaleString('vi-VN') : '0'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-gray-500 font-semibold">Số lượng đã bán</span>
                        <span className="font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-xl">{viewProductDetails.totalSold || 0} đơn hàng</span>
                      </div>
                      {/* <div className="flex justify-between items-center pb-1">
                        <span className="text-gray-500 font-semibold">Người xét duyệt</span>
                        <span className="font-bold text-gray-800">{viewProductDetails.approvedBy || 'Hệ thống tự động'}</span>
                      </div> */}
                    </div>
                  </div>

                  {/* Rejection Notice if applicable */}
                  {viewProductDetails.rejectionReason && (
                    <div className="bg-white rounded-[2rem] border-2 border-red-200 p-6 shadow-sm overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 rounded-bl-full shadow-inner flex justify-end items-start p-3">
                        <i className="fas fa-times text-red-500 opacity-60"></i>
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-4 pb-3 border-b border-red-100">
                        Ý kiến phản hồi từ quản trị
                      </h3>
                      <div className="bg-red-50 p-4 rounded-[1.25rem] border border-red-100 relative z-10">
                        <p className="text-[11px] text-red-500 font-black uppercase tracking-widest mb-1.5 opacity-80">Lý do từ chối:</p>
                        <p className="text-sm text-red-800 font-semibold leading-relaxed">{viewProductDetails.rejectionReason}</p>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-4 italic">Vui lòng điều chỉnh thông tin sản phẩm và gửi yêu cầu phê duyệt lại.</p>
                    </div>
                  )}

                  {/* AI Screening Result */}
                  <div className="bg-white rounded-[2rem] border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <i className="fas fa-robot text-primary"></i>
                        Gợi ý từ AI
                      </h3>
                      <button
                        type="button"
                        onClick={reloadAIScreening}
                        disabled={aiScreeningLoading}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {aiScreeningLoading ? 'Đang tải...' : 'Tải lại'}
                      </button>
                    </div>

                    {aiScreeningLoading ? (
                      <div className="text-sm text-gray-500">Đang tải đánh giá AI...</div>
                    ) : aiScreeningError ? (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                        {aiScreeningError}
                      </div>
                    ) : aiScreeningResult ? (
                      (() => {
                        const summary = getAISummary(aiScreeningResult);
                        const decisionInfo = mapAiDecisionLabel(summary.decision);
                        const reasoningTooLong = summary.reasoning.length > 260;
                        const visibleReasoning = aiReasonExpanded || !reasoningTooLong
                          ? summary.reasoning
                          : `${summary.reasoning.slice(0, 260)}...`;

                        return (
                          <div className="space-y-4 text-sm">
                            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <span className="text-black font-semibold">Kết luận</span>
                              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${decisionInfo.className}`}>
                                {decisionInfo.text}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <p className="text-black text-[11px] font-bold uppercase tracking-widest mb-2">Nhận xét chính</p>
                              <p className="text-slate-700 leading-relaxed break-words">
                                {visibleReasoning || 'Hiện chưa có mô tả từ AI.'}
                              </p>
                              {reasoningTooLong && (
                                <button
                                  type="button"
                                  onClick={() => setAiReasonExpanded((prev) => !prev)}
                                  className="mt-2 text-xs font-bold text-primary hover:underline"
                                >
                                  {aiReasonExpanded ? 'Thu gọn' : 'Xem thêm'}
                                </button>
                              )}
                            </div>

                            {summary.issues.length > 0 && (
                              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                <p className="text-amber-700 text-[11px] font-bold uppercase tracking-widest mb-2">Vấn đề cần sửa</p>
                                <ul className="space-y-1.5 text-slate-700">
                                  {summary.issues.slice(0, 3).map((issue: string, index: number) => (
                                    <li key={`issue-${index}`} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                      <span>{issue}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {summary.recommendations.length > 0 && (
                              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-blue-700 text-[11px] font-bold uppercase tracking-widest mb-2">Đề xuất cho bạn</p>
                                <ul className="space-y-1.5 text-slate-700">
                                  {summary.recommendations.slice(0, 3).map((recommendation: string, index: number) => (
                                    <li key={`recommendation-${index}`} className="flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                      <span>{recommendation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-black text-[11px] font-bold uppercase tracking-widest">Cần duyệt thủ công</p>
                                <p className="font-bold text-slate-800 mt-1">
                                  {summary.requiresManualReview === null ? 'Chưa rõ' : summary.requiresManualReview ? 'Có' : 'Không'}
                                </p>
                              </div>

                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-black text-[11px] font-bold uppercase tracking-widest">Độ tin cậy</p>
                                <p className="font-bold text-slate-800 mt-1">
                                  {summary.confidenceScore === null ? 'Chưa có' : `${summary.confidenceScore}`}
                                </p>
                              </div>

                              {summary.screenedAt && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:col-span-2">
                                  <p className="text-black text-[11px] font-bold uppercase tracking-widest">Thời điểm AI quét</p>
                                  <p className="font-semibold text-slate-800 mt-1">{new Date(summary.screenedAt).toLocaleString('vi-VN')}</p>
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-sm text-gray-500">Gói này chưa có kết quả đánh giá AI.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <ImageModal
          isOpen={isImageModalOpen}
          images={imageModalImages}
          initialIndex={imageModalInitialIndex}
          imageSrc={imageModalImages[imageModalInitialIndex] || ''}
          altText={imageModalAltText}
          onClose={() => setIsImageModalOpen(false)}
        />

      </div>
    </div>
  );
};

export default ProductManagement;
