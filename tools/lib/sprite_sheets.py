"""Shared helpers for cutting ChatGPT sprite sheets into game sprites (Pillow only).

The generator returns transparent PNGs where figures sit at ~99% opacity with a
faint haze around them, laid out roughly (not exactly) on a grid.
"""

from PIL import Image, ImageFilter


def normalized(image):
    """Near-opaque pixels become opaque and near-clear pixels clear."""
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 240 else 0 if v <= 8 else v)
    image = image.copy()
    image.putalpha(alpha)
    return image


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


def split_oversized(pixels, cell_w, cell_h, search=30):
    """Split a shape that spans more than one grid cell (figures drawn touching).

    It is cut where it is thinnest near each cell edge it crosses, so the cut
    follows the real gap between the figures. Returns a list of pixel lists.
    """
    xs = [p[0] for p in pixels]
    ys = [p[1] for p in pixels]
    for axis, lo, hi, size in ((0, min(xs), max(xs), cell_w), (1, min(ys), max(ys), cell_h)):
        if hi - lo < size * 1.4:
            continue
        counts = {}
        for point in pixels:
            counts[point[axis]] = counts.get(point[axis], 0) + 1
        edge = round((lo + hi) / 2 / size) * size
        cut = min(range(int(edge - search), int(edge + search) + 1), key=lambda v: counts.get(v, 0))
        first = [p for p in pixels if p[axis] < cut]
        second = [p for p in pixels if p[axis] >= cut]
        if first and second:
            # Bits of one figure left on the other side of the cut stand alone,
            # so they go to their own nearest cell.
            return [
                part
                for half in (first, second)
                for piece in connected(half)
                for part in split_oversized(piece, cell_w, cell_h, search)
            ]
    return [pixels]


def connected(pixels):
    """Split a pixel list into its 4-connected pieces."""
    left = set(pixels)
    pieces = []
    while left:
        stack = [left.pop()]
        piece = []
        while stack:
            px, py = stack.pop()
            piece.append((px, py))
            for neighbor in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                if neighbor in left:
                    left.remove(neighbor)
                    stack.append(neighbor)
        pieces.append(piece)
    return pieces


def cut_grid(sheet, cols, rows, min_pixels=12):
    """Cut a sheet into cols x rows figures, row by row.

    Shapes are labeled at half size and each goes to the grid cell nearest its
    centroid, so pairs (earrings, shoes, a ball beside a dog) stay together and
    items that stray across a cell edge are not sliced. Each figure is cut out
    through its own shapes only and cropped tight.
    """
    small = sheet.getchannel('A').resize((sheet.width // 2, sheet.height // 2), Image.BOX)
    small = small.point(lambda v: 255 if v > 20 else 0)
    cells = {}
    cell_w, cell_h = small.width / cols, small.height / rows
    shapes = [part for pixels, _ in components(small) for part in split_oversized(pixels, cell_w, cell_h)]
    for pixels in shapes:
        if len(pixels) < min_pixels:
            continue
        cx = sum(p[0] for p in pixels) / len(pixels) * 2
        cy = sum(p[1] for p in pixels) / len(pixels) * 2
        cell = (min(cols - 1, int(cx / sheet.width * cols)), min(rows - 1, int(cy / sheet.height * rows)))
        cells.setdefault(cell, []).append(pixels)
    if len(cells) != cols * rows:
        raise ValueError(f'expected {cols * rows} figures, found {len(cells)}')
    figures = []
    for row in range(rows):
        for col in range(cols):
            mask = Image.new('L', small.size)
            for pixels in cells[(col, row)]:
                for point in pixels:
                    mask.putpixel(point, 255)
            mask = mask.resize(sheet.size, Image.NEAREST).filter(ImageFilter.MaxFilter(5))
            figure = Image.new('RGBA', sheet.size)
            figure.paste(sheet, mask=mask)
            figures.append(figure.crop(figure.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()))
    return figures


def feet_center(figure, band=0.08):
    """Horizontal center of the lowest visible band: where the figure stands."""
    alpha = figure.getchannel('A')
    box = alpha.crop((0, int(figure.height * (1 - band)), figure.width, figure.height)).getbbox()
    return (box[0] + box[2]) / 2 if box else figure.width / 2


def pose_strip(figures, cell, scale, anchors=None):
    """Poses side by side in fixed cells, feet on the bottom edge and centered.

    `anchors` optionally gives each figure's own anchor x (in source pixels);
    by default it is the center of the figure's feet. Returns the strip image.
    """
    out = Image.new('RGBA', (cell[0] * len(figures), cell[1]))
    for index, figure in enumerate(figures):
        anchor = (anchors[index] if anchors else feet_center(figure)) * scale
        scaled = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.LANCZOS)
        pose = Image.new('RGBA', cell)
        pose.alpha_composite(scaled, (round(cell[0] / 2 - anchor), cell[1] - 6 - scaled.height))
        out.alpha_composite(pose, (index * cell[0], 0))
    return out


def atlas(figures, cell, columns):
    """Fit each figure into a square-ish cell, bottom-centered. Returns the image
    and each figure's placed rectangle (x, y, w, h) in the atlas."""
    rows = -(-len(figures) // columns)
    out = Image.new('RGBA', (cell * columns, cell * rows))
    rects = []
    for index, figure in enumerate(figures):
        fit = (cell - 8) / max(figure.size)
        scaled = figure.resize((round(figure.width * fit), round(figure.height * fit)), Image.LANCZOS)
        x = (index % columns) * cell + (cell - scaled.width) // 2
        y = (index // columns) * cell + cell - 4 - scaled.height
        out.alpha_composite(scaled, (x, y))
        rects.append((x, y, scaled.width, scaled.height))
    return out, rects
