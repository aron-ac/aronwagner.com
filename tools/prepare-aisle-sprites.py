#!/usr/bin/env python3
"""Prepare Aisle Dash's character and item sprites from their generated originals.

    python3 tools/prepare-aisle-sprites.py [--source ~/aronwagner-art/generated]

Needs Python 3 with Pillow. Reads three transparent ChatGPT sheets (prompts are in
assets/aisle-dash/prompts/) and writes WebP sprite sheets to assets/aisle-dash/sprites/:

  aron.webp     3 frames (standing, stride, stride) of Aron pushing Jack's stroller,
                aligned on the stroller's front wheel so the stroller stays put;
  rebecca.webp  6 poses (walk, walk, browse, delighted, unimpressed, coffee), each
                scaled to one height and centered on her feet;
  items.webp    28 shopping items in a 7 x 4 grid of square cells.

The layout constants below are mirrored in assets/aisle-dash/sprites.js.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'assets' / 'aisle-dash' / 'sprites'

ARON_FRAME = (437, 702)  # output size of each Aron frame
REBECCA_POSE = (370, 490)  # output size of each Rebecca pose cell
REBECCA_HEIGHT = 470  # every pose is scaled to this figure height
ITEM_CELL = 128
ITEM_GRID = (7, 4)


def normalized(image):
    """The generator leaves figures at ~99% opacity with faint haze around them."""
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 240 else 0 if v <= 8 else v)
    image = image.copy()
    image.putalpha(alpha)
    return image


def region_mask(image, seed, threshold=20):
    """Pixels connected to `seed` through visible alpha, as an L mask (255 inside)."""
    mask = image.getchannel('A').point(lambda v: 100 if v > threshold else 0)
    ImageDraw.floodfill(mask, seed, 255)
    return mask.point(lambda v: 255 if v == 255 else 0)


def first_visible(image, x_range, threshold=128):
    alpha = image.getchannel('A')
    for y in range(image.height):
        for x in range(*x_range):
            if alpha.getpixel((x, y)) > threshold:
                return x, y
    raise ValueError(f'no visible pixels in columns {x_range}')


def aron(source):
    sheet = normalized(Image.open(source / '05-aisle-aron-stroller.png').convert('RGBA'))
    third = sheet.width // 3
    frames = []
    for index in range(3):
        mask = region_mask(sheet, first_visible(sheet, (index * third + 40, (index + 1) * third - 40)))
        figure = Image.new('RGBA', sheet.size)
        figure.paste(sheet, mask=mask)
        frames.append(figure.crop(mask.getbbox()))
    # Align on the right edge (the stroller's front wheel) and the ground line.
    width = max(frame.width for frame in frames) + 8
    height = max(frame.height for frame in frames) + 8
    scale = min(ARON_FRAME[0] / width, ARON_FRAME[1] / height)
    out = Image.new('RGBA', (ARON_FRAME[0] * 3, ARON_FRAME[1]))
    for index, frame in enumerate(frames):
        size = (round(frame.width * scale), round(frame.height * scale))
        frame = frame.resize(size, Image.LANCZOS)
        x = (index + 1) * ARON_FRAME[0] - 4 - frame.width
        out.alpha_composite(frame, (x, ARON_FRAME[1] - 4 - frame.height))
    return out


def feet_center(figure):
    alpha = figure.getchannel('A')
    band = alpha.crop((0, int(figure.height * 0.92), figure.width, figure.height))
    box = band.getbbox()
    return (box[0] + box[2]) / 2 if box else figure.width / 2


def rebecca(source):
    sheet = normalized(Image.open(source / '06-aisle-rebecca-poses.png').convert('RGBA'))
    cols, rows = 3, 2
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    out = Image.new('RGBA', (REBECCA_POSE[0] * cols * rows, REBECCA_POSE[1]))
    for index in range(cols * rows):
        col, row = index % cols, index // cols
        cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        figure = cell.crop(cell.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        scale = REBECCA_HEIGHT / figure.height
        figure = figure.resize((round(figure.width * scale), REBECCA_HEIGHT), Image.LANCZOS)
        feet = feet_center(figure)
        x = index * REBECCA_POSE[0] + round(REBECCA_POSE[0] / 2 - feet)
        # Clip anything (a reaching hand) that would spill into the next pose.
        pose = Image.new('RGBA', REBECCA_POSE)
        pose.alpha_composite(figure, (x - index * REBECCA_POSE[0], REBECCA_POSE[1] - 8 - REBECCA_HEIGHT))
        out.alpha_composite(pose, (index * REBECCA_POSE[0], 0))
    return out


def components(mask):
    """Connected shapes in a binary L mask: a list of (pixel list, bbox)."""
    width, height = mask.size
    data = mask.load()
    seen = bytearray(width * height)
    found = []
    for y in range(height):
        for x in range(width):
            if not data[x, y] or seen[y * width + x]:
                continue
            stack, pixels = [(x, y)], []
            seen[y * width + x] = 1
            while stack:
                px, py = stack.pop()
                pixels.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < width and 0 <= ny < height and data[nx, ny] and not seen[ny * width + nx]:
                        seen[ny * width + nx] = 1
                        stack.append((nx, ny))
            xs = [p[0] for p in pixels]
            ys = [p[1] for p in pixels]
            found.append((pixels, (min(xs), min(ys), max(xs) + 1, max(ys) + 1)))
    return found


def items(source):
    # The generator doesn't place items on an exact grid. Label each visible shape
    # at half size, give it to the nearest grid cell (so pairs of earrings or shoes
    # stay together), then cut each item out through its own shapes only.
    sheet = normalized(Image.open(source / '07-aisle-items.png').convert('RGBA'))
    cols, rows = ITEM_GRID
    small = sheet.getchannel('A').resize((sheet.width // 2, sheet.height // 2), Image.BOX)
    small = small.point(lambda v: 255 if v > 20 else 0)
    cells = {}
    for pixels, box in components(small):
        if len(pixels) < 12:
            continue
        cx = sum(p[0] for p in pixels) / len(pixels) * 2
        cy = sum(p[1] for p in pixels) / len(pixels) * 2
        cell = (min(cols - 1, int(cx / sheet.width * cols)), min(rows - 1, int(cy / sheet.height * rows)))
        cells.setdefault(cell, []).append((pixels, box))
    if len(cells) != cols * rows:
        raise ValueError(f'expected {cols * rows} items, found {len(cells)}')
    out = Image.new('RGBA', (ITEM_CELL * cols, ITEM_CELL * rows))
    for (col, row), shapes in cells.items():
        mask = Image.new('L', small.size)
        for pixels, _ in shapes:
            for point in pixels:
                mask.putpixel(point, 255)
        mask = mask.resize(sheet.size, Image.NEAREST).filter(ImageFilter.MaxFilter(5))
        item = Image.new('RGBA', sheet.size)
        item.paste(sheet, mask=mask)
        item = item.crop(item.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        fit = (ITEM_CELL - 8) / max(item.size)
        item = item.resize((round(item.width * fit), round(item.height * fit)), Image.LANCZOS)
        out.alpha_composite(
            item,
            (col * ITEM_CELL + (ITEM_CELL - item.width) // 2,
             row * ITEM_CELL + (ITEM_CELL - item.height) // 2),
        )
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--source', type=Path, default=Path.home() / 'aronwagner-art' / 'generated')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, build in (('aron', aron), ('rebecca', rebecca), ('items', items)):
        image = build(args.source.expanduser())
        path = OUTPUT / f'{name}.webp'
        image.save(path, 'WEBP', quality=90, method=6)
        print(f'{path.relative_to(ROOT)}: {image.width}x{image.height}, {path.stat().st_size // 1024} KiB')


if __name__ == '__main__':
    main()
