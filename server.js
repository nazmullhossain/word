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

// Configure middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory job store
const jobStore = new Map();

// Configure file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Conversion status endpoint
app.get('/status/:jobId', (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  // Add download URL if job is complete
  const response = { ...job };
  if (job.status === 'completed' && job.filePath) {
    response.downloadUrl = `/download/${req.params.jobId}`;
    response.localPath = job.filePath;
  }
  
  res.json(response);
});

// Download endpoint
app.get('/download/:jobId', async (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job || job.status !== 'completed' || !job.filePath) {
    return res.status(404).json({ error: 'File not available' });
  }
  
  try {
    await fs.access(job.filePath);
    res.download(job.filePath, path.basename(job.filePath));
  } catch (err) {
    res.status(404).json({ error: 'File not found on server' });
  }
});

// File conversion endpoint
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate file type
  if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  // Create job ID
  const jobId = crypto.randomBytes(8).toString('hex');
  jobStore.set(jobId, {
    status: 'processing',
    progress: 0,
    createdAt: new Date(),
    originalFilename: req.file.originalname
  });

  // Start background processing
  processConversion(jobId, req.file)
    .catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      jobStore.set(jobId, {
        ...jobStore.get(jobId),
        status: 'failed',
        error: err.message,
        completedAt: new Date()
      });
    });

  // Immediate response
  res.status(202).json({
    status: 'processing',
    jobId,
    message: `Conversion started. Poll /status/${jobId} for updates`,
    checkStatusUrl: `/status/${jobId}`
  });
});

// Background processing function
async function processConversion(jobId, file) {
  const tempDir = path.join(os.tmpdir(), 'pdf-conversions');
  await fs.mkdir(tempDir, { recursive: true });

  const timestamp = Date.now();
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const pdfPath = path.join(tempDir, `input_${timestamp}_${sanitizedFilename}`);

  // Prepare output path in Downloads folder
  const homedir = os.homedir();
  const downloadsDir = path.join(homedir, 'Downloads');
  
  // Create filename without .pdf extension
  const baseName = path.parse(sanitizedFilename).name.replace(/\.pdf$/i, '');
  let outputPath = path.join(downloadsDir, `converted_${baseName}_${timestamp}.docx`);

  // Fallback to temp directory if Downloads isn't accessible
  try {
    await fs.access(downloadsDir);
  } catch (err) {
    console.warn('Downloads directory not accessible, using temp directory instead');
    outputPath = path.join(tempDir, `converted_${baseName}_${timestamp}.docx`);
  }

  try {
    // Write PDF to disk
    await fs.writeFile(pdfPath, file.buffer);
    jobStore.set(jobId, { ...jobStore.get(jobId), progress: 20 });

    // Configure Python conversion
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [pdfPath, outputPath],
      pythonPath: process.env.PYTHON_PATH || 'python3'
    };

    // Execute conversion
    const result = await new Promise((resolve, reject) => {
      const pyshell = new PythonShell('converter.py', options);
      let output = '';

      pyshell.on('message', (message) => {
        console.log(`Job ${jobId}:`, message);
        output += message;
        const currentProgress = jobStore.get(jobId).progress;
        jobStore.set(jobId, {
          ...jobStore.get(jobId),
          progress: Math.min(currentProgress + 10, 90),
          logs: (jobStore.get(jobId).logs || []).concat(message)
        });
      });

      pyshell.end((err) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    // Verify output
    await fs.access(outputPath);
    const stats = await fs.stat(outputPath);
    
    if (stats.size === 0) {
      throw new Error('Conversion resulted in empty file');
    }

    // Update job status
    jobStore.set(jobId, {
      status: 'completed',
      progress: 100,
      filePath: outputPath,
      fileSize: stats.size,
      completedAt: new Date(),
      downloadUrl: `/download/${jobId}`
    });

  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  } finally {
    // Cleanup temp input PDF
    await fs.unlink(pdfPath).catch(() => {});
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Temp directory: ${path.join(os.tmpdir(), 'pdf-conversions')}`);
  console.log(`Files will be saved to: ${path.join(os.homedir(), 'Downloads')}`);
});