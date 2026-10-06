import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
