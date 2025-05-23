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
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Job status
app.get('/status/:jobId', (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Upload and convert
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  jobStore.set(jobId, {
    status: 'processing',
    progress: 0,
    createdAt: new Date()
  });

  processConversion(jobId, req.file).catch(err => {
    console.error(`Job ${jobId} failed:`, err);
    jobStore.set(jobId, {
      status: 'failed',
      error: err.message,
      completedAt: new Date()
    });
  });

  res.status(202).json({
    status: 'processing',
    jobId,
    message: `Conversion started. Poll /status/${jobId} for updates`
  });
});

// Background conversion logic
async function processConversion(jobId, file) {
  const tempDir = path.join(os.tmpdir(), 'pdf-conversions');
  await fs.mkdir(tempDir, { recursive: true });

  const timestamp = Date.now();
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const pdfPath = path.join(tempDir, `input_${timestamp}_${sanitizedFilename}`);

  // Save output to user's Downloads folder
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const outputPath = path.join(downloadsDir, `output_${timestamp}_${path.parse(sanitizedFilename).name}.docx`);

  try {
    await fs.writeFile(pdfPath, file.buffer);
    jobStore.set(jobId, { ...jobStore.get(jobId), progress: 20 });

    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [pdfPath, outputPath],
      pythonPath: process.env.PYTHON_PATH || 'python3'
    };

    const result = await new Promise((resolve, reject) => {
      const pyshell = new PythonShell('converter.py', options);
      let output = '';

      pyshell.on('message', (message) => {
        console.log(`Job ${jobId}:`, message);
        output += message;
        jobStore.set(jobId, {
          ...jobStore.get(jobId),
          progress: Math.min(jobStore.get(jobId).progress + 10, 90)
        });
      });

      pyshell.end((err) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    await fs.access(outputPath);

    jobStore.set(jobId, {
      status: 'completed',
      progress: 100,
      filePath: outputPath,
      completedAt: new Date()
    });

  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  } finally {
    await fs.unlink(pdfPath).catch(() => {});
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Converted files will be saved to Downloads: ${path.join(os.homedir(), 'Downloads')}`);
});
