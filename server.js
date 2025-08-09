require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const os = require('os');
const crypto = require('crypto');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced configuration
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 20 * 1024 * 1024; // 20MB default
const CONVERSION_TIMEOUT = process.env.CONVERSION_TIMEOUT || 300000; // 5 minutes
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
const TEMP_DIR = path.join(os.tmpdir(), 'pdf-conversions');

// Configure middleware with enhanced security
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: MAX_FILE_SIZE }));
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced job store with automatic cleanup
const jobStore = new Map();
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours
  for (const [jobId, job] of jobStore.entries()) {
    if (job.completedAt && new Date(job.completedAt).getTime() < cutoff) {
      cleanupJobFiles(job).catch(console.error);
      jobStore.delete(jobId);
    }
  }
}, 60 * 60 * 1000); // Run hourly

async function cleanupJobFiles(job) {
  try {
    if (job.filePath) await fs.unlink(job.filePath).catch(() => {});
  } catch (err) {
    console.error(`Failed to cleanup files for job: ${err.message}`);
  }
}

// Configure file upload with enhanced validation
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 
      `File too large. Maximum size is ${MAX_FILE_SIZE/1024/1024}MB` : 
      'File upload error' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint with system info
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    diskInfo: {
      tempDir: TEMP_DIR,
      outputDir: OUTPUT_DIR
    }
  });
});

// Conversion status endpoint with enhanced validation
app.get('/status/:jobId', (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const response = { 
    ...job,
    createdAt: job.createdAt.toISOString(),
    ...(job.completedAt && { completedAt: job.completedAt.toISOString() })
  };
  
  if (job.status === 'completed' && job.filePath) {
    response.downloadUrl = `/download/${req.params.jobId}`;
  }
  
  res.json(response);
});

// Download endpoint with security enhancements
app.get('/download/:jobId', async (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job || job.status !== 'completed' || !job.filePath) {
    return res.status(404).json({ error: 'File not available' });
  }
  
  try {
    const safePath = path.normalize(job.filePath);
    if (!safePath.startsWith(TEMP_DIR) && !safePath.startsWith(OUTPUT_DIR)) {
      throw new Error('Invalid file path');
    }
    
    await fs.access(safePath);
    res.download(safePath, path.basename(job.originalFilename.replace('.pdf', '.docx')), (err) => {
      if (err) console.error(`Download error for job ${req.params.jobId}:`, err);
    });
  } catch (err) {
    res.status(404).json({ error: 'File not found on server' });
  }
});

// File conversion endpoint with enhanced processing
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  const jobData = {
    status: 'processing',
    progress: 0,
    createdAt: new Date(),
    originalFilename: req.file.originalname,
    fileSize: req.file.size
  };
  
  jobStore.set(jobId, jobData);

  // Start background processing with timeout
  const timeout = setTimeout(() => {
    jobStore.set(jobId, {
      ...jobStore.get(jobId),
      status: 'failed',
      error: 'Conversion timed out',
      completedAt: new Date()
    });
  }, CONVERSION_TIMEOUT);

  processConversion(jobId, req.file)
    .catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      jobStore.set(jobId, {
        ...jobStore.get(jobId),
        status: 'failed',
        error: err.message,
        completedAt: new Date()
      });
    })
    .finally(() => clearTimeout(timeout));

  res.status(202).json({
    status: 'processing',
    jobId,
    message: 'Conversion started',
    checkStatusUrl: `/status/${jobId}`,
    estimatedTime: 'Usually takes 1-5 minutes depending on file size'
  });
});

// Enhanced conversion function
async function processConversion(jobId, file) {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const pdfPath = path.join(TEMP_DIR, `input_${timestamp}_${sanitizedFilename}`);
    const baseName = path.parse(sanitizedFilename).name.replace(/\.pdf$/i, '');
    const outputPath = path.join(OUTPUT_DIR, `converted_${baseName}_${timestamp}.docx`);

    await fs.writeFile(pdfPath, file.buffer);
    jobStore.set(jobId, { ...jobStore.get(jobId), progress: 10 });

    // Verify Python script exists
    const scriptPath = path.join(__dirname, 'pdf-to-docx', 'converter.py');
    try {
      await fs.access(scriptPath);
    } catch {
      throw new Error('Conversion service not properly configured');
    }

    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [pdfPath, outputPath],
      pythonPath: process.env.PYTHON_PATH || 'python3',
      timeout: CONVERSION_TIMEOUT - 10000 // Leave 10s buffer
    };

    const result = await new Promise((resolve, reject) => {
      const pyshell = new PythonShell('converter.py', options);
      let output = '';

      pyshell.on('message', (message) => {
        console.log(`Job ${jobId}:`, message);
        output += message;
        const currentJob = jobStore.get(jobId);
        if (currentJob) {
          jobStore.set(jobId, {
            ...currentJob,
            progress: Math.min(currentJob.progress + 5, 90),
            logs: (currentJob.logs || []).concat(message)
          });
        }
      });

      pyshell.end((err) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    await fs.access(outputPath);
    const stats = await fs.stat(outputPath);
    
    if (stats.size === 0) {
      throw new Error('Conversion resulted in empty file');
    }

    jobStore.set(jobId, {
      ...jobStore.get(jobId),
      status: 'completed',
      progress: 100,
      filePath: outputPath,
      fileSize: stats.size,
      completedAt: new Date()
    });

  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  } finally {
    // Cleanup temp files
    const pdfPath = path.join(TEMP_DIR, `input_*_${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`);
    const files = await fs.readdir(TEMP_DIR).catch(() => []);
    for (const file of files) {
      if (file.startsWith(`input_`) && file.endsWith(path.basename(pdfPath))) {
        await fs.unlink(path.join(TEMP_DIR, file)).catch(() => {});
      }
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  console.log('Server shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
  console.log('Server shutting down...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Temp directory: ${TEMP_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Max file size: ${MAX_FILE_SIZE/1024/1024}MB`);
});