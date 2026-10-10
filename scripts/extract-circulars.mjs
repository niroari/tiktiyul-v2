import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const files = [
  {
    name: 'ביטחון ובטיחות בטיולים',
    src: '/Users/nirozari/Downloads/חוזר מנכל ביטחון ובטיחות בטיולים .pdf',
    dest: 'src/lib/server/safety-guidelines/circular-security.txt',
  },
  {
    name: 'אקלים ועומס חום',
    src: '/Users/nirozari/Downloads/חוזר מנכל אקלים.pdf',
    dest: 'src/lib/server/safety-guidelines/circular-climate.txt',
  },
  {
    name: 'הנגשה פרטנית',
    src: '/Users/nirozari/Downloads/הנגשה פרטנית.pdf',
    dest: 'src/lib/server/safety-guidelines/circular-accessibility.txt',
  },
  {
    name: 'אלרגיות ומזון',
    src: '/Users/nirozari/Downloads/אלרגיות.pdf',
    dest: 'src/lib/server/safety-guidelines/circular-allergies.txt',
  },
];

async function run() {
  console.log('Starting circulars extraction...');

  // 1. Copy general circular text if present
  if (fs.existsSync('guidelines.txt')) {
    console.log('Copying general circular from guidelines.txt...');
    fs.copyFileSync('guidelines.txt', 'src/lib/server/safety-guidelines/circular-general-trips.txt');
    console.log('✓ General circular copied to src/lib/server/safety-guidelines/circular-general-trips.txt');
  }

  // 2. Parse downloaded PDFs
  for (const item of files) {
    if (!fs.existsSync(item.src)) {
      console.warn(`File not found: ${item.src}`);
      continue;
    }
    console.log(`Extracting: ${item.name} (${item.src})...`);
    try {
      const dataBuffer = fs.readFileSync(item.src);
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      
      let fullText = '';
      if (result.pages && Array.isArray(result.pages)) {
        fullText = result.pages.map((p, idx) => `=== עמוד ${idx + 1} ===\n${p.text || ''}`).join('\n\n');
      } else {
        fullText = result.text || '';
      }

      fs.writeFileSync(item.dest, fullText.trim(), 'utf-8');
      console.log(`✓ Saved ${item.name} (${fullText.length} chars) to ${item.dest}`);
      await parser.destroy();
    } catch (err) {
      console.error(`Error processing ${item.name}:`, err);
    }
  }

  console.log('All circulars extracted successfully!');
}

run();
