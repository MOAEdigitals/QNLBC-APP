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

// User accounts backup endpoint for cross-device synchronization and offline resilience
const usersBackupPath = path.join(process.cwd(), 'uploads', 'users_backup.json');

app.get('/api/users-backup', (req, res) => {
  try {
    if (fs.existsSync(usersBackupPath)) {
      const data = JSON.parse(fs.readFileSync(usersBackupPath, 'utf8'));
      return res.json({ success: true, users: data.users || [] });
    }
    return res.json({ success: true, users: [] });
  } catch (err: any) {
    return res.json({ success: false, users: [], error: err.message });
  }
});

app.post('/api/users-backup', (req, res) => {
  try {
    const { users } = req.body;
    if (Array.isArray(users)) {
      fs.writeFileSync(usersBackupPath, JSON.stringify({ users, updatedAt: new Date().toISOString() }, null, 2));
      return res.json({ success: true, count: users.length });
    }
    return res.status(400).json({ success: false, error: 'Expected users array' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
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

// Source code zip download endpoint for code audits and migrations
app.get('/api/download-source-zip', (req, res) => {
  const zipPath = path.join(process.cwd(), 'public', 'church-music-app-source.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="church-music-app-source.zip"');
    return res.sendFile(zipPath);
  }
  return res.status(404).send('Source zip file not found');
});

// Media upload endpoint for MP3s and minus-ones with support for both multipart/form-data and JSON base64 dataUrls
app.post('/api/upload-media', async (req, res) => {
  // 1. Check if request is JSON containing a base64 dataUrl
  if (req.is('application/json') && req.body && req.body.dataUrl) {
    try {
      const { dataUrl, fileId, fileName } = req.body;
      const cleanId = (fileId as string) || `track_${Date.now()}`;
      const originalFileName = (fileName as string) || 'audio_track.mp3';
      
      const parts = dataUrl.split(',');
      const meta = parts[0] || '';
      const base64Content = parts[1] || '';
      const mimeType = meta.split(';')[0]?.replace('data:', '') || 'audio/mpeg';

      const fileBuffer = Buffer.from(base64Content.replace(/\s+/g, ''), 'base64');
      const result = await uploadMedia(fileBuffer, originalFileName, mimeType, cleanId);

      let finalUrl = result.url;
      if (finalUrl.startsWith('/uploads/')) {
        finalUrl = `${req.protocol}://${req.get('host')}${finalUrl}`;
      }

      console.log(`[Upload JSON] Successfully processed ${originalFileName} (${fileBuffer.length} bytes) -> ${finalUrl}`);

      return res.json({
        success: true,
        url: finalUrl,
        fileName: originalFileName,
        size: result.size || fileBuffer.length,
        provider: result.provider,
        isCloudUrl: result.isCloudUrl,
      });
    } catch (err: any) {
      console.error('[Upload JSON Error] Failed to process base64 upload:', err);
      return res.status(500).json({
        error: 'Failed to upload media file from dataUrl',
        details: err?.message || String(err),
      });
    }
  }

  // 2. Otherwise handle as multipart/form-data via multer
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[Upload Error] Multer error:', err);
      return res.status(400).json({ error: err.message || 'File upload parsing error' });
    }

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
});

// Media delete endpoint with verified status check
app.delete('/api/upload-media', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }
    const deleted = await deleteMedia(url);
    if (deleted) {
      return res.json({ success: true, message: 'Media successfully deleted' });
    } else {
      return res.status(502).json({ error: 'Failed to delete media from storage provider' });
    }
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
