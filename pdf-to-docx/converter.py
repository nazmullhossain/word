import sys
import os
import traceback

try:
    from pdf2docx import Converter
    USE_CONVERTER = True
except ImportError:
    try:
        from pdf2docx import parse
        USE_CONVERTER = False
    except ImportError:
        print("[ERROR] Neither pdf2docx nor pdf2docx2 are installed")
        sys.exit(1)

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        print(f"[INFO] Starting conversion: {pdf_path}")
        print(f"[INFO] Using method: {'Converter' if USE_CONVERTER else 'parse'}")
        
        if not os.path.exists(pdf_path):
            print(f"[ERROR] Input file not found: {pdf_path}")
            return False
        
        # Method 1: Using Converter (for pdf2docx)
        if USE_CONVERTER:
            cv = Converter(pdf_path)
            cv.convert(docx_path, start=0, end=None)
            cv.close()
        # Method 2: Using parse (alternative)
        else:
            parse(pdf_path, docx_path)
        
        # Verify output
        if os.path.exists(docx_path):
            file_size = os.path.getsize(docx_path)
            print(f"[SUCCESS] Conversion completed: {docx_path} ({file_size} bytes)")
            return True
        else:
            print("[ERROR] Output file was not created")
            return False
            
    except Exception as e:
        print(f"[ERROR] Conversion failed: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_pdf> <output_docx>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]
    
    success = convert_pdf_to_docx(pdf_path, docx_path)
    sys.exit(0 if success else 1)