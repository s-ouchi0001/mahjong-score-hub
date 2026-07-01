from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF


OUTPUT = Path("output/pdf/mahjong-score-demo-flyer.pdf")
PREVIEW_IMAGE = Path("output/pdf/mahjong-score-demo-flyer-page.png")
URL = "https://mahjong.hsou-con.com/login"

W, H = 1240, 1754
SCALE_X = W / A4[0]
SCALE_Y = H / A4[1]


def px(mm_value):
    return int(mm_value * W / 210)


def font(size, weight="regular"):
    if weight == "bold":
        path = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
    else:
        path = "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc"
    return ImageFont.truetype(path, size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_wrapped(draw, text, xy, max_width, fnt, fill, line_gap=10):
    x, y = xy
    line = ""
    for ch in text:
        trial = line + ch
        if draw.textlength(trial, font=fnt) <= max_width:
            line = trial
        else:
            draw.text((x, y), line, font=fnt, fill=fill)
            y += fnt.size + line_gap
            line = ch
    if line:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def draw_qr(c, value, x, y, size):
    code = qr.QrCodeWidget(value)
    bounds = code.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(code)
    renderPDF.draw(drawing, c, x, y)


def make_page_image():
    bg = "#f5f6f1"
    ink = "#1b221f"
    muted = "#65706b"
    accent = "#0f766e"
    accent_dark = "#12322e"
    line = "#dfe4dd"
    white = "#ffffff"

    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    margin = px(18)
    rounded(draw, (margin, px(22), W - margin, H - px(22)), px(8), white, line, 2)

    hero = (margin, px(28), W - margin, px(104))
    rounded(draw, hero, px(6), accent_dark)
    draw.text((margin + px(10), px(46)), "麻雀卓 点数収集デモ", font=font(43, "bold"), fill=white)
    draw.text((margin + px(10), px(78)), "各卓の点数をWebで確認できるデモ環境です", font=font(22), fill=white)

    qr_box_px = px(52)
    qr_x = W - margin - qr_box_px - px(8)
    qr_y = px(26)
    rounded(draw, (qr_x, qr_y, qr_x + qr_box_px, qr_y + qr_box_px), px(4), white, line, 1)
    draw.text((qr_x + px(5), qr_y + qr_box_px + px(4)), "スマホで読み取り", font=font(17), fill=ink)

    url_card = (margin, px(126), W - margin, px(204))
    rounded(draw, url_card, px(5), white, line, 2)
    draw.text((margin + px(8), px(143)), "デモURL", font=font(27, "bold"), fill=accent)
    draw.text((margin + px(8), px(168)), URL, font=ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 33), fill=ink)
    draw.text((margin + px(8), px(191)), "ログイン後、卓の状態・現在点数・通信状態を確認できます。", font=font(17), fill=muted)

    y = px(232)
    gap = px(8)
    card_w = (W - margin * 2 - gap) // 2
    card_h = px(78)
    cards = [
        ("対象者", ["雀荘・麻雀店の運営者", "複数卓の点数をまとめて見たい方", "成績管理を自動化したい方", "スタッフの確認作業を減らしたい方"]),
        ("今見られること", ["店舗ごとの卓一覧", "各卓の現在点数", "対局中・待機中の状態", "端末からの最終更新時刻"]),
    ]

    for i, (title, items) in enumerate(cards):
        x = margin + i * (card_w + gap)
        rounded(draw, (x, y, x + card_w, y + card_h), px(5), white, line, 2)
        draw.text((x + px(8), y + px(9)), title, font=font(29, "bold"), fill=accent)
        item_y = y + px(34)
        for item in items:
            draw.ellipse((x + px(9), item_y + px(4), x + px(12), item_y + px(7)), fill=accent)
            draw.text((x + px(17), item_y), item, font=font(20), fill=ink)
            item_y += px(13)

    y = px(330)
    rounded(draw, (margin, y, W - margin, y + px(92)), px(5), white, line, 2)
    draw.text((margin + px(8), y + px(12)), "後続の構想", font=font(30, "bold"), fill=accent)
    next_text = "Androidタブレットのカメラで麻雀卓を常時撮影し、点数表示を自動で読み取ります。読み取った点数はWebへ送信し、各卓の現在点数として自動反映します。"
    draw_wrapped(draw, next_text, (margin + px(8), y + px(43)), W - margin * 2 - px(16), font(22), ink, 7)
    draw.text((margin + px(8), y + px(78)), "現在はデモ段階です。カメラ認識は実機検証を進めながら精度を高めていきます。", font=font(17), fill=muted)

    footer = (margin, H - px(48), W - margin, H - px(20))
    rounded(draw, footer, px(5), accent_dark)
    footer_text = "まずはQRコードからデモ環境をご確認ください"
    tw = draw.textlength(footer_text, font=font(23, "bold"))
    draw.text(((W - tw) / 2, H - px(39)), footer_text, font=font(23, "bold"), fill=white)

    PREVIEW_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    img.save(PREVIEW_IMAGE)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    make_page_image()

    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    c.drawImage(str(PREVIEW_IMAGE), 0, 0, width=A4[0], height=A4[1])

    qr_size = 43 * mm
    margin = 18 * mm
    qr_x = A4[0] - margin - qr_size - 8 * mm + 3 * mm
    qr_y = A4[1] - 69 * mm + 2 * mm
    draw_qr(c, URL, qr_x, qr_y, qr_size)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
