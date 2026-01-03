import { useState, useEffect } from 'react';
import { Trash2, Download, X, Edit, Copy } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { copyToClipboard as startCopy } from '../utils/imageExport';
import { Client } from '../types';

interface HistoryPageProps {
  data?: Client[];
  onClientDeleted?: (id: string) => void;
  onClearHistory?: () => void;
  onClientEdit?: (client: Client) => void;
}

export default function HistoryPage({ data, onClientDeleted, onClearHistory, onClientEdit }: HistoryPageProps) {
  const [clients, setClients] = useState<Client[]>(data || []);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [checkedClients, setCheckedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    // If data is provided (even if empty array), use it and don't fetch
    if (data) {
      setClients(data);
      setLoading(false);
    } else {
      fetchClients();
    }
  }, [data]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        // If fetch fails and we have no data prop, just show empty
        if (!data) {
          setClients([]);
        }
      } else {
        setClients((data as Client[]) || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening details

    // If we have a parent handler (Preview Mode), use it exclusively or first
    if (onClientDeleted) {
      if (window.confirm('هل تريد حذف هذا العميل؟')) {
        onClientDeleted(id);
        // Local state update happens via props effect usually, but for instant feedback:
        setClients(clients.filter((c) => c.id !== id));
      }
      return;
    }

    if (!window.confirm('هل تريد حذف هذا العميل؟')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (!error) {
        setClients(clients.filter((c) => c.id !== id));
      }
    } catch (error) {
      alert('خطأ في الحذف');
    }
  };

  const downloadClientAsTxt = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const text = `
معلومات العميل:
------------------
الاسم الكامل: ${client.fullname}
البريد الإلكتروني: ${client.email}
رقم جواز السفر: ${client.passportnumber || 'غير متوفر'}
رقم التأشيرة: ${client.visanumber || 'غير متوفر'}
تاريخ الميلاد: ${client.birthdate || 'غير متوفر'}
فندق المدينة: ${client.medinahotel || 'غير متوفر'}
فندق مكة: ${client.meccahotel || 'غير متوفر'}
نوع الغرفة: ${client.roomtype || 'غير متوفر'}
تاريخ الإضافة: ${new Date(client.createdat).toLocaleDateString('ar-EG')}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Simple sanitization: alpanumeric + arabic + space + dash
    const baseName = (client.fullname || 'client').replace(/[^a-zA-Z0-9\u0600-\u06FF\s-_]/g, '').trim();
    // Fallback if empty
    const safeName = baseName || 'client_info';

    link.download = `${safeName}.txt`;

    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const downloadClientPhoto = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!client.clientphoto) return;

    try {
      // Determine if it's base64 or URL
      const fetchResponse = await fetch(client.clientphoto);
      const blob = await fetchResponse.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;

      const baseName = (client.fullname || 'client').replace(/[^a-zA-Z0-9\u0600-\u06FF\s-_]/g, '').trim();
      const safeName = baseName || 'client_photo';

      link.download = `${safeName}.png`; // Assume PNG or generally compatible image

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Download photo error:', error);
      alert('فشل في تحميل الصورة');
    }
  };

  const toggleCheckbox = (clientId: string) => {
    setCheckedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const filteredClients = clients.filter(
    (client) =>
      (client.fullname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (client.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (client.passportnumber || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {onClearHistory && clients.length > 0 && (
              <button
                onClick={onClearHistory}
                className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center border border-red-200"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف الكل
              </button>
            )}
            <button
              onClick={fetchClients}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
            >
              تحديث
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">سجل العملاء</h2>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="ابحث عن عميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
            dir="rtl"
          />
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">لا توجد بيانات عملاء</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                {/* Left: Checkbox */}
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={checkedClients.has(client.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleCheckbox(client.id);
                    }}
                    className="w-5 h-5 text-green-500 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                  />
                </div>

                {/* Middle: Client Name */}
                <div
                  className="text-right flex-1 cursor-pointer"
                  onClick={() => setSelectedClient(client)}
                >
                  <h3 className="text-lg font-bold text-gray-800 select-none">{client.fullname || 'بدون اسم'}</h3>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onClientEdit) onClientEdit(client);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => downloadClientAsTxt(e, client)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="تحميل ملف نصي"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => deleteClient(e, client.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          إجمالي العملاء: {filteredClients.length}
        </div>
      </div>

      {/* Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <button
                onClick={() => setSelectedClient(null)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold text-gray-800">{selectedClient.fullname}</h3>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                  <div className="flex-1">
                    <span className="block text-xs text-gray-500 mb-1">البريد الإلكتروني</span>
                    <span className="text-gray-900 font-semibold dir-ltr block text-left break-all">{selectedClient.email}</span>
                  </div>
                  <button
                    onClick={() => startCopy(selectedClient.email || '')}
                    className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                    title="نسخ"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                  <div className="flex-1">
                    <span className="block text-xs text-gray-500 mb-1">تاريخ الميلاد</span>
                    <span className="text-gray-900 font-semibold">{selectedClient.birthdate || 'غير متوفر'}</span>
                  </div>
                  <button
                    onClick={() => startCopy(selectedClient.birthdate || '')}
                    className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                    title="نسخ"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                    <div className="flex-1">
                      <span className="block text-xs text-gray-500 mb-1">رقم الجواز</span>
                      <span className="text-gray-900 font-semibold">{selectedClient.passportnumber}</span>
                    </div>
                    <button
                      onClick={() => startCopy(selectedClient.passportnumber || '')}
                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                    <div className="flex-1">
                      <span className="block text-xs text-gray-500 mb-1">رقم التأشيرة</span>
                      <span className="text-gray-900 font-semibold">{selectedClient.visanumber}</span>
                    </div>
                    <button
                      onClick={() => startCopy(selectedClient.visanumber || '')}
                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                    <div className="flex-1">
                      <span className="block text-xs text-gray-500 mb-1">فندق المدينة</span>
                      <span className="text-gray-900 font-semibold">{selectedClient.medinahotel}</span>
                    </div>
                    <button
                      onClick={() => startCopy(selectedClient.medinahotel || '')}
                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center group">
                    <div className="flex-1">
                      <span className="block text-xs text-gray-500 mb-1">فندق مكة</span>
                      <span className="text-gray-900 font-semibold">{selectedClient.meccahotel}</span>
                    </div>
                    <button
                      onClick={() => startCopy(selectedClient.meccahotel || '')}
                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-all"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-white border p-4 rounded-lg flex items-center gap-4">
                  {selectedClient.clientphoto ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500">
                      <img src={selectedClient.clientphoto} alt={selectedClient.fullname} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                      لا صورة
                    </div>
                  )}
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">صورة العميل</span>
                    <span className="text-sm text-green-600 font-medium">محفوظة</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              {selectedClient.clientphoto && (
                <button
                  onClick={(e) => {
                    downloadClientPhoto(e, selectedClient);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تحميل الصورة
                </button>
              )}
              <button
                onClick={(e) => {
                  downloadClientAsTxt(e, selectedClient);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تحميل ملف TXT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
