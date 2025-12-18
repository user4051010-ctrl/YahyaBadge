
import fs from 'fs';
const filePath = 'c:\\Users\\Lenovo\\Desktop\\yahya-prgramme-main\\src\\components\\HistoryPage.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Verify lines (1-based 375 is index 374)
const l1 = lines[374].trim();
const l2 = lines[403].trim();

console.log('Line 375:', l1);
console.log('Line 404:', l2);

if (l1.startsWith('<button') && l2.startsWith('</button>')) {
    const newLines = [
        ...lines.slice(0, 374),
        ...lines.slice(404)
    ];
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('Successfully removed lines 375-404');
} else {
    console.log('Line verification failed');
}
