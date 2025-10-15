import sys
import os
from pdf2docx import Converter
import traceback

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        print(f"[INFO] Starting conversion: {pdf_path}")
        
        # Check if input file exists
        if not os.path.exists(pdf_path):
            print(f"[ERROR] Input file not found: {pdf_path}")
            return False
            
        # Initialize converter with error handling
        cv = Converter(pdf_path)
        print("[INFO] PDF loaded successfully")
        
        # Convert with progress tracking
        cv.convert(docx_path, start=0, end=None)
        print("[INFO] Conversion process completed")
        
        cv.close()
        print("[INFO] Converter closed")
        
        # Verify output file was created
        if os.path.exists(docx_path):
            file_size = os.path.getsize(docx_path)
            print(f"[SUCCESS] Conversion completed: {docx_path} ({file_size} bytes)")
            return True
        else:
            print("[ERROR] Output file was not created")
            return False
            
    except Exception as e:
        print(f"[ERROR] Conversion failed: {str(e)}")
        print(f"[DEBUG] Full error details:")
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