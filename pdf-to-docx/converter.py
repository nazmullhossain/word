import sys
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        # Convert PDF to DOCX
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        print("Conversion completed successfully")
    except Exception as e:
        print(f"Error during conversion: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_pdf> <output_docx>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]
    convert_pdf_to_docx(pdf_path, docx_path)