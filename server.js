require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Create temp directory on startup
const tempDir = path.join(os.tmpdir(), 'pdf-conversions');
(async () => {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`Temporary directory ready: ${tempDir}`);
  } catch (err) {
    console.error('Failed to create temp directory:', err);
  }
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Conversion endpoint
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate file type
  if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  let pdfPath, outputPath;
  try {
    // Sanitize filename
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const timestamp = Date.now();
    pdfPath = path.join(tempDir, `input_${timestamp}_${sanitizedFilename}`);
    outputPath = path.join(tempDir, `output_${timestamp}_${path.parse(sanitizedFilename).name}.docx`);
    
    // Write buffer to file
    await fs.writeFile(pdfPath, req.file.buffer);

    // Configure PythonShell
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [pdfPath, outputPath],
      pythonPath: process.env.PYTHON_PATH || 'python3'
    };

    console.log('Starting Python conversion with options:', options);

    const { output, error } = await executePythonScript(options);

    // Verify output file was created
    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(error || 'Conversion failed - no output file created');
    }

    // Send the converted file
    const docxFile = await fs.readFile(outputPath);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
    return res.send(docxFile);

  } catch (error) {
    console.error('Conversion error:', error);
    return res.status(500).json({ 
      error: 'Conversion failed',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    });
  } finally {
    // Cleanup files
    await cleanupFiles([pdfPath, outputPath]);
  }
});

// Helper function to execute Python script
async function executePythonScript(options) {
  return new Promise((resolve, reject) => {
    const pyshell = new PythonShell('converter.py', options);
    let output = '';
    let error = '';

    pyshell.on('message', (message) => {
      console.log('Python stdout:', message);
      output += message;
    });

    pyshell.on('stderr', (stderr) => {
      console.error('Python stderr:', stderr);
      error += stderr;
    });

    pyshell.on('error', (err) => {
      console.error('PythonShell error:', err);
      error += err.message;
    });

    pyshell.end((err) => {
      if (err || error) {
        reject(new Error(error || 'Python process failed'));
      } else {
        resolve({ output, error });
      }
    });
  });
}

// Helper function to cleanup files
async function cleanupFiles(filePaths) {
  await Promise.all(
    filePaths.filter(Boolean).map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error(`Failed to delete ${filePath}:`, err);
      }
    })
  );
}

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Temporary files directory: ${tempDir}`);
});