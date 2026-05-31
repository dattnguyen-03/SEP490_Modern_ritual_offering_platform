import React, { useState, useEffect } from 'react';
import { getProfile, getVendorProfile, UserProfile, VendorCurrentProfile, updateProfile, UpdateProfileRequest } from '../../services/auth';
import { geocodingService } from '../../services/geocodingService';
import {
  Province,
  District,
  Ward,
  getProvinces,
  getDistrictsByProvince,
  getWardsByDistrict,
  getWardsByProvince,
} from '../../services/vietnamAddressApi';
import AddressMapPicker from '../../components/AddressMapPicker';

const DEFAULT_MAP_POSITION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

const normalizeAddressText = (value?: string | null): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(tinh|thanh pho|quan|huyen|phuong|xa|thi tran|thi xa|tp\.?|q\.?|p\.?)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const isNameMatch = (left?: string, right?: string): boolean => {
  const leftNorm = normalizeAddressText(left);
  const rightNorm = normalizeAddressText(right);
  if (!leftNorm || !rightNorm) return false;
  return leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm);
};

interface VendorShopProps {
  onNavigate: (path: string) => void;
}

const VendorShop: React.FC<VendorShopProps> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorCurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [formData, setFormData] = useState<UpdateProfileRequest & { shopDescription?: string; taxCode?: string }>({
    fullName: '',
    gender: 'Nam',
    phoneNumber: '',
    dateOfBirth: '',
    addressText: '',
    latitude: 0,
    longitude: 0,
    avatarFile: null,
    shopDescription: '',
    taxCode: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [coordinateLoading, setCoordinateLoading] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [isWardOnlyMode, setIsWardOnlyMode] = useState(false);
  const [detailedAddress, setDetailedAddress] = useState('');
  const [mapPreview, setMapPreview] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const [mapPreviewError, setMapPreviewError] = useState<string | null>(null);
  const [searchMapLoading, setSearchMapLoading] = useState(false);
  const [isCreatingNewAddress, setIsCreatingNewAddress] = useState(false);

  const currentShopAddress = (vendorProfile?.shopAddressText || profile?.addressText || '').trim();
  const currentShopLatitude = vendorProfile?.shopLatitude ?? profile?.latitude ?? 0;
  const currentShopLongitude = vendorProfile?.shopLongitude ?? profile?.longitude ?? 0;

  const mapPickerPosition = mapPreview ?? {
    latitude: Number(formData.latitude) || DEFAULT_MAP_POSITION.latitude,
    longitude: Number(formData.longitude) || DEFAULT_MAP_POSITION.longitude,
  };

  // Fetch profile data on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const [profileData, vendorData] = await Promise.all([
          getProfile(),
          getVendorProfile().catch(() => null),
        ]);

        setProfile(profileData);
        setVendorProfile(vendorData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Update form data when profile is loaded
  useEffect(() => {
    if (profile) {
      try {
        // Safe date formatting
        let formattedDate = '';
        if (profile.dateOfBirth) {
          const dateStr = profile.dateOfBirth.toString();
          if (dateStr.includes('T')) {
            formattedDate = dateStr.split('T')[0];
          } else if (dateStr.length >= 10) {
            formattedDate = dateStr.substring(0, 10);
          } else {
            formattedDate = dateStr;
          }
        }

        setFormData({
          fullName: profile.fullName || '',
          gender: profile.gender || 'Nam',
          phoneNumber: profile.phoneNumber || '',
          dateOfBirth: formattedDate,
          addressText: currentShopAddress,
          latitude: currentShopLatitude,
          longitude: currentShopLongitude,
          avatarFile: null,
          shopDescription: vendorProfile?.shopDescription || 'Chuyên cung cấp mâm cúng trọn gói chất lượng cao với các dịch vụ tư vấn miễn phí.',
          taxCode: vendorProfile?.taxCode || profile.businessLicenseNo || ''
        });
      } catch (error) {
        console.error('Error updating form data:', error);
        // Set default values if there's an error
        setFormData({
          fullName: profile?.fullName || '',
          gender: profile?.gender || 'Nam',
          phoneNumber: profile?.phoneNumber || '',
          dateOfBirth: '',
          addressText: currentShopAddress,
          latitude: currentShopLatitude,
          longitude: currentShopLongitude,
          avatarFile: null,
          shopDescription: vendorProfile?.shopDescription || 'Chuyên cung cấp mâm cúng trọn gói chất lượng cao.',
          taxCode: vendorProfile?.taxCode || profile?.businessLicenseNo || ''
        });
      }
    }
  }, [profile, vendorProfile]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLoadingProvinces(true);
        const provinceList = await getProvinces();
        setProvinces(provinceList);
      } catch (error) {
        console.error('Failed to load provinces:', error);
      } finally {
        setLoadingProvinces(false);
      }
    };

    loadProvinces();
  }, []);

  useEffect(() => {
    if (!profile) return;

    setDetailedAddress(currentShopAddress.split(',')[0]?.trim() || currentShopAddress || '');
    if (currentShopLatitude && currentShopLongitude) {
      setMapPreview({ latitude: currentShopLatitude, longitude: currentShopLongitude });
    }
  }, [profile, vendorProfile]);

  useEffect(() => {
    if (!showUpdateModal) return;
    setIsCreatingNewAddress(false);
    setMapPreviewError(null);
  }, [showUpdateModal]);

  useEffect(() => {
    if (!profile || provinces.length === 0 || selectedProvince) return;

    const hydrateAddressSelections = async () => {
      const parts = (profile.addressText || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      const provinceHint = parts.length > 0 ? parts[parts.length - 1] : undefined;
      const districtHint = parts.length > 1 ? parts[parts.length - 2] : undefined;
      const wardHint = parts.length > 2 ? parts[parts.length - 3] : undefined;

      let resolvedProvinceName = provinceHint;
      let resolvedDistrictName = districtHint;
      let resolvedWardName = wardHint;

      if ((!resolvedProvinceName || !resolvedDistrictName) && profile.latitude && profile.longitude) {
        const reverseData = await geocodingService.reverseGeocodeDetails(profile.latitude, profile.longitude);
        resolvedProvinceName = resolvedProvinceName || reverseData?.provinceName;
        resolvedDistrictName = resolvedDistrictName || reverseData?.districtName;
        resolvedWardName = resolvedWardName || reverseData?.wardName;
      }

      const matchedProvince = findProvinceByReverse(resolvedProvinceName);
      if (!matchedProvince) return;

      setSelectedProvince(matchedProvince.code);
      const districtList = await getDistrictsByProvince(matchedProvince.code);
      setDistricts(districtList);

      const matchedDistrict = findDistrictByReverse(resolvedDistrictName, districtList);
      if (!matchedDistrict) return;

      setSelectedDistrict(matchedDistrict.code);
      const wardList = await getWardsByDistrict(matchedDistrict.code);
      setWards(wardList);

      const matchedWard = findWardByReverse(resolvedWardName, wardList);
      if (matchedWard) {
        setSelectedWard(matchedWard.code);
      }
    };

    hydrateAddressSelections().catch((error) => {
      console.error('Failed to hydrate vendor address selections:', error);
    });
  }, [profile, provinces, selectedProvince]);

  useEffect(() => {
    if (!selectedProvince) {
      setDistricts([]);
      setSelectedDistrict(null);
      setWards([]);
      setSelectedWard(null);
      setIsWardOnlyMode(false);
      return;
    }

    const loadDistricts = async () => {
      try {
        setLoadingDistricts(true);
        const districtList = await getDistrictsByProvince(selectedProvince);
        setDistricts(districtList);
        if (districtList.length === 0) {
          setIsWardOnlyMode(true);
          setLoadingWards(true);
          const provinceWards = await getWardsByProvince(selectedProvince);
          setWards(provinceWards);
          setSelectedDistrict(null);
          setSelectedWard(null);
        } else {
          setIsWardOnlyMode(false);
          setWards([]);
          setSelectedWard(null);
        }
      } catch (error) {
        console.error('Failed to load districts:', error);
        setDistricts([]);
      } finally {
        setLoadingDistricts(false);
        setLoadingWards(false);
      }
    };

    loadDistricts();
  }, [selectedProvince]);

  useEffect(() => {
    if (isWardOnlyMode) {
      return;
    }

    if (!selectedDistrict) {
      setWards([]);
      setSelectedWard(null);
      return;
    }

    const loadWards = async () => {
      try {
        setLoadingWards(true);
        const wardList = await getWardsByDistrict(selectedDistrict);
        setWards(wardList);
      } catch (error) {
        console.error('Failed to load wards:', error);
        setWards([]);
      } finally {
        setLoadingWards(false);
      }
    };

    loadWards();
  }, [selectedDistrict, isWardOnlyMode]);

  const displayShopName = (vendorProfile?.shopName || profile?.shopName || '').trim() || 'Chưa có tên cửa hàng';

  // Handle form input changes
  const handleInputChange = (field: string, value: string | number | File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const findProvinceByReverse = (provinceName?: string): Province | undefined => {
    return provinces.find((province) =>
      isNameMatch(provinceName, province.name) || isNameMatch(provinceName, province.full_name)
    );
  };

  const findDistrictByReverse = (districtName: string | undefined, districtList: District[]): District | undefined => {
    return districtList.find((district) =>
      isNameMatch(districtName, district.name) || isNameMatch(districtName, district.full_name)
    );
  };

  const findWardByReverse = (wardName: string | undefined, wardList: Ward[]): Ward | undefined => {
    return wardList.find((ward) =>
      isNameMatch(wardName, ward.name) || isNameMatch(wardName, ward.full_name)
    );
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setMapPreviewError('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }

    try {
      setMapPreviewLoading(true);
      setMapPreviewError(null);

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      setMapPreview({ latitude, longitude });
      setFormData((prev) => ({ ...prev, latitude, longitude }));

      const reverseAddress = await geocodingService.reverseGeocode(latitude, longitude);
      if (reverseAddress) {
        setDetailedAddress(reverseAddress.split(',')[0]?.trim() || reverseAddress);
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
      setMapPreviewError('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí.');
    } finally {
      setMapPreviewLoading(false);
    }
  };

  const handleMapPositionChange = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    setMapPreview({ latitude, longitude });
    setMapPreviewError(null);
    setFormData((prev) => ({ ...prev, latitude, longitude }));
  };

  const resetAddressInputsForNew = () => {
    setIsCreatingNewAddress(true);
    setSelectedProvince(null);
    setSelectedDistrict(null);
    setSelectedWard(null);
    setDistricts([]);
    setWards([]);
    setDetailedAddress('');
    setMapPreview(null);
    setMapPreviewError(null);
    setFormData((prev) => ({
      ...prev,
      addressText: '',
      latitude: 0,
      longitude: 0,
    }));
  };

  const restoreAddressFromProfile = () => {
    setIsCreatingNewAddress(false);
    setMapPreviewError(null);
    if (!profile) return;

    setDetailedAddress(currentShopAddress.split(',')[0]?.trim() || currentShopAddress || '');
    setFormData((prev) => ({
      ...prev,
      addressText: currentShopAddress,
      latitude: currentShopLatitude,
      longitude: currentShopLongitude,
    }));

    if (currentShopLatitude && currentShopLongitude) {
      setMapPreview({ latitude: currentShopLatitude, longitude: currentShopLongitude });
    } else {
      setMapPreview(null);
    }
  };

  const handleSearchOnMap = async () => {
    const selectedProvinceName = provinces.find((p) => p.code === selectedProvince)?.name;
    const selectedDistrictName = districts.find((d) => d.code === selectedDistrict)?.name;
    const selectedWardName = wards.find((w) => w.code === selectedWard)?.name;

    if (!selectedProvinceName || (!selectedDistrictName && !isWardOnlyMode)) {
      setMapPreviewError('Vui lòng chọn Tỉnh/Thành phố và Quận/Huyện trước khi tìm trên bản đồ.');
      return;
    }

    if (!detailedAddress.trim()) {
      setMapPreviewError('Vui lòng nhập địa chỉ chi tiết trước khi tìm trên bản đồ.');
      return;
    }

    try {
      setSearchMapLoading(true);
      setMapPreviewError(null);

      const geoResult = await geocodingService.geocodeAddressComponents({
        detailedAddress: detailedAddress.trim(),
        wardName: selectedWardName,
        districtName: selectedDistrictName || undefined,
        provinceName: selectedProvinceName,
      });

      if (!geoResult) {
        setMapPreviewError('Không tìm thấy vị trí phù hợp. Bạn thử nhập chi tiết hơn nhé.');
        return;
      }

      setMapPreview({
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
      });
      setFormData((prev) => ({
        ...prev,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
      }));
    } catch (error) {
      console.error('Failed to search address on map:', error);
      setMapPreviewError('Không thể tìm vị trí trên bản đồ lúc này. Vui lòng thử lại.');
    } finally {
      setSearchMapLoading(false);
    }
  };

  const handleConfirmMapSelection = async () => {
    const targetLat = mapPickerPosition.latitude;
    const targetLng = mapPickerPosition.longitude;

    try {
      setCoordinateLoading(true);
      setMapPreviewError(null);

      const reverseData = await geocodingService.reverseGeocodeDetails(targetLat, targetLng);

      const matchedProvince = findProvinceByReverse(reverseData?.provinceName);
      let matchedDistrict: District | undefined;
      let matchedWard: Ward | undefined;

      if (matchedProvince) {
        setSelectedProvince(matchedProvince.code);
        const provinceDistricts = await getDistrictsByProvince(matchedProvince.code);
        setDistricts(provinceDistricts);
        if (provinceDistricts.length === 0) {
          setIsWardOnlyMode(true);
          const provinceWards = await getWardsByProvince(matchedProvince.code);
          setWards(provinceWards);
          matchedWard = findWardByReverse(reverseData?.wardName, provinceWards);
          if (matchedWard) {
            setSelectedWard(matchedWard.code);
          }
        } else {
          setIsWardOnlyMode(false);
          matchedDistrict = findDistrictByReverse(reverseData?.districtName, provinceDistricts);
          if (matchedDistrict) {
            setSelectedDistrict(matchedDistrict.code);
            const districtWards = await getWardsByDistrict(matchedDistrict.code);
            setWards(districtWards);

            matchedWard = findWardByReverse(reverseData?.wardName, districtWards);
            if (matchedWard) {
              setSelectedWard(matchedWard.code);
            }
          }
        }
      }

      const nextDetailedAddress =
        reverseData?.detailedAddress ||
        reverseData?.formattedAddress.split(',')[0]?.trim() ||
        detailedAddress ||
        'Địa điểm đã chọn trên bản đồ';

      const provinceText = matchedProvince?.name || reverseData?.provinceName || '';
      const districtText = matchedDistrict?.name || reverseData?.districtName || '';
      const wardText = matchedWard?.name || reverseData?.wardName || '';
      const composedAddressText = [nextDetailedAddress, wardText, districtText, provinceText]
        .filter(Boolean)
        .join(', ');

      setDetailedAddress(nextDetailedAddress);
      setMapPreview({ latitude: targetLat, longitude: targetLng });
      setFormData((prev) => ({
        ...prev,
        latitude: targetLat,
        longitude: targetLng,
        addressText: composedAddressText || reverseData?.formattedAddress || prev.addressText,
      }));
    } catch (error) {
      console.error('Failed to confirm map selection:', error);
      setMapPreviewError('Không thể xác nhận vị trí trên bản đồ. Vui lòng thử lại.');
    } finally {
      setCoordinateLoading(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setUpdateLoading(true);

      if (isCreatingNewAddress && (!selectedProvince || (!selectedDistrict && !isWardOnlyMode) || !detailedAddress.trim())) {
        alert('Vui lòng nhập đầy đủ địa chỉ mới (Tỉnh/Thành phố, Quận/Huyện, địa chỉ chi tiết).');
        return;
      }

      // Only send fields that exist in API
      const selectedProvinceName = provinces.find((p) => p.code === selectedProvince)?.name;
      const selectedDistrictName = districts.find((d) => d.code === selectedDistrict)?.name;
      const selectedWardName = wards.find((w) => w.code === selectedWard)?.name;

      let finalLatitude = formData.latitude;
      let finalLongitude = formData.longitude;

      if (isCreatingNewAddress && selectedProvinceName && (selectedDistrictName || isWardOnlyMode)) {
        const geoResult = await geocodingService.geocodeAddressComponents({
          detailedAddress: detailedAddress?.trim() || undefined,
          wardName: selectedWardName,
          districtName: selectedDistrictName || undefined,
          provinceName: selectedProvinceName,
        });

        if (geoResult) {
          finalLatitude = geoResult.latitude;
          finalLongitude = geoResult.longitude;
        }
      }

      const composedAddressText = isCreatingNewAddress
        ? [detailedAddress?.trim(), selectedWardName, selectedDistrictName, selectedProvinceName]
          .filter(Boolean)
          .join(', ')
        : profile?.addressText || formData.addressText;

      const apiData: UpdateProfileRequest = {
        fullName: formData.fullName,
        gender: formData.gender,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        addressText: composedAddressText || formData.addressText,
        latitude: finalLatitude,
        longitude: finalLongitude,
        avatarFile: formData.avatarFile
      };

      const updatedProfile = await updateProfile(apiData);

      // Update profile state safely
      setProfile(updatedProfile);
      setShowUpdateModal(false);

      // Show success message then reload
      alert('Cập nhật thông tin thành công!');
      window.location.reload();

    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('❌ Cập nhật thất bại: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
    } finally {
      setUpdateLoading(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange('avatarFile', file);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ritual-bg via-white to-gold/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-primary">Đang tải thông tin cửa hàng...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ritual-bg via-white to-gold/5 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-primary mb-4">Không thể tải thông tin</h2>
          <p className="text-gray-600 mb-6">{error || 'Không tìm thấy thông tin cửa hàng'}</p>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                Promise.all([
                  getProfile(),
                  getVendorProfile().catch(() => null),
                ])
                  .then(([profileData, vendorData]) => {
                    setProfile(profileData);
                    setVendorProfile(vendorData);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải thông tin cửa hàng'))
                  .finally(() => setLoading(false));
              }}
              className="px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-all"
            >
              Tải lại
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border-2 border-primary text-primary rounded-lg font-bold hover:bg-primary/5 transition-all"
            >
              Refresh Trang
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    // { label: 'Sản phẩm', value: 24, icon: 'shopping_bag' },
    // { label: 'Đơn hàng', value: 284, icon: 'shopping_cart' },
    // { label: 'Đánh giá', value: `${profile?.ratingAvg || 0}/5`, icon: 'star' },
    // { label: 'Người theo dõi', value: '1.2K', icon: 'people' },
  ];

  const products = [
    { id: 1, name: 'Mâm cúng Tết Truyền Thống', price: 1200000, image: '', sold: 45 },
    { id: 2, name: 'Mâm cúng Khai Trương', price: 2500000, image: '', sold: 32 },
    { id: 3, name: 'Mâm cúng Tân Gia', price: 1850000, image: '', sold: 28 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-ritual-bg via-white to-gold/5">
      {/* Shop Header */}
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="relative mt-8 mb-12">
          <div className="bg-white rounded-3xl border-2 border-gold/20 shadow-lg p-8 md:p-12">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {(vendorProfile?.shopAvatarUrl || vendorProfile?.avatarUrl || profile?.avatarUrl) ? (
                  <img
                    src={vendorProfile?.shopAvatarUrl || vendorProfile?.avatarUrl || profile?.avatarUrl || ''}
                    alt={displayShopName || 'Shop avatar'}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-gold/30 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
                    }}
                  />
                ) : null}
                <div
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-gold/20 border-4 border-gold/30 shadow-md flex items-center justify-center text-5xl"
                  style={{ display: (vendorProfile?.shopAvatarUrl || vendorProfile?.avatarUrl || profile?.avatarUrl) ? 'none' : 'flex' }}
                >
                  🏪
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-playfair font-bold text-primary">
                    {displayShopName}
                  </h1>
                  {profile.verificationStatus === 'Verified' && (
                    <span className="text-gold text-xl">✓</span>
                  )}
                </div>
                <p className="text-gray-600 mb-4">Chủ cửa hàng: <span className="font-bold text-primary">{profile?.fullName || 'Chưa có tên'}</span></p>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <span className="text-gold text-lg">★</span>
                    <span className="font-bold text-primary">{vendorProfile?.ratingAvg ?? profile?.ratingAvg ?? 0}</span>
                    <span className="text-sm text-gray-500">(256 đánh giá)</span>
                  </div>
                  {/* <div className="flex items-center gap-1 text-gray-600">
                    <span className="text-sm">👥</span>
                    <span className="text-sm font-semibold">1234 người theo dõi</span>
                  </div> */}
                </div>
                <p className="text-sm text-gray-600">Hoạt động từ năm {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : 2022}</p>
              </div>
              <div className="flex gap-3 flex-col md:flex-row">
                <button
                  onClick={() => onNavigate('/vendor/products')}
                  className="px-6 py-3 border-2 border-primary text-primary rounded-lg font-bold hover:bg-primary/5 transition-all whitespace-nowrap"
                >
                  Xem Sản Phẩm
                </button>
                {/* <button className="px-6 py-3 border-2 border-gold text-gold rounded-lg font-bold hover:bg-gold/5 transition-all whitespace-nowrap">
                   Theo dõi
                </button> */}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gold/10 shadow-sm p-6 text-center hover:shadow-lg transition-all">
              <p className="text-xs font-bold uppercase text-gold tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-primary">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Shop Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Left: Description */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-8 mb-8">
              <h2 className="text-2xl font-bold text-primary mb-4">
                Thông Tin Cửa Hàng
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                {vendorProfile?.shopDescription || 'Cung cấp mâm cúng trọn gói chất lượng cao với các dịch vụ tư vấn miễn phí. Cam kết sử dụng nguyên liệu tươi sạch, tuân theo nghi lễ truyền thống.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gold/10">

                <div>
                  <p className="text-xs font-bold uppercase text-gold tracking-widest mb-2"> Liên Hệ & Địa Chỉ</p>
                  <div className="space-y-2">
                    <p className="text-gray-700">
                      <span className="font-bold text-primary">Địa chỉ:</span> {currentShopAddress || 'Chưa cập nhật địa chỉ'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-bold text-primary">Điện thoại:</span> {profile?.phoneNumber || 'Chưa có số điện thoại'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-bold text-primary">Email:</span> {profile?.userId || 'user'}@vietritual.com
                    </p>
                  </div>
                </div>
              </div>

              {profile?.businessLicenseNo && (
                <div className="mt-6 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>✓ Đã Xác Minh:</strong> ĐKKD: {profile.businessLicenseNo}
                  </p>
                </div>
              )}
            </div>

            {/* Products Preview */}
            {/* <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-primary">
                    Sản Phẩm Nổi Bật
                  </h2>
                  <button
                    onClick={() => onNavigate('/vendor/products')}
                    className="text-sm font-bold text-primary border-b-2 border-primary pb-1 hover:text-gold transition-colors"
                  >
                    Xem tất cả →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div key={product.id} className="border border-gold/10 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                      <div className="bg-gradient-to-br from-primary/10 to-gold/10 h-32 flex items-center justify-center text-5xl">
                        {product.image}
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-primary mb-2 line-clamp-2">{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-black text-gold">{(product.price / 1000000).toFixed(1)}M₫</p>
                          <p className="text-xs text-gray-500">Bán: {product.sold}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div> */}
          </div>

          {/* Right: Quick Actions */}
          <div className="space-y-4">
            {/* <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-6 text-center hover:shadow-lg transition-all">
              <div className="text-4xl text-gold mb-3 block"></div>
              <h3 className="font-bold text-primary mb-2">Quản Lý Cửa Hàng</h3>
              <p className="text-xs text-gray-600 mb-4">Chỉnh sửa thông tin và cài đặt</p>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="w-full px-4 py-2 border-2 border-primary text-primary rounded-lg font-bold text-sm hover:bg-primary/5 transition-all"
              >
                Cập Nhật
              </button>
            </div> */}

            <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-6 text-center hover:shadow-lg transition-all">
              <div className="text-4xl text-gold mb-3 block"></div>
              <h3 className="font-bold text-primary mb-2">Sản Phẩm Mới</h3>
              <p className="text-xs text-gray-600 mb-4">Thêm mâm cúng mới</p>
              <button
                onClick={() => onNavigate('/vendor/products')}
                className="w-full px-4 py-2 border-2 border-primary text-primary rounded-lg font-bold text-sm hover:bg-primary/5 transition-all"
              >
                Thêm
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-6 text-center hover:shadow-lg transition-all">
              <div className="text-4xl text-gold mb-3 block"></div>
              <h3 className="font-bold text-primary mb-2">Thống Kê</h3>
              <p className="text-xs text-gray-600 mb-4">Xem doanh số bán hàng</p>
              <button
                onClick={() => onNavigate('/vendor/analytics')}
                className="w-full px-4 py-2 border-2 border-primary text-primary rounded-lg font-bold text-sm hover:bg-primary/5 transition-all"
              >
                Xem
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-6 text-center hover:shadow-lg transition-all">
              <div className="text-4xl text-gold mb-3 block"></div>
              <h3 className="font-bold text-primary mb-2">Đơn Hàng</h3>
              <p className="text-xs text-gray-600 mb-4">Quản lý đơn hàng mới</p>
              <button
                onClick={() => onNavigate('/vendor/orders')}
                className="w-full px-4 py-2 border-2 border-primary text-primary rounded-lg font-bold text-sm hover:bg-primary/5 transition-all"
              >
                Xem
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {/* <div className="bg-white rounded-2xl border border-gold/10 shadow-sm p-8 mb-12">
          <h2 className="text-2xl font-bold text-primary mb-6">
            Đánh Giá Gần Đây
          </h2>
          <div className="space-y-4">
            {[
              { name: 'Trần Hương', rating: 5, comment: 'Mâm cúng rất đẹp, đúng như mô tả, giao hàng nhanh!' },
              { name: 'Lê Minh', rating: 5, comment: 'Chất lượng tuyệt vời, sẽ mua lại lần tới' },
              { name: 'Ngô Thúy', rating: 4, comment: 'Rất hài lòng với sản phẩm và dịch vụ' },
            ].map((review, idx) => (
              <div key={idx} className="p-4 bg-ritual-bg rounded-lg border border-gold/10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-primary">{review.name}</p>
                    <div className="flex gap-1">
                      {[...Array(review.rating)].map((_, i) => (
                        <span key={i} className="text-gold text-sm">★</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 text-sm">{review.comment}</p>
              </div>
            ))}
          </div>
        </div> */}
      </div>

      {/* Update Profile Modal */}
    </div>
  );
};

export default VendorShop;
