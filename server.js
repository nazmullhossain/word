const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const os = require('os'); // Add this to get the system's home directory

const app = express();
const port = 3000;

app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Serve static files (frontend)
app.use(express.static('public'));

// POST endpoint for PDF to DOCX conversion
app.post('/convert', upload.single('pdfFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfPath = req.file.path;
  // Get the system's Downloads folder path
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const outputFileName = `${path.parse(req.file.originalname).name}.docx`;
  const outputPath = path.join(downloadsPath, outputFileName);

  const options = {
    mode: 'text',
    pythonPath: 'C:\\Users\\APP_DEV_2\\AppData\\Local\\Programs\\Python\\Python313\\python.exe',
    scriptPath: __dirname,
    args: [pdfPath, downloadsPath] // Pass the Downloads folder path to Python
  };

  const pyshell = new PythonShell("./pdf-to-docx/pdf-to-docx-python-script.py", options);

  let pythonOutput = '';

  pyshell.on('message', (message) => {
    console.log('Python:', message);
    pythonOutput += message;
  });

  pyshell.on('error', (error) => {
    console.error('Python Error:', error);
    fs.unlink(pdfPath, () => {});
    res.status(500).json({ error: 'Python script failed', details: error.toString() });
  });

  pyshell.end((err) => {
    if (err) {
      console.error('PythonShell Error:', err);
      fs.unlink(pdfPath, () => {});
      return res.status(500).json({ error: 'Conversion failed', details: err.toString() });
    }

    if (pythonOutput.includes('success')) {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Error deleting PDF:', err);
      });
      res.json({ 
        success: true,
        // Since the file is in Downloads, we can't serve it directly, so just return the path
        filePath: outputPath,
        fileName: outputFileName
      });
    } else {
      fs.unlink(pdfPath, () => {});
      res.status(500).json({ 
        error: 'Conversion failed',
        details: pythonOutput || 'Unknown Python script error'
      });
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});