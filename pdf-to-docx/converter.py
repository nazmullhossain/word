import sys
import traceback

def check_dependencies():
    try:
        from pdf2docx import Converter
        return True
    except ImportError as e:
        print(f"CRITICAL: Required package not found: {e}", file=sys.stderr)
        print("Please install pdf2docx package using:", file=sys.stderr)
        print("pip install pdf2docx", file=sys.stderr)
        return False

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        from pdf2docx import Converter
        
        print(f"Starting conversion: {pdf_path} → {docx_path}")
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        print("Conversion completed successfully")
        return True
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return False

if __name__ == "__main__":
    if not check_dependencies():
        sys.exit(1)
        
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_pdf> <output_docx>", file=sys.stderr)
        sys.exit(1)
        
    pdf_file = sys.argv[1]
    docx_file = sys.argv[2]
    
    success = convert_pdf_to_docx(pdf_file, docx_file)
    
    if success:
        print('{"status": "success"}')
        sys.exit(0)
    else:
        print('{"status": "error", "message": "PDF conversion failed"}', file=sys.stderr)
        sys.exit(1)