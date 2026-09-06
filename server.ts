import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';
import { uploadMedia, deleteMedia, getR2Config } from './server/mediaStorage';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS for all incoming client requests (including mobile browsers & preview iframes)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure uploads directory exists and is statically served
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer in-memory storage for file uploads up to 50MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Storage status check endpoint
app.get('/api/storage/status', (req, res) => {
  const r2Config = getR2Config();
  res.json({
    r2Configured: Boolean(r2Config.hasToken || r2Config.hasS3Credentials),
    provider: (r2Config.hasToken || r2Config.hasS3Credentials) ? 'cloudflare-r2' : 'local-server',
    publicUrl: r2Config.publicUrl,
    bucketName: r2Config.bucketName,
  });
});

// Media upload endpoint for MP3s and minus-ones with explicit multer error handling
app.post('/api/upload-media', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Upload Error] Multer error:', err);
      return res.status(400).json({ error: err.message || 'File upload parsing error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = (req.body.fileId as string) || `track_${Date.now()}`;
    const originalFileName = (req.body.fileName as string) || file.originalname || 'audio_track.mp3';
    const mimeType = file.mimetype || 'audio/mpeg';

    const result = await uploadMedia(file.buffer, originalFileName, mimeType, fileId);

    // If local server fallback, qualify with full host URL if needed
    let finalUrl = result.url;
    if (finalUrl.startsWith('/uploads/')) {
      finalUrl = `${req.protocol}://${req.get('host')}${finalUrl}`;
    }

    return res.json({
      success: true,
      url: finalUrl,
      fileName: originalFileName,
      size: result.size,
      provider: result.provider,
      isCloudUrl: result.isCloudUrl,
    });
  } catch (err: any) {
    console.error('Error handling media upload:', err);
    return res.status(500).json({
      error: 'Failed to upload media file',
      details: err?.message || String(err),
    });
  }
});

// Media delete endpoint
app.delete('/api/upload-media', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (url) {
      await deleteMedia(url);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Delete failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
