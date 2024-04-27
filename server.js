const { PythonShell } = require('python-shell');
const path = require('path');

const pyshell=new PythonShell("./pdf-to-docx/pdf-to-docx-python-script.py",{
    mode: 'text',
    pythonPath: 'python', // Change this to the path of your Python interpreter if necessary
    // pythonOptions: ['-u'], // unbuffered output
    scriptPath: __dirname, // Root directory
    args: ["./sample.pdf","./"] // Optional arguments to pass to the Python script
})

pyshell.on("message",(message)=>{
    console.log(message);
})

pyshell.on("error",(message)=>{
    console.log(message);
})

pyshell.end((err)=>{
    console.log(err);
})
