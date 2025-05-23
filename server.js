const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());


const upload = multer({ storage: multer.memoryStorage() });

// Serve static files (frontend)
app.use(express.static('public'));

// POST endpoint for PDF to DOCX conversion
app.post('/convert', upload.single('pdfFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Create a temporary file path
  const tempPdfPath = `/tmp/${Date.now()}-${req.file.originalname}`;
  const tempDocxPath = `/tmp/${Date.now()}-${req.file.originalname.replace('.pdf', '.docx')}`;

  // Write the uploaded file to a temporary location
  fs.writeFileSync(tempPdfPath, req.file.buffer);

  const options = {
    mode: 'text',
    pythonOptions: ['-u'], // unbuffered output
    args: [tempPdfPath, tempDocxPath]
  };

  const pyshell = new PythonShell("./pdf-to-docx/pdf-to-docx-python-script.py", options);

  pyshell.on('error', (error) => {
    console.error('Python Error:', error);
    cleanupFiles(tempPdfPath, tempDocxPath);
    res.status(500).json({ error: 'Python script failed', details: error.toString() });
  });

  pyshell.end((err) => {
    if (err) {
      console.error('PythonShell Error:', err);
      cleanupFiles(tempPdfPath, tempDocxPath);
      return res.status(500).json({ error: 'Conversion failed', details: err.toString() });
    }

    try {
      if (fs.existsSync(tempDocxPath)) {
        const docxFile = fs.readFileSync(tempDocxPath);
        cleanupFiles(tempPdfPath, tempDocxPath);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace('.pdf', '.docx')}"`);
        res.send(docxFile);
      } else {
        cleanupFiles(tempPdfPath, tempDocxPath);
        res.status(500).json({ error: 'Conversion failed', details: 'Output file not created' });
      }
    } catch (e) {
      cleanupFiles(tempPdfPath, tempDocxPath);
      res.status(500).json({ error: 'File handling failed', details: e.toString() });
    }
  });
});

function cleanupFiles(...files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        console.error(`Error deleting ${file}:`, e);
      }
    }
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});