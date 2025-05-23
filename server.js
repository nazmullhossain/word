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
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure storage with file size limits
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Create temp directory on startup
const tempDir = path.join(os.tmpdir(), 'pdf-conversions');
fs.mkdir(tempDir, { recursive: true })
  .then(() => console.log(`Temporary directory ready: ${tempDir}`))
  .catch(err => console.error('Failed to create temp directory:', err));

// POST endpoint for PDF to DOCX conversion
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

    // Configure PythonShell with proper paths
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [
        pdfPath, 
        outputPath,
        '--debug' // Add debug flag if needed
      ],
      pythonPath: process.env.PYTHON_PATH || 'python3'
    };

    console.log('PythonShell options:', options);

    const result = await new Promise((resolve, reject) => {
      const pyshell = new PythonShell('converter.py', options);
      let output = '';

      pyshell.on('message', (message) => {
        console.log('Python:', message);
        output += message;
      });

      pyshell.on('error', (error) => {
        console.error('PythonShell error:', error);
        reject(new Error(`Python error: ${error.message}`));
      });

      pyshell.end((err) => {
        if (err) {
          reject(new Error(`Python process failed: ${err.message}`));
        } else {
          resolve(output);
        }
      });
    });

    // Check if output file exists
    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(result || 'Conversion failed - no output file created');
    }

    // Read and send the converted file
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
        stack: error.stack,
        pythonOutput: result
      })
    });
  } finally {
    // Cleanup files
    const cleanup = async (filePath) => {
      try {
        if (filePath) await fs.unlink(filePath);
      } catch (err) {
        console.error(`Failed to cleanup ${filePath}:`, err);
      }
    };
    
    await Promise.all([cleanup(pdfPath), cleanup(outputPath)]);
  }
});

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