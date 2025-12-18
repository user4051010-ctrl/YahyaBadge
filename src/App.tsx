import { useState, useEffect } from 'react';
import { FileText, Table, Badge, History } from 'lucide-react';
import OCRPage from './components/OCRPage';
import TablePage from './components/TablePage';
import BadgePage from './components/BadgePage';
import HistoryPage from './components/HistoryPage';
import { BadgeData, VisaData, Client } from './types';

type TabType = 'ocr' | 'table' | 'badge' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('ocr');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [extractedData, setExtractedData] = useState<BadgeData>({
    fullName: '',
    passportNumber: '',
    visaNumber: '',
    birthDate: '',
    medinaHotel: '',
    meccaHotel: '',
    roomType: '',
    email: '',
  });
  const [clientsHistory, setClientsHistory] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('clientsHistory');
      if (!saved) return [];

      let parsed = JSON.parse(saved);

      if (!Array.isArray(parsed)) return [];

      // Sanitize: Ensure unique IDs and valid structure
      // Use simple random ID if crypto is not available
      const generateId = () => {
        return typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).substr(2);
      };

      parsed = parsed.map((c: any) => ({
        ...c,
        id: c.id || generateId(),
        fullname: c.fullname || 'عميل بدون اسم',
      }));

      // Remove duplicates
      const seen = new Set();
      parsed = parsed.filter((c: any) => {
        if (!c.id) return false;
        const duplicate = seen.has(c.id);
        seen.add(c.id);
        return !duplicate;
      });

      return parsed;
    } catch (e) {
      console.error('Failed to parse history:', e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('clientsHistory', JSON.stringify(clientsHistory));
  }, [clientsHistory]);

  const handleDataExtracted = (data: Partial<BadgeData>) => {
    setExtractedData((prev) => ({ ...prev, ...data }));
  };

  const handleClientSaved = (clientData: VisaData) => {
    const generateId = () => {
      return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    const newClient: Client = {
      id: generateId(),
      fullname: clientData.fullName || 'عميل جديد',
      email: clientData.email || '',
      passportnumber: clientData.passportNumber,
      visanumber: clientData.visaNumber,
      birthdate: clientData.birthDate,
      clientphoto: clientData.clientPhoto,
      medinahotel: extractedData.medinaHotel,
      meccahotel: extractedData.meccaHotel,
      roomtype: extractedData.roomType,
      createdat: new Date().toISOString(),
    };
    setClientsHistory((prev) => [newClient, ...prev]);
  };

  const handleClientDeleted = (id: string) => {
    setClientsHistory((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearHistory = () => {
    if (window.confirm('هل أنت متأكد من حذف السجل بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      setClientsHistory([]);
    }
  };

  const handleClientUpdated = (updatedData: BadgeData) => {
    // 1. Update the ephemeral state
    setExtractedData(updatedData);

    // 2. Update the persistent history if the client exists (by passport or name)
    setClientsHistory((prev) => {
      const exists = prev.findIndex(
        (c) =>
          (c.passportnumber && c.passportnumber === updatedData.passportNumber) ||
          (c.fullname === updatedData.fullName)
      );

      if (exists >= 0) {
        // Update existing
        const newHistory = [...prev];
        newHistory[exists] = {
          ...newHistory[exists],
          fullname: updatedData.fullName || newHistory[exists].fullname, // Allow name update
          passportnumber: updatedData.passportNumber || newHistory[exists].passportnumber,
          visanumber: updatedData.visaNumber || newHistory[exists].visanumber,
          birthdate: updatedData.birthDate || newHistory[exists].birthdate,
          medinahotel: updatedData.medinaHotel,
          meccahotel: updatedData.meccaHotel,
          roomtype: updatedData.roomType,
          clientphoto: updatedData.clientPhoto || newHistory[exists].clientphoto,
        };
        return newHistory;
      } else {
        return prev;
      }
    });
  };

  const handleClientEdit = (client: Client) => {
    // Map Client (history) to BadgeData (working state)
    const dataToEdit: BadgeData = {
      fullName: client.fullname,
      passportNumber: client.passportnumber || '',
      visaNumber: client.visanumber || '',
      birthDate: client.birthdate || '',
      medinaHotel: client.medinahotel || '',
      meccaHotel: client.meccahotel || '',
      roomType: client.roomtype || '',
      clientPhoto: client.clientphoto || '',
      email: client.email || '',
    };

    setExtractedData(dataToEdit);
    setActiveTab('badge');
  };

  const tabs = [
    { id: 'ocr' as TabType, label: 'استخراج المعلومات', icon: FileText },
    { id: 'table' as TabType, label: 'إنشاء الجدول', icon: Table },
    { id: 'badge' as TabType, label: 'إنشاء البادج', icon: Badge },
    { id: 'history' as TabType, label: 'سجل العملاء', icon: History },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Yahya Voyages" className="h-24" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            YahyaBadge
          </h1>
          <p className="text-xl text-gray-600">
            نظام أتمتة ملفات العمرة
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-2 mb-6">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-lg font-semibold transition-all ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="transition-all duration-300">
          {activeTab === 'ocr' && (
            <OCRPage
              onDataExtracted={handleDataExtracted}
              onClientSaved={handleClientSaved}
              initialData={extractedData}
              imagePreview={imagePreview}
              onImagePreviewChange={setImagePreview}
            />
          )}
          {activeTab === 'table' && <TablePage data={extractedData} />}
          {activeTab === 'badge' && (
            <BadgePage
              initialData={extractedData}
              onUpdateData={handleClientUpdated}
            />
          )}
          {activeTab === 'history' && (
            <HistoryPage
              data={clientsHistory}
              onClientDeleted={handleClientDeleted}
              onClearHistory={handleClearHistory}
              onClientEdit={handleClientEdit}
            />
          )}
        </div>

        <footer className="mt-12 text-center text-gray-600">
          <p className="text-sm">© 2025 Yahya Voyages - جميع الحقوق محفوظة</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
