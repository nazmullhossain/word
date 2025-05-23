const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure storage - use memory storage for Heroku
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// POST endpoint for PDF to DOCX conversion
app.post('/convert', upload.single('pdfFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Create a temporary file
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  
  const pdfPath = path.join(tempDir, `${Date.now()}-${req.file.originalname}`);
  fs.writeFileSync(pdfPath, req.file.buffer);

  const outputFileName = `${path.parse(req.file.originalname).name}.docx`;
  const outputPath = path.join(tempDir, outputFileName);

  const options = {
    mode: 'text',
    pythonOptions: ['-u'], // unbuffered output
    scriptPath: __dirname,
    args: [pdfPath, outputPath]
  };

  const pyshell = new PythonShell("pdf-to-docx-python-script.py", options);

  let pythonOutput = '';

  pyshell.on('message', (message) => {
    console.log('Python:', message);
    pythonOutput += message;
  });

  pyshell.on('error', (error) => {
    console.error('Python Error:', error);
    cleanupFiles(pdfPath, outputPath);
    res.status(500).json({ error: 'Python script failed', details: error.toString() });
  });

  pyshell.end((err) => {
    if (err) {
      console.error('PythonShell Error:', err);
      cleanupFiles(pdfPath, outputPath);
      return res.status(500).json({ error: 'Conversion failed', details: err.toString() });
    }

    if (pythonOutput.includes('success') && fs.existsSync(outputPath)) {
      res.download(outputPath, outputFileName, (err) => {
        cleanupFiles(pdfPath, outputPath);
        if (err) console.error('Error sending file:', err);
      });
    } else {
      cleanupFiles(pdfPath, outputPath);
      res.status(500).json({ 
        error: 'Conversion failed',
        details: pythonOutput || 'Unknown Python script error'
      });
    }
  });
});

function cleanupFiles(...files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error(`Error deleting ${file}:`, err);
      }
    }
  });
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});