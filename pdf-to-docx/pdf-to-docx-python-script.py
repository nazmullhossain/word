import sys
import os
import json
import tempfile
from pdf2docx import Converter
import traceback

def validate_paths(pdf_path, output_dir):
    """Validate input and output paths"""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    if not os.path.isfile(pdf_path):
        raise ValueError(f"Path is not a file: {pdf_path}")
    if not pdf_path.lower().endswith('.pdf'):
        raise ValueError("Input file must be a PDF")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

def pdf_to_docx(pdf_path, output_dir):
    """Convert PDF to DOCX with proper resource handling"""
    try:
        validate_paths(pdf_path, output_dir)
        
        pdf_name = os.path.basename(pdf_path)
        docx_name = os.path.splitext(pdf_name)[0] + '.docx'
        docx_path = os.path.join(output_dir, docx_name)

        # Use context manager to ensure proper resource cleanup
        with Converter(pdf_path) as cv:
            cv.convert(docx_path, start=0, end=None)
        
        return {
            "status": "success",
            "output_path": docx_path,
            "file_name": docx_name
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    try:
        if len(sys.argv) < 3:
            raise ValueError("Usage: python script.py <pdf_path> <output_dir>")

        pdf_path = sys.argv[1]
        output_dir = sys.argv[2]

        result = pdf_to_docx(pdf_path, output_dir)
        
        # Print JSON result for Node.js to capture
        print(json.dumps(result))
        
        sys.exit(0 if result["status"] == "success" else 1)
        
    except Exception as e:
        error_result = {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()