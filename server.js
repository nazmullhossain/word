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
app.use(express.static('public'));

// Configure storage - use memory storage for Heroku
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST endpoint for PDF to DOCX conversion
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Create a temporary file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const pdfPath = path.join(tempDir, `${Date.now()}-${req.file.originalname}`);
    const outputPath = path.join(tempDir, `${path.parse(req.file.originalname).name}.docx`);
    
    // Write buffer to file
    await fs.promises.writeFile(pdfPath, req.file.buffer);

    const options = {
      mode: 'text',
      pythonOptions: ['-u'], // unbuffered output
      scriptPath: __dirname,
      args: [pdfPath, outputPath]
    };

    const pyshell = new PythonShell("./pdf-to-docx/pdf-to-docx-python-script.py", options);

    let pythonOutput = '';

    pyshell.on('message', (message) => {
      console.log('Python:', message);
      pythonOutput += message;
    });

    const result = await new Promise((resolve, reject) => {
      pyshell.on('error', reject);
      
      pyshell.end((err) => {
        if (err) return reject(err);
        resolve(pythonOutput);
      });
    });

    if (result.includes('success')) {
      // Read the converted file
      const docxFile = await fs.promises.readFile(outputPath);
      
      // Clean up files
      await Promise.all([
        fs.promises.unlink(pdfPath),
        fs.promises.unlink(outputPath)
      ]);

      // Send the file directly
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
      return res.send(docxFile);
    } else {
      throw new Error(result || 'Conversion failed');
    }
  } catch (error) {
    console.error('Conversion error:', error);
    return res.status(500).json({ 
      error: 'Conversion failed',
      details: error.message
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname,  'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});