from pathlib import Path
import pymupdf

source = Path("output/pdf/slotboard-m5-sample.pdf")
target = Path("tmp/pdfs")
target.mkdir(parents=True, exist_ok=True)
document = pymupdf.open(source)
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
    pixmap.save(target / f"slotboard-m5-page-{index + 1}.png")
print(f"pages={document.page_count}")
