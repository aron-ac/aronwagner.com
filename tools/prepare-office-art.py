#!/usr/bin/env python3
"""Prepare the homepage office illustration from its generated originals.

    python3 tools/prepare-office-art.py [--source ~/aronwagner-art/generated]

Needs Python 3 with Pillow. Reads the day and night PNGs (see assets/office/README.md),
then for each theme:
  1. normalizes alpha: the generator leaves the room at ~98% opacity with a faint haze
     outside it, so near-opaque pixels become opaque and near-clear pixels clear;
  2. paints the monitor screens (an X feed and an American Cloud dashboard) into the
     plain blue screen areas, replacing only screen-blue pixels so the microphone,
     bezels and outlines drawn in front of them stay untouched;
  3. writes 1536 and 768 pixel WebP files to assets/office/.
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'assets' / 'office'
SOURCES = {'day': '03-office-family-day.png', 'night': '04-office-family-night.png'}

# Screen corners in the 1536x1024 artwork (top-left, top-right, bottom-right,
# bottom-left), measured from the blue screen areas. A flood fill from each seed
# finds the exact pixels to replace.
SCREENS = {
    'x-feed': {'quad': [(602, 391), (773, 385), (773, 465), (602, 480)], 'seed': (690, 430)},
    'dashboard': {'quad': [(781, 385), (995, 392), (994, 484), (781, 462)], 'seed': (890, 430)},
}
SCALE = 4  # content is drawn at 4x the screen's size, then resampled into place


def font(size, bold=False):
    for path, index in (('/System/Library/Fonts/Helvetica.ttc', 1 if bold else 0),
                        ('/Library/Fonts/Arial.ttf', 0)):
        try:
            return ImageFont.truetype(path, size, index=index)
        except OSError:
            continue
    return ImageFont.load_default(size)


def bar(draw, x, y, w, h, fill):
    draw.rounded_rectangle((x, y, x + w, y + h), radius=h / 2, fill=fill)


def draw_x_feed(width, height):
    """A dark X profile feed: navigation, profile header, posts and a sidebar."""
    im = Image.new('RGB', (width, height), '#000000')
    d = ImageDraw.Draw(im)
    nav, main_right = int(width * 0.11), int(width * 0.72)
    d.text((nav / 2, 34), 'X', font=font(46, bold=True), fill='#e7e9ea', anchor='mm')
    for i in range(5):
        d.ellipse((nav / 2 - 11, 86 + i * 44, nav / 2 + 11, 108 + i * 44), outline='#e7e9ea', width=4)
    d.line((nav, 0, nav, height), fill='#2f3336', width=2)
    d.line((main_right, 0, main_right, height), fill='#2f3336', width=2)
    # Profile header.
    d.rectangle((nav + 1, 0, main_right - 1, 78), fill='#1d3b53')
    d.ellipse((nav + 20, 44, nav + 92, 116), fill='#c89f7c', outline='#000000', width=6)
    d.text((nav + 20, 128), 'Aron Wagner', font=font(30, bold=True), fill='#e7e9ea')
    d.text((nav + 20, 162), '@aronwagner', font=font(22), fill='#71767b')
    d.rounded_rectangle((main_right - 128, 92, main_right - 20, 126), radius=17, outline='#536471', width=3)
    # Posts.
    y = 200
    for lengths in ((0.82, 0.64), (0.9, 0.75, 0.42), (0.7, 0.5)):
        d.line((nav, y - 12, main_right, y - 12), fill='#2f3336', width=2)
        d.ellipse((nav + 18, y, nav + 58, y + 40), fill='#c89f7c')
        bar(d, nav + 72, y + 2, 120, 12, '#e7e9ea')
        bar(d, nav + 200, y + 2, 70, 12, '#536471')
        text_width = main_right - nav - 100
        for i, share in enumerate(lengths):
            bar(d, nav + 72, y + 24 + i * 20, text_width * share, 10, '#a6abb0')
        y += 44 + len(lengths) * 20
        for i in range(4):
            d.ellipse((nav + 72 + i * 60, y - 6, nav + 82 + i * 60, y + 4), fill='#536471')
        y += 30
    # Sidebar: search and trends.
    d.rounded_rectangle((main_right + 14, 16, width - 14, 50), radius=17, fill='#202327')
    d.rounded_rectangle((main_right + 14, 66, width - 14, height - 16), radius=16, fill='#16181c')
    for i in range(5):
        bar(d, main_right + 30, 90 + i * 52, 44, 8, '#536471')
        bar(d, main_right + 30, 106 + i * 52, (width - main_right - 60) * (0.85 - i * 0.08), 12, '#e7e9ea')
    return im


def draw_dashboard(width, height):
    """A light American Cloud console: sidebar, summary cards, a chart and a table."""
    im = Image.new('RGB', (width, height), '#f4f5f7')
    d = ImageDraw.Draw(im)
    side = int(width * 0.2)
    d.rectangle((0, 0, side, height), fill='#101418')
    # Flag-and-cloud mark: rounded tile, stripes and a cloud in the canton.
    d.rounded_rectangle((18, 18, 66, 66), radius=9, fill='#ffffff')
    for i in range(4):
        d.rectangle((44, 26 + i * 10, 62, 30 + i * 10), fill='#101418')
    for i in range(3):
        d.rectangle((22, 50 + i * 6, 62, 52 + i * 6), fill='#101418')
    d.ellipse((24, 30, 42, 44), fill='#101418')
    d.text((74, 26), 'American', font=font(17, bold=True), fill='#ffffff')
    d.text((74, 46), 'Cloud', font=font(17, bold=True), fill='#ffffff')
    for i in range(7):
        active = i == 0
        if active:
            d.rounded_rectangle((12, 96 + i * 38, side - 12, 124 + i * 38), radius=8, fill='#2a3038')
        d.ellipse((24, 104 + i * 38, 36, 116 + i * 38), fill='#e4483e' if active else '#8a939e')
        bar(d, 46, 105 + i * 38, (side - 70) * (0.8 - (i % 3) * 0.12), 10, '#ffffff' if active else '#8a939e')
    # Top bar.
    d.rectangle((side, 0, width, 56), fill='#ffffff')
    d.line((side, 56, width, 56), fill='#e2e5e9', width=2)
    d.text((side + 24, 28), 'Dashboard', font=font(24, bold=True), fill='#101418', anchor='lm')
    d.rounded_rectangle((width - 250, 14, width - 80, 42), radius=14, fill='#f0f2f4')
    d.ellipse((width - 58, 12, width - 26, 44), fill='#c89f7c')
    # Summary cards.
    card_w = (width - side - 24 * 4) / 3
    for i, accent in enumerate(('#e4483e', '#2563eb', '#16a34a')):
        x = side + 24 + i * (card_w + 24)
        d.rounded_rectangle((x, 76, x + card_w, 150), radius=10, fill='#ffffff', outline='#e2e5e9', width=2)
        bar(d, x + 16, 92, card_w * 0.45, 10, '#8a939e')
        bar(d, x + 16, 114, card_w * 0.3, 20, '#101418')
        d.ellipse((x + card_w - 34, 96, x + card_w - 16, 114), fill=accent)
    # Usage chart.
    cx0, cy0, cx1, cy1 = side + 24, 170, width - 24 - int((width - side) * 0.34), height - 24
    d.rounded_rectangle((cx0, cy0, cx1, cy1), radius=10, fill='#ffffff', outline='#e2e5e9', width=2)
    bar(d, cx0 + 16, cy0 + 16, 110, 10, '#8a939e')
    points = [0.55, 0.62, 0.5, 0.68, 0.6, 0.74, 0.7, 0.8, 0.72, 0.86]
    span_x, top, bottom = cx1 - cx0 - 40, cy0 + 44, cy1 - 18
    line = [(cx0 + 20 + span_x * i / (len(points) - 1), bottom - (bottom - top) * p) for i, p in enumerate(points)]
    d.polygon(line + [(line[-1][0], bottom), (line[0][0], bottom)], fill='#fde4e2')
    d.line(line, fill='#e4483e', width=5, joint='curve')
    # Instance list.
    tx0 = cx1 + 24
    d.rounded_rectangle((tx0, cy0, width - 24, cy1), radius=10, fill='#ffffff', outline='#e2e5e9', width=2)
    for i in range(5):
        y = cy0 + 24 + i * 38
        d.ellipse((tx0 + 16, y, tx0 + 28, y + 12), fill='#16a34a')
        bar(d, tx0 + 38, y + 1, (width - 24 - tx0 - 60) * (0.9 - (i % 2) * 0.25), 10, '#3c4550')
    return im


def perspective_coefficients(dest, src):
    """Coefficients mapping destination points to source points, for Image.transform."""
    rows, rhs = [], []
    for (X, Y), (x, y) in zip(dest, src):
        rows.append([X, Y, 1, 0, 0, 0, -X * x, -Y * x])
        rhs.append(x)
        rows.append([0, 0, 0, X, Y, 1, -X * y, -Y * y])
        rhs.append(y)
    n = 8
    m = [row + [value] for row, value in zip(rows, rhs)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(n):
            if r != col:
                factor = m[r][col] / m[col][col]
                m[r] = [a - factor * b for a, b in zip(m[r], m[col])]
    return [m[i][n] / m[i][i] for i in range(n)]


def screen_mask(image, seed):
    """Soft mask of the screen-blue region connected to seed."""
    pixels = image.load()
    width, height = image.size

    def blueness(point):
        r, g, b = pixels[point][:3]
        return (b - r - 25) / 40 if b > 120 and g > 90 else 0

    mask = Image.new('L', image.size, 0)
    out = mask.load()
    seen, queue = {seed}, deque([seed])
    while queue:
        x, y = queue.popleft()
        out[x, y] = round(255 * min(1, blueness((x, y))))
        if blueness((x, y)) < 0.6:
            continue  # an edge pixel: include it softly, but stop spreading
        for point in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if point not in seen and 0 <= point[0] < width and 0 <= point[1] < height and blueness(point) > 0:
                seen.add(point)
                queue.append(point)
    return mask


def paint_screens(image, theme):
    for name, screen in SCREENS.items():
        quad = screen['quad']
        box_w = round(max(x for x, _ in quad) - min(x for x, _ in quad))
        box_h = round(max(y for _, y in quad) - min(y for _, y in quad))
        content = (draw_x_feed if name == 'x-feed' else draw_dashboard)(box_w * SCALE, box_h * SCALE)
        # A faint diagonal sheen, like the original glossy screens.
        sheen = Image.linear_gradient('L').rotate(-35, expand=False).resize(content.size)
        content = Image.composite(Image.new('RGB', content.size, '#ffffff'), content, sheen.point(lambda v: v * 0.07))
        if theme == 'night':
            content = Image.blend(content, Image.new('RGB', content.size, '#dbe8ff'), 0.04)
        cw, ch = content.size
        coefficients = perspective_coefficients(quad, [(0, 0), (cw, 0), (cw, ch), (0, ch)])
        warped = content.transform(image.size, Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC)
        mask = screen_mask(image, screen['seed'])
        rgb = Image.composite(warped, image.convert('RGB'), mask)
        rgb.putalpha(image.getchannel('A'))
        image = rgb
    return image


def normalize_alpha(image):
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 240 else 0 if v <= 8 else v)
    image.putalpha(alpha)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--source', type=Path, default=Path.home() / 'aronwagner-art' / 'generated')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for theme, filename in SOURCES.items():
        image = Image.open(args.source / filename).convert('RGBA')
        if image.size != (1536, 1024):
            raise SystemExit(f'{filename}: expected 1536x1024, got {image.size[0]}x{image.size[1]}')
        image = paint_screens(normalize_alpha(image), theme)
        for suffix, size in (('', (1536, 1024)), ('-small', (768, 512))):
            out = OUTPUT / f'office-{theme}{suffix}.webp'
            resized = image if size == image.size else image.resize(size, Image.Resampling.LANCZOS)
            resized.save(out, 'WEBP', quality=86, method=6, alpha_quality=90)
            print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KiB')


if __name__ == '__main__':
    main()
