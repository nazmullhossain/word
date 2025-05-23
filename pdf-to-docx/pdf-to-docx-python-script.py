import sys
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_path, output_path):
    try:
        cv = Converter(pdf_path)
        cv.convert(output_path, start=0, end=None)
        cv.close()
        print("success: File converted successfully")
    except Exception as e:
        print(f"error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("error: Please provide PDF path and output path")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    convert_pdf_to_docx(pdf_path, output_path)