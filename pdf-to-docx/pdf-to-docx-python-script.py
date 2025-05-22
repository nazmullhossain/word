import sys
import os
import json
from pdf2docx import Converter

def pdf_to_docx(pdf_path, output_dir):
    try:
        os.makedirs(output_dir, exist_ok=True)
        pdf_name = os.path.basename(pdf_path)
        docx_name = pdf_name.replace('.pdf', '.docx')
        docx_path = os.path.join(output_dir, docx_name)

        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()

        print(json.dumps({
            "status": "success",
            "output_path": docx_path
        }))
        return True
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "status": "error",
            "message": "Usage: python script.py <pdf_path> <output_dir>"
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(json.dumps({
            "status": "error",
            "message": f"File not found: {pdf_path}"
        }))
        sys.exit(1)

    success = pdf_to_docx(pdf_path, output_dir)
    sys.exit(0 if success else 1)