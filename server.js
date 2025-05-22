const express = require('express');
const multer = require('multer');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Configure for ephemeral storage (Heroku compatible)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));

// POST endpoint for PDF to DOCX conversion
app.post('/convert', upload.single('pdfFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfPath = req.file.path;
  // Use temporary directory in Heroku
  const outputDir = process.env.TMPDIR || '/tmp';
  const outputFileName = `${path.parse(req.file.originalname).name}.docx`;
  const outputPath = path.join(outputDir, outputFileName);

  const options = {
    mode: 'text',
    // Let the system determine Python path
    pythonOptions: ['-u'], // unbuffered output
    scriptPath: __dirname,
    args: [pdfPath, outputDir]
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
      // Read the converted file and send it as response
      fs.readFile(outputPath, (err, data) => {
        fs.unlink(pdfPath, () => {});
        
        if (err) {
          return res.status(500).json({ error: 'Could not read converted file' });
        }
        
        // Send the file directly since we can't rely on persistent storage
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.send(data);
        
        // Clean up
        fs.unlink(outputPath, () => {});
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


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});