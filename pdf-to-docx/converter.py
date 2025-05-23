import sys
import traceback
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        print(f"Starting conversion: {pdf_path} → {docx_path}")
        
        # Initialize converter
        cv = Converter(pdf_path)
        
        # Convert all pages
        cv.convert(docx_path, start=0, end=None)
        
        # Close the converter
        cv.close()
        
        print("Conversion completed successfully")
        return True
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_pdf> <output_docx>", file=sys.stderr)
        sys.exit(1)
        
    pdf_file = sys.argv[1]
    docx_file = sys.argv[2]
    
    print(f"Received arguments: PDF={pdf_file}, DOCX={docx_file}")
    
    success = convert_pdf_to_docx(pdf_file, docx_file)
    
    if success:
        print('{"status": "success"}')
        sys.exit(0)
    else:
        print('{"status": "error", "message": "PDF conversion failed"}', file=sys.stderr)
        sys.exit(1)