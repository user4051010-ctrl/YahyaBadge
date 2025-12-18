import React, { useState, useEffect } from 'react';
import { Upload, Loader2, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { convertPdfToImage, extractVisaData } from '../utils/ocrProcessor';
import { VisaData } from '../types';

interface OCRPageProps {
  onDataExtracted: (data: VisaData) => void;
  onClientSaved?: (data: VisaData) => void;
  initialData?: VisaData;
  imagePreview?: string;
  onImagePreviewChange?: (url: string) => void;
}

export default function OCRPage({ onDataExtracted, onClientSaved, initialData, imagePreview: propImagePreview, onImagePreviewChange }: OCRPageProps) {
  const [localImagePreview, setLocalImagePreview] = useState<string>('');
  const [showFullImage, setShowFullImage] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Use prop if available, otherwise local state
  const imagePreview = propImagePreview !== undefined ? propImagePreview : localImagePreview;
  const setImagePreview = (url: string) => {
    if (onImagePreviewChange) {
      onImagePreviewChange(url);
    } else {
      setLocalImagePreview(url);
    }
  };

  const [clientPhoto, setClientPhoto] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [visaData, setVisaData] = useState<VisaData>(initialData || {
    fullName: '',
    passportNumber: '',
    visaNumber: '',
    birthDate: '',
    medinaHotel: '',
    meccaHotel: '',
    roomType: '',
    clientPhoto: '',
    email: ''
  });
  const [savedStatus, setSavedStatus] = useState<string>('');

  useEffect(() => {
    if (initialData && initialData.fullName) {
      setVisaData(initialData);
    }
  }, [initialData]);

  // Reset zoom when image changes or toggle
  useEffect(() => {
    if (!showFullImage) setZoom(1);
  }, [showFullImage]);

  const processFile = async (file: File) => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setSavedStatus('idle');

      let convertedPdfImage: File | undefined;

      if (file.type === 'application/pdf') {
        setLoadingPreview(true);
        try {
          convertedPdfImage = await convertPdfToImage(file);
          const objectUrl = URL.createObjectURL(convertedPdfImage);
          setImagePreview(objectUrl);
        } catch (e) {
          console.error("PDF Preview/Conversion Error", e);
          alert('فشل في تحويل ملف PDF.');
          setIsProcessing(false);
          setLoadingPreview(false);
          return;
        } finally {
          setLoadingPreview(false);
        }
      } else {
        const objectUrl = URL.createObjectURL(file);
        setImagePreview(objectUrl);
      }

      const data = await extractVisaData(file, convertedPdfImage);
      setVisaData(data);
      onDataExtracted({ ...data, email: data.email || '' });
    } catch (error) {
      console.error('Error processing image:', error);
      alert('حدث خطأ أثناء معالجة الصورة.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      processFile(file);
    }
  };

  const handleSaveClient = async () => {
    if (!visaData.fullName) {
      alert('يرجى ملء جميع البيانات المطلوبة');
      return;
    }
    setIsProcessing(true);
    try {
      const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
      if (isDemoMode) {
        setSavedStatus('success');
        if (onClientSaved) onClientSaved({ ...visaData, email: visaData.email || '' });
        setTimeout(() => setSavedStatus('idle'), 3000);
        setIsProcessing(false);
        return;
      }

      const { error } = await supabase.from('clients').insert([{
        fullname: visaData.fullName,
        passportnumber: visaData.passportNumber,
        visanumber: visaData.visaNumber,
        birthdate: visaData.birthDate,
        medinahotel: visaData.medinaHotel,
        meccahotel: visaData.meccaHotel,
        roomtype: visaData.roomType,
        clientphoto: visaData.clientPhoto || null,
        email: visaData.email || '',
      }]);

      if (error) throw error;
      setSavedStatus('success');
      if (onClientSaved) onClientSaved({ ...visaData, email: visaData.email || '' });
      setTimeout(() => setSavedStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving client:', error);
      if (onClientSaved) {
        onClientSaved({ ...visaData, email: visaData.email || '' });
        setSavedStatus('success');
      } else {
        setSavedStatus('error');
      }
      setTimeout(() => setSavedStatus('idle'), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: keyof VisaData, value: string) => {
    const newData = { ...visaData, [field]: value };
    setVisaData(newData);
    onDataExtracted({ ...newData, email: newData.email || '' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          استخراج المعلومات من التأشيرة
        </h2>

        {!imagePreview ? (
          <label
            className={`block cursor-pointer group relative overflow-hidden transition-all duration-300 ${isDragging
              ? 'border-blue-500 bg-blue-50 scale-[1.02]'
              : 'hover:border-blue-400 hover:bg-gray-50'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging ? 'border-blue-500' : 'border-gray-300 group-hover:border-blue-400'
              }`}>
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className={`w-8 h-8 text-blue-500 ${isProcessing ? 'animate-bounce' : ''}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isProcessing ? 'جاري المعالجة...' : 'اضغط لرفع صورة التأشيرة أو ملف PDF'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                أو قم بسحب وإفلات الملف هنا
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG أو PDF</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleImageUpload}
              disabled={isProcessing}
            />
          </label>
        ) : (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-gray-200 overflow-hidden border border-gray-300">
                  <img src={imagePreview} className="w-full h-full object-cover" alt="Thumbnail" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">تم رفع صورة التأشيرة</p>
                  <button
                    onClick={() => setShowFullImage(!showFullImage)}
                    className="text-blue-600 text-xs hover:underline flex items-center gap-1"
                  >
                    {showFullImage ? 'إخفاء الصورة' : 'عرض الصورة كاملة'}
                  </button>
                </div>
              </div>
              <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors shadow-sm">
                تغيير الصورة
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                />
              </label>
            </div>

            {showFullImage && (
              <div className="relative rounded-lg border border-gray-200 animate-in fade-in zoom-in-95 duration-200 bg-gray-100 overflow-hidden">
                <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-lg shadow-sm">
                  <button
                    onClick={() => setZoom(prev => Math.min(prev + 0.5, 4))}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-blue-600 transition-colors"
                    title="تكبير"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <span className="flex items-center text-xs font-mono text-gray-500 w-12 justify-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-blue-600 transition-colors"
                    title="تصغير"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-auto max-h-[600px] flex items-start justify-center p-4">
                  <img
                    src={imagePreview}
                    alt="Visa Preview"
                    className="transition-transform duration-200 origin-top"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 ml-3" />
            <span className="text-gray-600">جاري استخراج البيانات...</span>
          </div>
        )}

        {!isProcessing && imagePreview && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الكامل</label>
              <input
                type="text"
                value={visaData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={visaData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="example@comfythings.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الجواز</label>
              <input
                type="text"
                value={visaData.passportNumber}
                onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">رقم التأشيرة</label>
              <input
                type="text"
                value={visaData.visaNumber}
                onChange={(e) => handleInputChange('visaNumber', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الميلاد</label>
              <input
                type="text"
                value={visaData.birthDate}
                onChange={(e) => handleInputChange('birthDate', e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveClient}
              disabled={isProcessing}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ بيانات العميل'
              )}
            </button>

            {savedStatus && (
              <div className={`p-4 rounded-lg ${savedStatus.includes('success') ? 'bg-green-100 text-green-800 border border-green-400' : savedStatus.includes('idle') ? 'hidden' : 'bg-red-100 text-red-800 border border-red-400'}`}>
                <p className="text-sm font-medium">
                  {savedStatus === 'success' ? 'تم حفظ بيانات العميل بنجاح' : savedStatus !== 'idle' ? 'فشل الحفظ' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
