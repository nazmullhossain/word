import sys
import os
import json
from pdfminer.high_level import extract_text
from docx import Document

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        text = extract_text(pdf_path)
        doc = Document()
        
        # Preserve paragraphs
        for paragraph in text.split('\n\n'):
            if paragraph.strip():
                doc.add_paragraph(paragraph)
        
        doc.save(docx_path)
        return True
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Conversion failed: {str(e)}"
        }))
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({
            "status": "error",
            "message": "Usage: python script.py <pdf_path> <docx_path>"
        }))
        sys.exit(1)
        
    success = convert_pdf_to_docx(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)