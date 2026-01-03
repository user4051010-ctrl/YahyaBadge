import { useState, useEffect } from 'react';
import { Download, Upload, Copy as CopyIcon, CheckCircle, Save, Edit as EditIcon, Phone } from 'lucide-react';
import { BadgeData, RoomType } from '../types';
import { exportElementAsPNG, generateImageBlob, copyImageToClipboard } from '../utils/imageExport';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropUtils';
import { Crop as CropIcon, X, Check } from 'lucide-react';

interface BadgePageProps {
  initialData: BadgeData;
  onUpdateData?: (data: BadgeData) => void;
}

const ROOM_TYPES: RoomType[] = ['فردي', 'ثنائي', 'ثلاثي', 'رباعي', 'خماسي'];

const DEFAULT_MOROCCO_PHONE = '+212638248138';
const DEFAULT_SAUDI_PHONE = '00966549724478';

export default function BadgePage({ initialData, onUpdateData }: BadgePageProps) {
  const [badgeData, setBadgeData] = useState<BadgeData>(initialData);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Phone Editing State
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [editPhones, setEditPhones] = useState({
    morocco: DEFAULT_MOROCCO_PHONE,
    saudi: DEFAULT_SAUDI_PHONE
  });

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCropper = () => {
    if (badgeData.clientPhoto) {
      setIsCropping(true);
      setZoom(1);
    }
  };

  const handleCropSave = async () => {
    try {
      if (badgeData.clientPhoto && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(
          badgeData.clientPhoto,
          croppedAreaPixels
        );
        setBadgeData(prev => ({ ...prev, clientPhoto: croppedImage }));
        setIsCropping(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Persistent Hotel Lists
  const [medinaHotels, setMedinaHotels] = useState<string[]>(() => {
    const saved = localStorage.getItem('medinaHotels');
    return saved ? JSON.parse(saved) : ['وردة السعادة', 'ديار التقوى', 'أجنحة الروضة'];
  });

  const [meccaHotels, setMeccaHotels] = useState<string[]>(() => {
    const saved = localStorage.getItem('meccaHotels');
    return saved ? JSON.parse(saved) : ['إبراج التبسير', 'ساعة مكة', 'دار التوحيد'];
  });

  useEffect(() => {
    localStorage.setItem('medinaHotels', JSON.stringify(medinaHotels));
  }, [medinaHotels]);

  useEffect(() => {
    localStorage.setItem('medinaHotels', JSON.stringify(medinaHotels));
  }, [medinaHotels]);

  useEffect(() => {
    localStorage.setItem('meccaHotels', JSON.stringify(meccaHotels));
  }, [meccaHotels]);

  // Load saved phones on mount
  useEffect(() => {
    const savedMorocco = localStorage.getItem('savedMoroccoPhone');
    const savedSaudi = localStorage.getItem('savedSaudiPhone');

    const initialMorocco = savedMorocco || DEFAULT_MOROCCO_PHONE;
    const initialSaudi = savedSaudi || DEFAULT_SAUDI_PHONE;

    setEditPhones({
      morocco: initialMorocco,
      saudi: initialSaudi
    });

    setBadgeData(prev => ({
      ...prev,
      moroccoPhone: initialMorocco,
      saudiPhone: initialSaudi
    }));
  }, []);

  const savePhones = () => {
    localStorage.setItem('savedMoroccoPhone', editPhones.morocco);
    localStorage.setItem('savedSaudiPhone', editPhones.saudi);
    setBadgeData(prev => ({
      ...prev,
      moroccoPhone: editPhones.morocco,
      saudiPhone: editPhones.saudi
    }));
    setShowPhoneModal(false);
  };

  useEffect(() => {
    setBadgeData((prev) => ({
      ...prev,
      fullName: initialData.fullName || prev.fullName,
      passportNumber: initialData.passportNumber || prev.passportNumber,
      visaNumber: initialData.visaNumber || prev.visaNumber,
      birthDate: initialData.birthDate || prev.birthDate,
      clientPhoto: initialData.clientPhoto || prev.clientPhoto,
    }));
  }, [initialData]);

  const handleInputChange = (field: keyof BadgeData, value: string) => {
    const updated = { ...badgeData, [field]: value };
    setBadgeData(updated);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const photo = reader.result as string;
      const updated = { ...badgeData, clientPhoto: photo };
      setBadgeData(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateRecord = () => {
    // 1. Update History if parent handler provided
    if (onUpdateData) {
      onUpdateData(badgeData);
    }

    // 2. Save new hotels to list if they don't exist
    if (badgeData.medinaHotel && !medinaHotels.includes(badgeData.medinaHotel)) {
      setMedinaHotels(prev => [...prev, badgeData.medinaHotel!]);
    }
    if (badgeData.meccaHotel && !meccaHotels.includes(badgeData.meccaHotel)) {
      setMeccaHotels(prev => [...prev, badgeData.meccaHotel!]);
    }

    alert('تم تحديث السجل بنجاح');
  };

  const handleDownloadBadge = async () => {
    setIsExporting(true);
    try {
      await exportElementAsPNG('badge-preview', `بادج_${badgeData.fullName || 'عميل'} `);
    } catch (error) {
      alert('فشل في تصدير البادج');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">إنشاء بادج العميل</h2>

        {/* Phone Edit Modal */}
        {showPhoneModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  تعديل أرقام الهاتف
                </h3>
                <button onClick={() => setShowPhoneModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رقم المغرب</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg dir-ltr text-left"
                    value={editPhones.morocco}
                    onChange={e => setEditPhones(p => ({ ...p, morocco: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رقم السعودية</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg dir-ltr text-left"
                    value={editPhones.saudi}
                    onChange={e => setEditPhones(p => ({ ...p, saudi: e.target.value }))}
                  />
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                <button onClick={() => setShowPhoneModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">إلغاء</button>
                <button onClick={savePhones} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ التغييرات</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <datalist id="medina-hotels">
            {medinaHotels.map((hotel) => (
              <option key={hotel} value={hotel} />
            ))}
          </datalist>
          <datalist id="mecca-hotels">
            {meccaHotels.map((hotel) => (
              <option key={hotel} value={hotel} />
            ))}
          </datalist>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المعتمر</label>
              <input
                type="text"
                value={badgeData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="اسم المعتمر كاملاً"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">فندق المدينة</label>
              <input
                type="text"
                value={badgeData.medinaHotel}
                onChange={(e) => handleInputChange('medinaHotel', e.target.value)}
                list="medina-hotels"
                placeholder="مثال: وردة السعادة"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">فندق مكة</label>
              <input
                type="text"
                value={badgeData.meccaHotel}
                onChange={(e) => handleInputChange('meccaHotel', e.target.value)}
                list="mecca-hotels"
                placeholder="مثال: إبراج التبسير"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">نوع الغرفة</label>
              <select
                value={badgeData.roomType}
                onChange={(e) => handleInputChange('roomType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">اختر نوع الغرفة</option>
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateRecord}
                disabled={!badgeData.fullName}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
              >
                <Save className="w-5 h-5 ml-2" />
                حفظ البيانات
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">معاينة البادج:</p>
            {/* 
                Container Logic:
                - min-h-[500px] ensures enough vertical scroll space if it overflows
                - overflow-visible ensures the transform: scale doesn't get clipped
                - pt-12 pushes the badge down a bit from text
             */}
            <div className="flex justify-center bg-white rounded-lg min-h-[500px] overflow-visible pt-4">
              <div
                className="relative"
                style={{
                  transform: 'scale(1.7)',
                  transformOrigin: 'top center',
                  // Margin bottom compensates for the scale pushing content down visually
                  marginBottom: '300px'
                }}
              >
                {/* Floating Action Buttons */}
                <div className="absolute left-0 -top-8 flex gap-2 z-20">
                  <button
                    onClick={handleDownloadBadge}
                    disabled={isExporting || !badgeData.fullName}
                    className="bg-orange-500 hover:bg-orange-600 text-white p-1.5 rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50"
                    title="حفظ البadge (PNG)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setIsCopying(true);
                      try {
                        const blob = await generateImageBlob('badge-preview');
                        if (blob) await copyImageToClipboard(blob);
                        setShowCopySuccess(true);
                        setTimeout(() => setShowCopySuccess(false), 2000);
                      } catch (e) {
                        alert('فشل نسخ الصورة');
                      } finally {
                        setIsCopying(false);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-lg transition-all hover:scale-110"
                    title="نسخ للذاكرة"
                  >
                    {showCopySuccess ? <CheckCircle className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                  </button>
                </div>
                <div
                  id="badge-preview"
                  className="bg-white p-4 border-2 border-gray-300 shadow-lg relative shrink-0"
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    width: '80mm',
                    height: '105mm',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Header: Centered Logo and Text */}
                  <div className="flex flex-col items-center justify-center mb-2 mt-1">
                    <img
                      src="/logo.png"
                      alt="Yahya Voyages"
                      className="h-16 mb-1"
                    />
                    <div className="text-center z-10">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight">وكالة يحيى للأسفار</h3>
                      <p className="text-xs text-gray-600 font-medium tracking-wide">YAHYA VOYAGES</p>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-2 px-2 items-center">
                    <div className="flex-shrink-0 relative group">
                      <div className="w-20 h-28 border border-gray-300 bg-gray-50 overflow-hidden relative">
                        {badgeData.clientPhoto ? (
                          <div
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url(${badgeData.clientPhoto})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat'
                            }}
                            role="img"
                            aria-label="Client"
                          />
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center text-gray-400 cursor-pointer">
                            <Upload className="w-5 h-5 mb-1" />
                            <span className="text-xs">صورة</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                            />
                          </label>
                        )}

                        {/* Overlay Controls */}
                        {badgeData.clientPhoto && (
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center gap-2 transition-all opacity-0 group-hover:opacity-100">
                            <button
                              onClick={showCropper}
                              className="p-1.5 bg-white rounded-full hover:bg-gray-100 text-gray-800"
                              title="قص الصورة"
                            >
                              <CropIcon className="w-4 h-4" />
                            </button>
                            <label className="p-1.5 bg-white rounded-full hover:bg-gray-100 text-gray-800 cursor-pointer" title="تغيير الصورة">
                              <Upload className="w-4 h-4" />
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Crop Modal */}
                    {isCropping && badgeData.clientPhoto && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                          <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">تعديل الصورة</h3>
                            <button onClick={() => setIsCropping(false)} className="text-gray-500 hover:text-gray-700">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="relative h-[500px] w-full bg-gray-200 rounded-lg overflow-hidden m-auto">
                            <Cropper
                              image={badgeData.clientPhoto}
                              crop={crop}
                              zoom={zoom}
                              aspect={0.8}
                              onCropChange={setCrop}
                              onCropComplete={onCropComplete}
                              onZoomChange={setZoom}
                              objectFit="contain"
                            />
                          </div>
                          <div className="p-4 space-y-4">
                            <div>
                              <p className="text-sm text-gray-600 mb-2">التقريب: {zoom}</p>
                              <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={20}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => {
                                  setZoom(Number(e.target.value))
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setIsCropping(false)}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={handleCropSave}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              حفظ التعديل
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 text-right space-y-2 pt-1">
                      <div className="pb-1">
                        <p className="text-[10px] text-gray-600 mb-0.5">الاسم الكامل</p>
                        <p className="text-base font-bold text-gray-900 mb-1 leading-tight">{badgeData.fullName || '___________'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">فندق المدينة</p>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{badgeData.medinaHotel || ''}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">فندق مكة</p>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{badgeData.meccaHotel || ''}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">نوع الغرفة</p>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{badgeData.roomType || ''}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-1.5 text-center absolute bottom-2 left-0 right-0 w-full px-4 group/footer relative">
                    {/* Phone Edit Icon - Invisible on export */}
                    <button
                      data-ignore-export="true"
                      onClick={() => setShowPhoneModal(true)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover/footer:opacity-100"
                      title="تعديل الأرقام"
                    >
                      <EditIcon className="w-3 h-3" />
                    </button>

                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="text-[10px] font-bold text-gray-900 dir-ltr inline-block">المغرب:</span>
                        <span dir="ltr" className="text-[10px] font-bold text-gray-900 font-sans">{badgeData.moroccoPhone || DEFAULT_MOROCCO_PHONE}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="text-[10px] font-bold text-gray-900 dir-ltr inline-block">السعودية:</span>
                        <span dir="ltr" className="text-[10px] font-bold text-gray-900 font-sans">{badgeData.saudiPhone || DEFAULT_SAUDI_PHONE}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
