import sys
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_path):
    try:
        # Derive the output DOCX path from the input PDF path
        docx_path = pdf_path.replace('.pdf', '.docx')
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        return True, docx_path
    except Exception as e:
        print(f"Error converting PDF to DOCX: {e}")
        return False, None

# Check if PDF path is provided as command-line argument
if len(sys.argv) < 2:
    print("Usage: python script.py <pdf_path>")
    sys.exit(1)

pdf_path = sys.argv[1]
success, docx_path = convert_pdf_to_docx(pdf_path)

if success:
    print(f"PDF converted to DOCX successfully: {docx_path}")
else:
    print("Failed to convert PDF to DOCX")
