"""Image annotation service using Pillow.

Draws grading results onto original exam images:
- Green checkmark (✓) for correct answers
- Red question mark (?) + solution notes for wrong answers
- Crops individual question regions
- Generates thumbnails
"""

import logging
import os

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

GREEN = (34, 197, 94)  # #22C55E
RED = (239, 68, 68)  # #EF4444
TEXT_COLOR = (30, 27, 24)  # #1E1B18 for solution notes

# Font search paths (tried in order)
_FONT_CANDIDATES = [
    # Bundled font (Docker)
    os.path.join("assets", "fonts", "NotoSansSC-Regular.otf"),
    os.path.join("assets", "fonts", "NotoSansSC-Regular.ttf"),
    # Windows system fonts
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    # Linux common fonts
    "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf",
]

_font_path: str | None = None


def _find_font() -> str | None:
    """Find an available Chinese-capable font. Caches on first call."""
    global _font_path
    if _font_path is not None:
        return _font_path if _font_path else None

    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            _font_path = path
            logger.info("Using font: %s", path)
            return path

    logger.warning(
        "No Chinese font found. Annotations will use PIL default (no CJK support). "
        "Place a font file at assets/fonts/NotoSansSC-Regular.otf"
    )
    _font_path = ""  # Mark as searched
    return None


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_file = _find_font()
    if font_file:
        try:
            return ImageFont.truetype(font_file, size=size)
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to load font %s: %s", font_file, e)
    return ImageFont.load_default()


def _percent_to_pixels(
    pos: dict, img_width: int, img_height: int
) -> tuple[int, int, int, int]:
    """Convert percentage coordinates to pixel coordinates."""
    x = int(pos.get("x", 0) / 100 * img_width)
    y = int(pos.get("y", 0) / 100 * img_height)
    w = int(pos.get("w", 20) / 100 * img_width)
    h = int(pos.get("h", 10) / 100 * img_height)
    return x, y, w, h


def annotate_image(
    original_path: str,
    annotated_path: str,
    questions: list[dict],
) -> None:
    """Draw grading annotations onto the original image.

    Args:
        original_path: Path to the original uploaded image.
        annotated_path: Where to save the annotated image.
        questions: List of question dicts from GLM-4V (with percentage coords).
    """
    img = Image.open(original_path).convert("RGB")
    img_width, img_height = img.size
    draw = ImageDraw.Draw(img)

    check_font = _load_font(28)
    solution_font = _load_font(16)

    for q in questions:
        pos = q.get("question_position")
        if not pos:
            continue

        x, y, _w, _h = _percent_to_pixels(pos, img_width, img_height)

        # Ensure coordinates stay within image bounds
        x = max(0, min(x, img_width - 1))
        y = max(0, min(y, img_height - 1))

        if q.get("is_correct"):
            # Green checkmark at top-left of question area
            draw.text((x, y), "✓", fill=GREEN, font=check_font)
        else:
            # Red question mark
            draw.text((x, y), "?", fill=RED, font=check_font)

            # Solution note below the question mark
            solution = q.get("solution_note")
            if solution:
                # Draw a semi-transparent white background for text readability
                text_x = x + 30
                text_y = y

                # Simple text wrapping
                max_chars_per_line = 30
                lines = []
                remaining = solution
                while len(remaining) > 0:
                    line = remaining[:max_chars_per_line]
                    remaining = remaining[max_chars_per_line:]
                    lines.append(line)

                line_height = 20
                box_height = len(lines) * line_height + 8
                text_width = max_chars_per_line * 10  # approximate

                # Draw background box
                draw.rectangle(
                    [text_x - 4, text_y, text_x + text_width + 4, text_y + box_height],
                    fill=(255, 255, 255, 220),
                )

                # Draw each line
                for i, line in enumerate(lines):
                    draw.text(
                        (text_x, text_y + 4 + i * line_height),
                        line,
                        fill=TEXT_COLOR,
                        font=solution_font,
                    )

    # Create output directory if needed
    os.makedirs(os.path.dirname(annotated_path), exist_ok=True)
    img.save(annotated_path, "JPEG", quality=85)
    logger.info("Annotated image saved: %s", annotated_path)


def crop_question(
    original_path: str,
    output_path: str,
    position: dict,
) -> None:
    """Crop a question region from the original image.

    Args:
        original_path: Path to the original image.
        output_path: Where to save the cropped question image.
        position: Bounding box as percentage coordinates {x, y, w, h}.
    """
    img = Image.open(original_path)
    img_width, img_height = img.size
    x, y, w, h = _percent_to_pixels(position, img_width, img_height)

    # Clamp to image bounds
    left = max(0, x)
    top = max(0, y)
    right = min(img_width, x + w)
    bottom = min(img_height, y + h)

    if right <= left or bottom <= top:
        logger.warning("Invalid crop region for %s, skipping", output_path)
        return

    cropped = img.crop((left, top, right, bottom))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cropped.save(output_path, "JPEG", quality=85)
    logger.info("Cropped question saved: %s", output_path)


def create_thumbnail(
    source_path: str, thumbnail_path: str, max_size: int = 256
) -> None:
    """Create a thumbnail from an image, preserving aspect ratio.

    Args:
        source_path: Path to the source image.
        thumbnail_path: Where to save the thumbnail.
        max_size: Maximum dimension (width or height) in pixels.
    """
    img = Image.open(source_path)
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
    img.save(thumbnail_path, "JPEG", quality=80)
    logger.info("Thumbnail saved: %s", thumbnail_path)


def compose_sheet(
    errors: list,
    child_name: str,
    subject: str,
    output_dir: str = "data/images/sheets",
) -> str:
    """Compose error questions into a printable practice sheet.

    Args:
        errors: List of ErrorQuestion ORM objects (must have question_image_path,
                question_number, question_type, solution_note).
        child_name: Name to display in the title bar.
        subject: "english" or "math".
        output_dir: Where to save the generated sheet image.

    Returns:
        Relative path to the generated sheet image.
    """
    import uuid
    from datetime import datetime

    # Constants
    PAGE_WIDTH = 1200
    MARGIN = 40
    HEADER_HEIGHT = 120
    ANSWER_SPACE = 80
    GAP = 20
    TITLE_COLOR = (30, 27, 24)  # #1E1B18
    SUBTITLE_COLOR = (107, 101, 96)  # #6B6560
    BG_COLOR = (255, 255, 255)
    SEPARATOR_COLOR = (229, 224, 218)  # #E5E0DA

    title_font = _load_font(32)
    subtitle_font = _load_font(16)
    label_font = _load_font(18)

    subject_label = "英语" if subject == "english" else "数学"
    today = datetime.now().strftime("%Y年%m月%d日")

    # Calculate total height: header + each question image + answer space + gaps
    question_sections: list[Image.Image] = []
    total_content_height = 0

    for eq in errors:
        img_path = eq.question_image_path
        if not img_path or not os.path.isfile(img_path):
            continue

        try:
            q_img = Image.open(img_path).convert("RGB")
        except Exception:
            logger.warning("Cannot open question image: %s", img_path)
            continue

        # Scale question image to fit within page width
        q_width, q_height = q_img.size
        available_width = PAGE_WIDTH - 2 * MARGIN
        if q_width > available_width:
            scale = available_width / q_width
            new_height = int(q_height * scale)
            q_img = q_img.resize((available_width, new_height), Image.LANCZOS)
            q_width, q_height = q_img.size

        question_sections.append(q_img)
        total_content_height += q_height + ANSWER_SPACE + GAP

    if not question_sections:
        # Create a minimal sheet with just a "no questions" message
        total_content_height = 200

    total_height = HEADER_HEIGHT + total_content_height + MARGIN
    sheet = Image.new("RGB", (PAGE_WIDTH, total_height), BG_COLOR)
    draw = ImageDraw.Draw(sheet)

    # --- Title bar ---
    draw.text(
        (MARGIN, 24),
        f"错题练习试卷",
        fill=TITLE_COLOR,
        font=title_font,
    )
    draw.text(
        (MARGIN, 68),
        f"{child_name}  |  {subject_label}  |  {today}",
        fill=SUBTITLE_COLOR,
        font=subtitle_font,
    )

    # Separator line
    draw.line(
        [(MARGIN, 110), (PAGE_WIDTH - MARGIN, 110)],
        fill=SEPARATOR_COLOR,
        width=1,
    )

    # --- Question sections ---
    y_cursor = HEADER_HEIGHT

    for i, (q_img, eq) in enumerate(zip(question_sections, errors)):
        q_width, q_height = q_img.size

        # Question label
        type_labels = {
            "choice": "选择题",
            "fill_blank": "填空题",
            "reading": "阅读理解",
            "composition": "作文",
            "calculation": "计算题",
            "word_problem": "应用题",
        }
        type_label = type_labels.get(eq.question_type, eq.question_type)
        label = f"第 {eq.question_number} 题  [{type_label}]"

        # Draw label
        draw.text((MARGIN, y_cursor), label, fill=TITLE_COLOR, font=label_font)
        y_cursor += 28

        # Paste question image
        sheet.paste(q_img, (MARGIN, y_cursor))
        y_cursor += q_height

        # Solution note
        if eq.solution_note:
            note_y = y_cursor + 6
            draw.text(
                (MARGIN, note_y),
                f"💡 {eq.solution_note[:100]}",
                fill=SUBTITLE_COLOR,
                font=subtitle_font,
            )
            y_cursor += 24

        # Answer space
        y_cursor += 8
        draw.rectangle(
            [(MARGIN, y_cursor), (PAGE_WIDTH - MARGIN, y_cursor + ANSWER_SPACE)],
            outline=SEPARATOR_COLOR,
            width=1,
        )
        draw.text(
            (MARGIN + 10, y_cursor + 10),
            "作答区域",
            fill=SEPARATOR_COLOR,
            font=subtitle_font,
        )
        y_cursor += ANSWER_SPACE + GAP

    # Save
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    output_path = f"{output_dir}/{filename}"  # forward slash, cross-platform
    sheet.save(output_path, "JPEG", quality=90)
    logger.info("Practice sheet saved: %s (%d questions)", output_path, len(question_sections))

    return output_path
