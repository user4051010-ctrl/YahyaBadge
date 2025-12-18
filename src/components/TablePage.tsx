import { useState } from 'react';
import { Copy, Download, CheckCircle } from 'lucide-react';
import { VisaData } from '../types';
import { copyToClipboard, exportElementAsPNG } from '../utils/imageExport';

interface TablePageProps {
  data: VisaData & { email?: string };
}

export default function TablePage({ data }: TablePageProps) {
  const [copiedField, setCopiedField] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportElementAsPNG('data-table', `جدول_${data.fullName || 'بيانات'}`);
    } catch (error) {
      alert('فشل في تصدير الجدول');
    } finally {
      setIsExporting(false);
    }
  };

  const tableRows = [
    { label: 'الاسم الكامل', value: data.fullName, key: 'fullName' },
    { label: 'البريد الإلكتروني', value: data.email || '', key: 'email' },
    { label: 'رقم التأشيرة', value: data.visaNumber, key: 'visaNumber' },
    { label: 'رقم الجواز', value: data.passportNumber, key: 'passportNumber' },
    { label: 'تاريخ الميلاد', value: data.birthDate, key: 'birthDate' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">جدول البيانات</h2>

        <div id="data-table" className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-lg border-2 border-blue-200">
          <div className="space-y-4">
            {tableRows.map((row) => (
              <div
                key={row.key}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => row.value && handleCopy(row.value, row.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">{row.label}:</p>
                    <p className="text-lg font-bold text-gray-800">
                      {row.value || 'غير متوفر'}
                    </p>
                  </div>
                  {row.value && (
                    <div className="mr-4">
                      {copiedField === row.key ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Download className="w-5 h-5 ml-2" />
            {isExporting ? 'جاري التصدير...' : 'حفظ الجدول كصورة PNG'}
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 نصيحة: اضغط على أي حقل لنسخ قيمته تلقائياً
          </p>
        </div>
      </div>
    </div>
  );
}
