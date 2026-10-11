import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  try {
    const entries = fs.readdirSync(distPath);
    for (const entry of entries) {
      fs.rmSync(path.join(distPath, entry), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  } catch (e) {
    console.warn('Aviso ao limpar dist:', e.message);
  }
}

