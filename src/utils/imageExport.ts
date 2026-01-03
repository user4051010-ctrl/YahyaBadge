import html2canvas from 'html2canvas';

export const exportElementAsPNG = async (
  elementId: string,
  filename: string
): Promise<void> => {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error('Element not found');
  }

  try {
    // Clone the element to avoid modifying the visible one
    const clone = element.cloneNode(true) as HTMLElement;

    // Reset any transforms on the clone that might cause distortion
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.zIndex = '-1';

    // Ensure clean background
    clone.style.background = '#ffffff';
    // Copy direction from original to ensure correct text alignment
    clone.dir = element.getAttribute('dir') || 'rtl';

    // Remove excluded elements based on data attribute
    const elementsToIgnore = clone.querySelectorAll('[data-ignore-export="true"]');
    elementsToIgnore.forEach(el => el.remove());

    document.body.appendChild(clone);

    // Wait for images to load in the clone
    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 4, // Higher scale for better quality
      logging: false,
      useCORS: true,
      allowTaint: true,
      onclone: (_, element) => {
        // ensuring everything is visible
        element.style.display = 'block';
        element.style.visibility = 'visible';
      }
    });

    // Remove clone
    document.body.removeChild(clone);

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('فشل في تصدير الصورة');
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Copy error:', error);
    return false;
  }
};

export const generateImageBlob = async (
  elementId: string,
  options: { excludeSelectors?: string[] } = {}
): Promise<Blob | null> => {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error('Element not found');
  }

  try {
    const clone = element.cloneNode(true) as HTMLElement;

    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.zIndex = '-1';
    clone.style.background = '#ffffff';
    clone.dir = element.getAttribute('dir') || 'rtl';

    // Remove excluded elements
    if (options.excludeSelectors) {
      options.excludeSelectors.forEach(selector => {
        const el = clone.querySelector(selector);
        if (el) {
          el.remove();
        }
      });
    }

    // Remove elements with data-ignore-export attribute
    const elementsToIgnore = clone.querySelectorAll('[data-ignore-export="true"]');
    elementsToIgnore.forEach(el => el.remove());

    document.body.appendChild(clone);

    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 4,
      logging: false,
      useCORS: true,
      allowTaint: true,
      onclone: (document, element) => {
        element.style.display = 'block';
        element.style.visibility = 'visible';
      }
    });

    document.body.removeChild(clone);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      });
    });
  } catch (error) {
    console.error('Blob generation error:', error);
    return null;
  }
};

export const copyImageToClipboard = async (blob: Blob): Promise<boolean> => {
  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error('Copy image error:', error);
    return false;
  }
};
