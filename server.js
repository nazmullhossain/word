const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
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
    // Create temp directory using OS-specific temp dir
    const tempDir = path.join(os.tmpdir(), 'pdf-conversions');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Generate unique filenames
    const timestamp = Date.now();
    pdfPath = path.join(tempDir, `input_${timestamp}_${req.file.originalname}`);
    outputPath = path.join(tempDir, `output_${timestamp}_${path.parse(req.file.originalname).name}.docx`);
    
    // Write buffer to file
    await fs.promises.writeFile(pdfPath, req.file.buffer);

    // Configure PythonShell with proper paths
    const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, 'pdf-to-docx'),
      args: [pdfPath, outputPath],
      pythonPath: process.env.PYTHON_PATH || 'python3'
    };

    // Use the correct script name (assuming you renamed it to converter.py)
    const pyshell = new PythonShell('converter.py', options);

    let conversionSuccess = false;
    let pythonOutput = '';

    pyshell.on('message', (message) => {
      console.log('Python:', message);
      pythonOutput += message;
      if (message.includes('status') && JSON.parse(message).status === 'success') {
        conversionSuccess = true;
      }
    });

    await new Promise((resolve, reject) => {
      pyshell.on('error', (err) => {
        console.error('PythonShell error:', err);
        reject(err);
      });
      
      pyshell.end((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (conversionSuccess) {
      // Read and send the converted file
      const docxFile = await fs.promises.readFile(outputPath);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
      return res.send(docxFile);
    } else {
      throw new Error(pythonOutput || 'Conversion failed without specific error');
    }
  } catch (error) {
    console.error('Conversion error:', error);
    return res.status(500).json({ 
      error: 'Conversion failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Cleanup files in all cases
    try {
      if (pdfPath) await fs.promises.unlink(pdfPath).catch(console.error);
      if (outputPath) await fs.promises.unlink(outputPath).catch(console.error);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,  'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Temporary files directory: ${path.join(os.tmpdir(), 'pdf-conversions')}`);
});