from PIL import Image, ImageDraw

SIZE = 512
BG = "#2e7d52"
CARD = "#f5f5f0"
RING = "#16161d"
CHECK = "#2e7d52"

def make_icon(size):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, SIZE, SIZE], radius=SIZE*0.22, fill=BG)

    card_pad = SIZE * 0.16
    card_top = SIZE * 0.22
    card_bottom = SIZE * 0.86
    d.rounded_rectangle([card_pad, card_top, SIZE-card_pad, card_bottom], radius=SIZE*0.07, fill=CARD)

    header_h = SIZE * 0.12
    d.rounded_rectangle([card_pad, card_top, SIZE-card_pad, card_top+header_h], radius=SIZE*0.07, fill=RING)
    d.rectangle([card_pad, card_top+header_h*0.5, SIZE-card_pad, card_top+header_h], fill=RING)

    ring_w = SIZE * 0.035
    ring_y0 = card_top - SIZE*0.04
    ring_y1 = card_top + SIZE*0.05
    for rx in (SIZE*0.34, SIZE*0.66):
        d.rounded_rectangle([rx-ring_w/2, ring_y0, rx+ring_w/2, ring_y1], radius=ring_w/2, fill=RING)

    cx, cy = SIZE*0.5, SIZE*0.60
    d.line([(cx-SIZE*0.12, cy+SIZE*0.02), (cx-SIZE*0.03, cy+SIZE*0.11), (cx+SIZE*0.16, cy-SIZE*0.10)],
           fill=CHECK, width=int(SIZE*0.045), joint="curve")

    return img.resize((size, size), Image.LANCZOS) if size != SIZE else img

Image.alpha_composite(Image.new("RGBA", (SIZE, SIZE), BG), make_icon(SIZE)).convert("RGB").save("icon-512.png")
Image.alpha_composite(Image.new("RGBA", (192, 192), BG), make_icon(192)).convert("RGB").save("icon-192.png")
Image.alpha_composite(Image.new("RGBA", (180, 180), BG), make_icon(180)).convert("RGB").save("apple-touch-icon.png")
print("done")
