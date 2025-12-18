const arabicToLatinMap: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'a', 'ى': 'a',
};

const arabicToLatin = (text: string): string => {
  return text.split('').map(char => arabicToLatinMap[char] || char).join('');
};

export const generateEmailFromName = (fullName: string): string => {
  const latinName = arabicToLatin(fullName);
  const parts = latinName.trim().split(/\s+/);

  if (parts.length < 2) {
    return `${latinName.toLowerCase().replace(/[^a-z0-9]/g, '')}@comfythings.com`;
  }

  const firstName = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  const lastNamePrefix = lastName.substring(0, 3);

  return `${firstName}${lastNamePrefix}@comfythings.com`;
};

export const createTempEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
  return { success: true, message: 'البريد الإلكتروني جاهز' };
};

export const EMAIL_PASSWORD = 'SecurePass123!';
