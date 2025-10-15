import sys
import os
import subprocess
import traceback

def convert_pdf_to_docx(pdf_path, docx_path):
    try:
        print(f"[INFO] Using alternative conversion method for: {pdf_path}")
        
        if not os.path.exists(pdf_path):
            print(f"[ERROR] Input file not found: {pdf_path}")
            return False
        
        # Method 1: Try using pdf2docx parse
        try:
            from pdf2docx import parse
            parse(pdf_path, docx_path)
        except Exception as e:
            print(f"[WARNING] pdf2docx failed: {e}")
            # Method 2: Try using LibreOffice (if available)
            try:
                result = subprocess.run([
                    'libreoffice', '--headless', '--convert-to', 'docx', 
                    '--outdir', os.path.dirname(docx_path), pdf_path
                ], capture_output=True, text=True, timeout=60)
                
                if result.returncode != 0:
                    raise Exception(f"LibreOffice failed: {result.stderr}")
                    
                # LibreOffice creates file with same name but .docx extension
                base_name = os.path.splitext(os.path.basename(pdf_path))[0]
                lo_output = os.path.join(os.path.dirname(docx_path), f"{base_name}.docx")
                
                if os.path.exists(lo_output):
                    os.rename(lo_output, docx_path)
                else:
                    raise Exception("LibreOffice output file not found")
                    
            except Exception as lo_error:
                print(f"[WARNING] LibreOffice also failed: {lo_error}")
                return False
        
        # Verify output
        if os.path.exists(docx_path):
            file_size = os.path.getsize(docx_path)
            print(f"[SUCCESS] Conversion completed: {docx_path} ({file_size} bytes)")
            return True
        else:
            print("[ERROR] Output file was not created")
            return False
            
    except Exception as e:
        print(f"[ERROR] All conversion methods failed: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python converter.py <input_pdf> <output_docx>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]
    convert_pdf_to_docx(pdf_path, docx_path)