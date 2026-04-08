import React, { useEffect, useMemo, useRef, useState } from 'react';

interface ImageCropModalProps {
  isOpen: boolean;
  file: File | null;
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const PREVIEW_SIZE = 320;
const OUTPUT_SIZE = 512;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  file,
  title = 'Cắt ảnh đại diện',
  onCancel,
  onConfirm,
}) => {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    const nextUrl = URL.createObjectURL(file);
    setImageSrc(nextUrl);

    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      setImageElement(img);
      setNaturalSize({ width, height });
      setZoom(1);
      setCenter({ x: width / 2, y: height / 2 });
    };
    img.src = nextUrl;

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [isOpen, file]);

  const cropSize = useMemo(() => {
    const minEdge = Math.min(naturalSize.width, naturalSize.height);
    if (minEdge <= 0) return 0;
    return minEdge / zoom;
  }, [naturalSize.height, naturalSize.width, zoom]);

  const cropRect = useMemo(() => {
    if (!cropSize || !naturalSize.width || !naturalSize.height) {
      return { sx: 0, sy: 0, size: 0 };
    }

    const maxSx = naturalSize.width - cropSize;
    const maxSy = naturalSize.height - cropSize;

    const sx = clamp(center.x - cropSize / 2, 0, Math.max(0, maxSx));
    const sy = clamp(center.y - cropSize / 2, 0, Math.max(0, maxSy));

    return { sx, sy, size: cropSize };
  }, [center.x, center.y, cropSize, naturalSize.height, naturalSize.width]);

  const previewStyle = useMemo(() => {
    if (!imageSrc || !cropRect.size) {
      return undefined;
    }

    const scale = PREVIEW_SIZE / cropRect.size;
    return {
      backgroundImage: `url("${imageSrc}")`,
      backgroundSize: `${naturalSize.width * scale}px ${naturalSize.height * scale}px`,
      backgroundPosition: `${-cropRect.sx * scale}px ${-cropRect.sy * scale}px`,
    } as React.CSSProperties;
  }, [cropRect.size, cropRect.sx, cropRect.sy, imageSrc, naturalSize.height, naturalSize.width]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropRect.size) return;
    event.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      centerX: center.x,
      centerY: center.y,
    };
  };

  const onDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || !cropRect.size) return;

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;

    const pixelPerPreview = cropRect.size / PREVIEW_SIZE;

    const rawCenterX = dragStartRef.current.centerX - deltaX * pixelPerPreview;
    const rawCenterY = dragStartRef.current.centerY - deltaY * pixelPerPreview;

    const halfCrop = cropRect.size / 2;
    const nextCenterX = clamp(rawCenterX, halfCrop, naturalSize.width - halfCrop);
    const nextCenterY = clamp(rawCenterY, halfCrop, naturalSize.height - halfCrop);

    setCenter({ x: nextCenterX, y: nextCenterY });
  };

  const endDrag = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleConfirm = async () => {
    if (!file || !imageElement || !cropRect.size) return;

    try {
      setIsSaving(true);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không thể xử lý ảnh.');
      }

      ctx.drawImage(
        imageElement,
        cropRect.sx,
        cropRect.sy,
        cropRect.size,
        cropRect.size,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      const outputType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, 0.92);
      });

      if (!blob) {
        throw new Error('Không thể xuất ảnh sau khi cắt.');
      }

      const extension = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
      const croppedFile = new File([blob], `cropped-${Date.now()}.${extension}`, { type: outputType });
      onConfirm(croppedFile);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !file) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-full border border-gray-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-center">
            <div
              className={`w-80 h-80 rounded-2xl border-2 border-dashed border-primary/40 bg-gray-100 bg-no-repeat select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={previewStyle}
              onPointerDown={beginDrag}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-700">Phóng to</label>
              <span className="text-xs font-semibold text-slate-500">{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">Kéo ảnh để chọn vùng hiển thị avatar.</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-gray-300 text-slate-700 font-semibold hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSaving ? 'Đang xử lý...' : 'Xác nhận ảnh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
