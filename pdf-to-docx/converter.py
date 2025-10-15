import sys
import os
import traceback

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        print(f"[INFO] Starting conversion: {pdf_path} -> {docx_path}")
        
        if not os.path.exists(pdf_path):
            print(f"[ERROR] Input file not found: {pdf_path}")
            return False
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(docx_path), exist_ok=True)
        
        # Use the parse function which is more reliable than Converter
        from pdf2docx import parse
        
        print("[INFO] Converting PDF to DOCX...")
        parse(pdf_path, docx_path)
        
        # Verify the output file was created
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