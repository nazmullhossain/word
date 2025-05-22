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

app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Received file:', req.file.originalname);
    const pdfPath = path.resolve(req.file.path);
    const outputDir = process.env.TMPDIR || '/tmp';
    const outputFileName = `${path.parse(req.file.originalname).name}.docx`;
    const outputPath = path.join(outputDir, outputFileName);

    console.log('Conversion paths:', { pdfPath, outputPath });

    // Verify Python script exists
    const pythonScript = path.join(__dirname, 'pdf-to-docx', 'pdf-to-docx-python-script.py');
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Python script not found at ${pythonScript}`);
    }

    const options = {
      mode: 'text',
      pythonPath: process.env.PYTHON_PATH || 'python3',
      scriptPath: path.dirname(pythonScript),
      args: [pdfPath, outputDir]
    };

    console.log('PythonShell options:', options);

    const conversionResult = await new Promise((resolve, reject) => {
      const pyshell = new PythonShell(path.basename(pythonScript), options);
      let output = '';

      pyshell.on('message', (message) => {
        console.log('Python:', message);
        output += message;
      });

      pyshell.on('error', (error) => {
        console.error('Python Error:', error);
        reject(error);
      });

      pyshell.end((err) => {
        if (err) return reject(err);
        resolve(output);
      });
    });

    if (!conversionResult.includes('success')) {
      throw new Error(conversionResult || 'Conversion failed without error message');
    }

    // Stream the file back
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    fs.createReadStream(outputPath).pipe(res)
      .on('finish', () => {
        // Cleanup
        [pdfPath, outputPath].forEach(file => {
          fs.unlink(file, (err) => err && console.error('Cleanup error:', err));
        });
      });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});