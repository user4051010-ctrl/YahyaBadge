import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { VisaData } from '../types';

// Set worker source for PDF.js - Using mjs for v5+ compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Document type detection
const detectDocumentType = (text: string): 'visa' | 'passport' => {
  // Check for MRZ pattern (passport indicator)

  // Check for MRZ pattern (passport indicator)
  const hasMRZ = /P<[A-Z]{3}/.test(text) || /[A-Z0-9]{9}[A-Z]{3}[0-9]{7}/.test(text);

  // Check for passport-specific keywords
  const hasPassportKeywords = /passport|passeport|جواز\s*سفر|royaume|kingdom/i.test(text);

  // Check for visa-specific keywords
  const hasVisaKeywords = /visa|تأشيرة|entry|umrah|hajj/i.test(text);

  if (hasMRZ || hasPassportKeywords) {
    return 'passport';
  }
  if (hasVisaKeywords) {
    return 'visa';
  }

  // Default to visa if uncertain
  return 'visa';
};

// Parse MRZ (Machine Readable Zone) from passport
interface MRZData {
  passportNumber: string;
  dateOfBirth: string;
  expiryDate: string;
  nationality: string;
  sex: string;
  lastName: string;
  firstName: string;
}

const parseMRZ = (text: string): MRZData | null => {
  try {
    // Look for MRZ pattern - 2 lines, 44 characters each
    // Line 1: P<COUNTRY_CODE_LASTNAME<<FIRSTNAME<<<<<<...
    // Line 2: PASSPORT_NO_COUNTRY_DATE_SEX_EXPIRY...

    const lines = text.split('\n').map(l => l.trim());
    let mrzLine1 = '';
    let mrzLine2 = '';

    // Find MRZ lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s/g, '');
      // Line 1 starts with P<
      if (/^P<[A-Z]{3}/.test(line) && line.length >= 40) {
        mrzLine1 = line;
        if (i + 1 < lines.length) {
          mrzLine2 = lines[i + 1].replace(/\s/g, '');
        }
        break;
      }
      // Sometimes OCR might miss P<, look for pattern
      if (/^[A-Z]{9,}[A-Z]{3}[0-9]{7}/.test(line) && line.length >= 40) {
        mrzLine2 = line;
        if (i > 0) {
          mrzLine1 = lines[i - 1].replace(/\s/g, '');
        }
        break;
      }
    }

    if (!mrzLine1 || !mrzLine2) {
      console.log('MRZ lines not found in text');
      return null;
    }

    console.log('MRZ Line 1:', mrzLine1);
    console.log('MRZ Line 2:', mrzLine2);

    // Parse line 1 for name
    // Format: P<COUNTRYCODE_LASTNAME<<FIRSTNAME<<<<<...
    const namePart = mrzLine1.substring(5); // Skip P<MAR or similar
    const nameParts = namePart.split('<<');
    const lastName = nameParts[0]?.replace(/</g, ' ').trim() || '';
    const firstName = nameParts[1]?.replace(/</g, ' ').trim() || '';

    // Parse line 2
    // Positions: 0-8: Passport number, 10-12: Nationality, 13-19: DOB (YYMMDD+check), 20: Sex, 21-27: Expiry
    const passportNumber = mrzLine2.substring(0, 9).replace(/</g, '').trim();
    const nationality = mrzLine2.substring(10, 13);
    const dobRaw = mrzLine2.substring(13, 19); // YYMMDD
    const sex = mrzLine2.substring(20, 21);
    const expiryRaw = mrzLine2.substring(21, 27); // YYMMDD

    // Convert YYMMDD to DD/MM/YYYY
    const convertDate = (yymmdd: string): string => {
      if (yymmdd.length !== 6) return '';
      const yy = parseInt(yymmdd.substring(0, 2));
      const mm = yymmdd.substring(2, 4);
      const dd = yymmdd.substring(4, 6);
      // Assume 1900s if > 50, otherwise 2000s
      const yyyy = yy > 50 ? `19${yy}` : `20${yy}`;
      return `${dd}/${mm}/${yyyy}`;
    };

    const dateOfBirth = convertDate(dobRaw);
    const expiryDate = convertDate(expiryRaw);

    return {
      passportNumber,
      dateOfBirth,
      expiryDate,
      nationality,
      sex,
      lastName,
      firstName
    };
  } catch (error) {
    console.error('MRZ parsing error:', error);
    return null;
  }
};

// Extract Arabic name from passport bio page
const extractArabicNameFromPassport = (text: string): string => {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Must contain Arabic characters
    if (!/[\u0600-\u06FF]/.test(trimmed)) continue;

    // Skip common headers and labels
    if (/المملكة|العربية|المغربية|السعودية|وزارة|الخارجية|تأشيرة|زيارة|مرور|جواز|تاريخ|الجنسية|المهنة|صاحب|العمل|الاسم|الميلاد|الإصدار|الصلاحية|رقم/.test(trimmed)) continue;
    if (/^(PASSPORT|PASSEPORT|KINGDOM|ROYAUME|MAROC|MOROCCO|MAR)/i.test(trimmed)) continue;

    // Clean the candidate
    let candidate = trimmed
      .replace(/Name|الاسم|Full|Applicant/gi, '')
      .replace(/[:\-\.،]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove English words mixed with Arabic
    candidate = candidate.replace(/\b[A-Z][a-z]+\b/g, '').trim();
    candidate = candidate.replace(/\d+/g, '').trim();

    // Valid candidate should have 2+ words and be between 5-50 characters
    const words = candidate.split(' ').filter(w => w.length > 0);
    if (words.length >= 2 && candidate.length >= 5 && candidate.length < 50) {
      // Extra validation: ensure it's primarily Arabic
      const arabicChars = (candidate.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = candidate.replace(/\s/g, '').length;

      if (arabicChars / totalChars > 0.7) {
        console.log('Found Arabic name from passport:', candidate);
        return candidate;
      }
    }
  }

  return '';
};

// Extract passport-specific data
const extractPassportData = (text: string, mrzData: MRZData | null): Partial<VisaData> & { arabicName?: string } => {
  const data: Partial<VisaData> & { arabicName?: string } = {};

  if (mrzData) {
    // Use MRZ data as primary source
    data.passportNumber = mrzData.passportNumber;
    data.birthDate = mrzData.dateOfBirth;
  } else {
    // Fallback to pattern matching if MRZ parsing failed
    data.passportNumber = extractPassportNumberFromPassport(text);
    data.birthDate = extractBirthDateFromPassport(text);
  }

  // Extract Arabic name from passport bio page
  const arabicName = extractArabicNameFromPassport(text);
  if (arabicName) {
    data.arabicName = arabicName;
  }

  return data;
};

// Extract passport number from passport bio page (fallback)
const extractPassportNumberFromPassport = (text: string): string => {
  const patterns = [
    /(?:Passport|Passeport|N°\s*de\s*Passeport|رقم\s*الجواز)[:\s]+([A-Z]{2}[0-9]{7,9})/i,
    /\b([A-Z]{2}[0-9]{7,9})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
};

// Extract birth date from passport bio page (fallback)
const extractBirthDateFromPassport = (text: string): string => {
  const patterns = [
    /(?:Date\s*of\s*birth|Date\s*de\s*naissance|تاريخ\s*الميلاد)[:\s]+([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i,
    /\b([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/-/g, '/');
    }
  }
  return '';
};

export const extractVisaData = async (file: File, convertedImage?: File): Promise<VisaData> => {
  try {
    let imageToProcess: string | File = file;

    if (file.type === 'application/pdf') {
      // Use the provided converted image if available, otherwise convert it
      if (convertedImage) {
        imageToProcess = convertedImage;
      } else {
        imageToProcess = await convertPdfToImage(file);
      }
    }

    const result = await Tesseract.recognize(imageToProcess, 'ara+eng', {
      logger: (m) => console.log(m),
    });

    const text = result.data.text;
    console.log('Extracted OCR text:', text);

    // Detect document type
    const docType = detectDocumentType(text);
    console.log('Detected document type:', docType);

    // Parse MRZ if it's a passport
    let mrzData: MRZData | null = null;
    if (docType === 'passport') {
      mrzData = parseMRZ(text);
      console.log('MRZ Data:', mrzData);
    }

    // Extract name (works for both visa and passport)
    const extractedArabicName = extractName(text);

    // Extract profile photo
    // For PDF, we use the converted image (Blob -> File)
    const photoSource = (file.type === 'application/pdf' && (convertedImage || imageToProcess instanceof File))
      ? (convertedImage || imageToProcess as File)
      : file;

    const profilePhoto = await extractProfilePhoto(photoSource);

    // Build visa data based on document type
    let visaData: VisaData;

    if (docType === 'passport' && mrzData) {
      // Use passport extraction with MRZ data
      const passportData = extractPassportData(text, mrzData);

      // Priority: Use Arabic name from passport if available, otherwise use extracted name, otherwise use MRZ name
      const finalFullName = passportData.arabicName || extractedArabicName || `${mrzData.firstName} ${mrzData.lastName}`;

      visaData = {
        fullName: finalFullName,
        email: generateEmailFromPassport(mrzData, finalFullName),
        passportNumber: passportData.passportNumber || '',
        visaNumber: '', // Passports don't have visa numbers
        birthDate: passportData.birthDate || '',
        clientPhoto: profilePhoto,
      };
    } else {
      // Use standard visa extraction
      visaData = {
        fullName: extractedArabicName,
        email: generateEmail(text, extractedArabicName),
        passportNumber: extractPassportNumber(text),
        visaNumber: extractVisaNumber(text),
        birthDate: extractBirthDate(text),
        clientPhoto: profilePhoto,
      };
    }

    return visaData;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('فشل في استخراج البيانات من الصورة');
  }
};

export const convertPdfToImage = async (file: File): Promise<File> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Get first page

  const viewport = page.getViewport({ scale: 2.0 }); // Scale up for better OCR
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Failed to create canvas context');

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  } as any).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        // Create a File object from the blob to satisfy Tesseract/Type constraints
        const imageFile = new File([blob], "visa_page_1.png", { type: "image/png" });
        resolve(imageFile);
      } else {
        reject(new Error('Canvas to Blob conversion failed'));
      }
    }, 'image/png');
  });
};

import { detectAndCropFace } from './faceDetectionUtils';

const extractProfilePhoto = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      // 1. Try Face Detection first
      try {
        const fullImageCanvas = document.createElement('canvas');
        fullImageCanvas.width = img.width;
        fullImageCanvas.height = img.height;
        const ctx = fullImageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          console.log("Attempting face detection...");
          const croppedFace = await detectAndCropFace(fullImageCanvas);
          if (croppedFace) {
            console.log("Face detected and cropped!");
            resolve(croppedFace);
            return;
          }
        }
      } catch (e) {
        console.warn("Face detection failed, falling back to full image", e);
      }

      console.log("No face detected, using full image.");

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      // Return the full image so the user can crop it manually in the Badge Page.
      // We limit the size to avoid excessive base64 string length.
      const maxDimension = 1200;
      let w = img.width;
      let h = img.height;

      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }

      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve('');
  });
};

const extractName = (text: string): string => {
  // Helper to clean a candidate name
  const cleanCandidate = (str: string) => {
    let s = str.replace(/\n/g, ' ');
    s = s.replace(/Name|الاسم|Full|Applicant/gi, '');
    s = s.replace(/[:,\-.]/g, ' ');
    s = s.trim().replace(/\s+/g, ' ');

    // Heuristic: If contains Arabic, remove Latin noise
    if (/[\u0600-\u06FF]/.test(s)) {
      s = s.replace(/\b[a-z]{1,4}\b/g, '').trim();
      s = s.replace(/glis/gi, '').trim();
      s = s.replace(/\d+/g, '').trim();
    }

    // Clean common OCR garbage from headers
    s = s.replace(/\b(?:KSA|Kingdom|Arabia|Saudi|He|Al|The|Visa|Digital|Embassy)\b/gi, '').trim();

    // Explicitly reject if the result is just a common garbage word or too short
    if (/^(Al|He|The|Of|In|By)$/i.test(s) || s.length < 3) {
      return '';
    }

    return s.trim();
  };

  // Strategy 1: Regular Expression Anchors
  // Capture everything between "Name" label and the next likely field
  const multilinePattern = /(?:Name|الاسم)[:\s,.|]+([\s\S]+?)(?=(?:Birth|تاريخ|Passport|رقم|Nationality|الجنسية|Issue|Visa|Duration))/i;

  let rawName = '';
  const match = text.match(multilinePattern);
  if (match && match[1]) {
    rawName = match[1];
  } else {
    // Fallback: Single line patterns
    const namePatterns = [
      /Name[:\s,.|]+([^\n]+)/i,
      /الاسم[:\s]+([^\n]+)/,
    ];
    for (const pattern of namePatterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        rawName = m[1];
        break;
      }
    }
  }

  let finalName = cleanCandidate(rawName);

  // Strategy 2: Heuristic Fallback for Arabic Names
  // If the result is empty, just one word, OR NO ARABIC FOUND, scan for a better Arabic line.
  // This is crucial for fixing the "He Al KSA" issue where it matches English garbage.
  const hasArabic = /[\u0600-\u06FF]/.test(finalName);

  if ((!finalName || finalName.length < 3 || !hasArabic) && text.length > 10) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Must contain Arabic
      if (!/[\u0600-\u06FF]/.test(trimmed)) continue;

      // Ignore known Headers/Labels
      if (/^Kingdom|Ministry|Visa|Passport|Date|Duration|Place/i.test(line)) continue;
      if (/المملكة|العربية|السعودية|وزارة|الخارجية|تأشيرة|زيارة|مرور|جواز|تاريخ|الجنسية|المهنة|صاحب|العمل/.test(trimmed)) continue;

      // Clean it
      const candidate = cleanCandidate(trimmed);

      // If valid and looks like a full name (2+ words), prefer it over the partial regex result
      // Also ensure it's not too long (avoiding paragraphs)
      if (candidate.split(' ').length >= 2 && candidate.length < 50) {
        // PREFER THIS HEURISTIC RESULT if it has Arabic and the previous one didn't
        finalName = candidate;
        break; // Take the first valid non-header Arabic line (usually Name is top)
      }
    }
  }

  return finalName;
};

const extractPassportNumber = (text: string): string => {
  const passportPatterns = [
    /Passport\s*No[.:\s]+([A-Z0-9]+)/i,
    /رقم\s*جواز\s*السفر[:\s]+([A-Z0-9]+)/,
    /[A-Z]{1,2}\d{7,9}/,
  ];

  for (const pattern of passportPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0].trim();
    }
  }
  return '';
};

const extractVisaNumber = (text: string): string => {
  const visaPatterns = [
    /Visa\s*No[.:\s]+(\d+)/i,
    /رقم\s*التأشيرة[:\s]+(\d+)/,
    /\b\d{10,12}\b/,
  ];

  for (const pattern of visaPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0].trim();
    }
  }
  return '';
};

const extractBirthDate = (text: string): string => {
  const datePatterns = [
    /Birth\s*Date[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /تاريخ\s*الميلاد[:\s]+(\d{2}\/\d{2}\/\d{4})/,
    /\b\d{2}\/\d{2}\/\d{4}\b/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0].trim();
    }
  }
  return '';
};

const arabicToLatinMap: { [key: string]: string } = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
  'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l',
  'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'ah', 'ء': 'a', 'ؤ': 'u', 'ئ': 'e',
  // Common ligatures or variations
  'لا': 'la',
  // Persian/Urdu variants if needed (but focusing on Arabic for now)
};

const transliterateArabic = (arabicText: string): string => {
  let result = '';
  for (let i = 0; i < arabicText.length; i++) {
    const char = arabicText[i];
    if (arabicToLatinMap[char]) {
      result += arabicToLatinMap[char];
    } else {
      // Keep numbers, spaces, and English letters as is, ignore others
      if (/[0-9\sA-Za-z]/.test(char)) {
        result += char;
      }
    }
  }
  return result;
};

// Generate email from passport MRZ data
// Pattern: latinLastName + first3LettersOfFirstName@comfythings.com
const generateEmailFromPassport = (mrzData: MRZData, detectedArabicName: string): string => {
  // Try to use MRZ data first (most reliable for passports)
  if (mrzData && mrzData.lastName && mrzData.firstName) {
    const lastName = mrzData.lastName.toLowerCase().replace(/\s+/g, '');
    const firstName = mrzData.firstName.toLowerCase().replace(/\s+/g, '');

    // Get first 3 letters of first name
    const firstNamePrefix = firstName.substring(0, 3);

    const emailPrefix = lastName + firstNamePrefix;
    return `${emailPrefix}@comfythings.com`;
  }

  // Fallback to standard email generation if MRZ parsing failed
  // This uses the existing generateEmail function logic
  if (detectedArabicName && /[\u0600-\u06FF]/.test(detectedArabicName)) {
    const latinName = transliterateArabic(detectedArabicName);
    const parts = latinName.trim().split(/\s+/);

    if (parts.length >= 2) {
      // For passport fallback, assume last part is last name
      const lastName = parts[parts.length - 1].toLowerCase();
      const firstName = parts[0].toLowerCase();
      const firstNamePrefix = firstName.substring(0, 3);

      const emailPrefix = lastName + firstNamePrefix;
      return `${emailPrefix}@comfythings.com`;
    }
  }

  return '';
};

const generateEmail = (text: string, detectedArabicName: string): string => {
  // 1. Priority: Transliterate detected Arabic name if it exists and contains Arabic characters
  if (detectedArabicName && /[\u0600-\u06FF]/.test(detectedArabicName)) {
    const latinName = transliterateArabic(detectedArabicName);
    const parts = latinName.trim().split(/\s+/);

    if (parts.length >= 2) {
      // Assuming First Name [Last Name] or [First Name] Last Name?
      // User said "Ghazal Nadia" -> "ghazal" (first part) "nadia" (second part).
      // Format: First Name + 3 letters of Second Name.
      // Usually Arabic names are: First Name (+ Father/Last). 
      // Let's take the first two meaningful parts.
      const firstName = parts[0].toLowerCase();
      const secondName = parts[1].toLowerCase();

      const emailPrefix = (firstName + secondName.substring(0, 3));
      return `${emailPrefix}@comfythings.com`;
    } else if (parts.length === 1) {
      return `${parts[0].toLowerCase()}@comfythings.com`;
    }
  }

  // 2. Fallback: Search for English text with "First Last" pattern
  const englishNamePattern = /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
  let match;
  while ((match = englishNamePattern.exec(text)) !== null) {
    const [_, first, second] = match;
    if (/^(Name|Passport|Visa|Birth|Date|Place|Type|Code|Sex|Nationality|Saudi|Digital|Ministry|Umrah|Hajj|Kingdom)/i.test(first)) continue;

    const emailPrefix = (first + second.substring(0, 3)).toLowerCase();
    return `${emailPrefix}@comfythings.com`;
  }

  return '';
};
