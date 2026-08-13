from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

OUTPUT = Path("output/pdf/slotboard-m5-sample.pdf")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

page_width, page_height = 1280, 720
document = canvas.Canvas(str(OUTPUT), pagesize=(page_width, page_height))

def header(title, subtitle):
    document.setFillColor(HexColor("#f4f4f0"))
    document.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    document.setFillColor(HexColor("#20211f"))
    document.setFont("STSong-Light", 24)
    document.drawString(42, page_height - 48, title)
    document.setFillColor(HexColor("#777b73"))
    document.setFont("Helvetica", 10)
    document.drawString(42, page_height - 68, subtitle)

header("SlotBoard 流程總覽", "M5 PDF LAYOUT SAMPLE")
cards = [(70, 470, "01  MG 主畫面"), (360, 470, "02  Scatter 觸發"), (660, 530, "03  FG Intro"), (660, 370, "04  普通得分")]
for x, y, label in cards:
    document.setFillColor(HexColor("#ffffff")); document.setStrokeColor(HexColor("#40413e"))
    document.roundRect(x, y, 210, 105, 8, fill=1, stroke=1)
    document.setFillColor(HexColor("#3f403c")); document.rect(x + 14, y + 42, 182, 48, fill=1, stroke=0)
    document.setFillColor(HexColor("#20211f")); document.setFont("STSong-Light", 12); document.drawString(x + 14, y + 20, label)

document.setStrokeColor(HexColor("#727a34")); document.setLineWidth(2)
for x1, y1, x2, y2, label in [(280, 522, 360, 522, "Scatter"), (570, 522, 660, 582, "Trigger"), (570, 522, 660, 422, "Normal")]:
    document.line(x1, y1, x2, y2)
    document.setFillColor(HexColor("#596019")); document.setFont("Helvetica", 9); document.drawString((x1+x2)/2-15, (y1+y2)/2+7, label)
document.setFillColor(HexColor("#777b73")); document.setFont("STSong-Light", 10)
document.drawString(42, 35, "第一頁顯示完整流程、分支與連線文字。")
document.showPage()

header("01  MG 主畫面", "960 x 540 / visible layers only")
scene_x, scene_y, scene_w, scene_h = 42, 100, 850, 478
document.setFillColor(HexColor("#494a47")); document.rect(scene_x, scene_y, scene_w, scene_h, fill=1, stroke=0)
document.setFillColor(HexColor("#242522")); document.rect(scene_x + 185, scene_y + 82, 480, 320, fill=1, stroke=0)
tones = ["#f1f1ee", "#d4d5d0", "#b4b5b0", "#92938f", "#747570"]
for col in range(5):
    for row in range(3):
        document.setFillColor(HexColor(tones[col])); document.rect(scene_x + 198 + col*92, scene_y + 96 + row*98, 82, 86, fill=1, stroke=0)
document.setFillColor(HexColor("#20211f")); document.setFont("STSong-Light", 17); document.drawString(925, 555, "場景標註")
notes = ["1  盤面為主要視覺焦點", "2  背景維持較深灰階", "3  Scatter 觸發後前往 Scene 02"]
for index, note in enumerate(notes):
    y = 510 - index * 90
    document.setFillColor(HexColor("#d9ff43")); document.circle(940, y, 13, fill=1, stroke=0)
    document.setFillColor(HexColor("#20211f")); document.setFont("STSong-Light", 11); document.drawString(965, y - 4, note)
document.setFillColor(HexColor("#777b73")); document.setFont("STSong-Light", 10); document.drawString(925, 160, "上游：無"); document.drawString(925, 140, "下游：Scatter 觸發")
document.showPage()
document.save()
print(OUTPUT)
