import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { VisaData } from '../types';

// Set worker source for PDF.js - Using mjs for v5+ compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
    const extractedArabicName = extractName(text);

    // Extract profile photo
    // For PDF, we use the converted image (Blob -> File)
    const photoSource = (file.type === 'application/pdf' && (convertedImage || imageToProcess instanceof File))
      ? (convertedImage || imageToProcess as File)
      : file;

    const profilePhoto = await extractProfilePhoto(photoSource);

    const visaData: VisaData = {
      fullName: extractedArabicName,
      email: generateEmail(text, extractedArabicName),
      passportNumber: extractPassportNumber(text),
      visaNumber: extractVisaNumber(text),
      birthDate: extractBirthDate(text),
      clientPhoto: profilePhoto,
    };

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
