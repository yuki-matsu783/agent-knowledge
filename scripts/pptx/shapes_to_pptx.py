"""図形の指示書 (shapes.json) から編集可能な PPTX を組み立てる。

使い方:
    pnpm pptx <shapes.json> -o <output.pptx> [--aspect 16:9]

- 入力はスライド枠に対する比 (0..1) で位置・大きさ・文字サイズを持つ JSON。
  作り手は問わない (Slidev からは templates/slidev-pptx/scripts/extract-shapes.ts が作る)。
- 出力はすべてネイティブの図形。ラスタ化するのは kind=image だけ。
- 形の語彙は PRESETS が正。ここに無い preset は矩形に落とし、stderr に警告を出す。

設計上の注意:
- 比で受け取るのは、入力側 (ブラウザ) の表示倍率とスライドの実寸を切り離すため。
  ここで初めて EMU とポイントに変換する。
- python-pptx に矢じりの API が無いので、線の XML に a:headEnd / a:tailEnd を直接足している。
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

EMU_PER_INCH = 914400
ASPECTS = {"16:9": (13.333, 7.5), "4:3": (10.0, 7.5), "16:10": (12.0, 7.5)}

PRESETS = {
    "rect": MSO_SHAPE.RECTANGLE,
    "roundRect": MSO_SHAPE.ROUNDED_RECTANGLE,
    "ellipse": MSO_SHAPE.OVAL,
    "triangle": MSO_SHAPE.ISOSCELES_TRIANGLE,
    "diamond": MSO_SHAPE.DIAMOND,
    "pentagon": MSO_SHAPE.REGULAR_PENTAGON,
    "hexagon": MSO_SHAPE.HEXAGON,
    "chevron": MSO_SHAPE.CHEVRON,
    "homePlate": MSO_SHAPE.PENTAGON,
    "rightArrow": MSO_SHAPE.RIGHT_ARROW,
    "parallelogram": MSO_SHAPE.PARALLELOGRAM,
    "trapezoid": MSO_SHAPE.TRAPEZOID,
}
ALIGN = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT, "justify": PP_ALIGN.JUSTIFY}
ANCHOR = {"top": MSO_ANCHOR.TOP, "middle": MSO_ANCHOR.MIDDLE, "bottom": MSO_ANCHOR.BOTTOM}

warned: set[str] = set()


def warn(msg: str) -> None:
    if msg not in warned:
        warned.add(msg)
        print(f"warning: {msg}", file=sys.stderr)


def color(triple) -> RGBColor | None:
    return RGBColor(*(int(v) for v in triple)) if triple else None


def apply_text(shape, spec: dict, height_emu: int) -> None:
    """段落と run を text frame に流す。空なら何も書かない (枠だけの図形)"""
    paragraphs = spec.get("paragraphs") or []
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = ANCHOR.get(spec.get("anchor", "top"), MSO_ANCHOR.TOP)
    if not paragraphs:
        return
    for i, para in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = ALIGN.get(para.get("align", "left"), PP_ALIGN.LEFT)
        p.level = min(int(para.get("level", 0)), 8)
        if para.get("bullet"):
            set_bullet(p)
        for run_spec in para.get("runs", []):
            r = p.add_run()
            r.text = run_spec["t"]
            r.font.size = Pt(max(round(run_spec["size"] * height_emu / EMU_PER_INCH * 72, 1), 1))
            r.font.bold = bool(run_spec.get("bold"))
            r.font.italic = bool(run_spec.get("italic"))
            if run_spec.get("font"):
                r.font.name = run_spec["font"]
            rgb = color(run_spec.get("color"))
            if rgb is not None:
                r.font.color.rgb = rgb


def set_bullet(paragraph) -> None:
    """python-pptx に箇条書きの API が無いので pPr に buChar を足す"""
    p_pr = paragraph._p.get_or_add_pPr()
    for tag in ("a:buNone", "a:buChar", "a:buAutoNum"):
        for el in p_pr.findall(qn(tag)):
            p_pr.remove(el)
    bu = p_pr.makeelement(qn("a:buChar"), {"char": "•"})
    p_pr.append(bu)


def set_arrow(line, head: bool, tail: bool) -> None:
    """線の XML に矢じりを足す。python-pptx が API を持たないため"""
    ln = line._get_or_add_ln()
    for want, tag in ((head, "a:headEnd"), (tail, "a:tailEnd")):
        if not want:
            continue
        el = ln.makeelement(qn(tag), {"type": "triangle", "w": "med", "len": "med"})
        ln.append(el)


def add_auto(slide, spec: dict, w: int, h: int):
    preset = spec.get("preset") or "rect"
    if preset not in PRESETS:
        warn(f"未対応の preset '{preset}' を矩形にした")
    f = spec["frame"]
    shape = slide.shapes.add_shape(
        PRESETS.get(preset, MSO_SHAPE.RECTANGLE),
        Emu(int(f["x"] * w)),
        Emu(int(f["y"] * h)),
        Emu(max(int(f["w"] * w), 1)),
        Emu(max(int(f["h"] * h), 1)),
    )
    fill = color(spec.get("fill"))
    if fill is not None:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    line = spec.get("line")
    if line:
        shape.line.color.rgb = color(line["color"])
        shape.line.width = Emu(int(line["width"] * w))
    else:
        shape.line.fill.background()
    # 角丸の丸みは短辺に対する比で入る (0..0.5)
    if preset == "roundRect" and spec.get("radius"):
        short = min(f["w"] * w, f["h"] * h)
        if short > 0:
            shape.adjustments[0] = min(spec["radius"] * w / short, 0.5)
    shape.shadow.inherit = False
    apply_text(shape, spec, h)
    return shape


def add_text(slide, spec: dict, w: int, h: int):
    f = spec["frame"]
    box = slide.shapes.add_textbox(
        Emu(int(f["x"] * w)), Emu(int(f["y"] * h)), Emu(max(int(f["w"] * w), 1)), Emu(max(int(f["h"] * h), 1))
    )
    apply_text(box, spec, h)
    return box


def add_line(slide, spec: dict, w: int, h: int):
    f = spec["frame"]
    x1, y1 = int(f["x"] * w), int(f["y"] * h)
    if spec.get("dir") == "down":
        x2, y2 = x1, int((f["y"] + f["h"]) * h)
    elif spec.get("dir") == "diag":
        x2, y2 = int((f["x"] + f["w"]) * w), int((f["y"] + f["h"]) * h)
    else:
        x2, y2 = int((f["x"] + f["w"]) * w), y1
    conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Emu(x1), Emu(y1), Emu(x2), Emu(y2))
    conn.line.color.rgb = color(spec.get("color")) or RGBColor(0, 0, 0)
    conn.line.width = Emu(max(int(spec.get("width", 0.002) * w), 1))
    arrow = spec.get("arrow", "none")
    set_arrow(conn.line, arrow in ("start", "both"), arrow in ("end", "both"))
    return conn


def add_table(slide, spec: dict, w: int, h: int):
    rows = spec.get("rows") or []
    if not rows:
        warn("行の無い table を飛ばした")
        return None
    cols = max(len(r) for r in rows)
    f = spec["frame"]
    graphic = slide.shapes.add_table(
        len(rows),
        cols,
        Emu(int(f["x"] * w)),
        Emu(int(f["y"] * h)),
        Emu(max(int(f["w"] * w), 1)),
        Emu(max(int(f["h"] * h), 1)),
    )
    table = graphic.table
    table.first_row = bool(spec.get("header"))
    size = Pt(max(round(spec.get("size", 0.03) * h / EMU_PER_INCH * 72, 1), 1))
    for ri, row in enumerate(rows):
        for ci in range(cols):
            cell = table.cell(ri, ci)
            data = row[ci] if ci < len(row) else {"text": "", "align": "left", "bold": False}
            cell.text = data.get("text", "")
            p = cell.text_frame.paragraphs[0]
            p.alignment = ALIGN.get(data.get("align", "left"), PP_ALIGN.LEFT)
            for r in p.runs:
                r.font.size = size
                r.font.bold = bool(data.get("bold"))
    return graphic


def add_image(slide, spec: dict, w: int, h: int):
    if not spec.get("data"):
        warn("data の無い image を飛ばした")
        return None
    f = spec["frame"]
    stream = io.BytesIO(base64.b64decode(spec["data"]))
    return slide.shapes.add_picture(
        stream, Emu(int(f["x"] * w)), Emu(int(f["y"] * h)), Emu(max(int(f["w"] * w), 1)), Emu(max(int(f["h"] * h), 1))
    )


BUILDERS = {"auto": add_auto, "text": add_text, "line": add_line, "table": add_table, "image": add_image}


def build(doc: dict, out: Path, aspect: str) -> int:
    inches = ASPECTS[aspect]
    prs = Presentation()
    prs.slide_width = Emu(int(inches[0] * EMU_PER_INCH))
    prs.slide_height = Emu(int(inches[1] * EMU_PER_INCH))
    w, h = int(prs.slide_width), int(prs.slide_height)
    blank = prs.slide_layouts[6]
    placed = 0
    for slide_spec in doc.get("slides", []):
        slide = prs.slides.add_slide(blank)
        for shape_spec in slide_spec.get("shapes", []):
            builder = BUILDERS.get(shape_spec.get("kind", ""))
            if builder is None:
                warn(f"未対応の kind '{shape_spec.get('kind')}' を飛ばした")
                continue
            if builder(slide, shape_spec, w, h) is not None:
                placed += 1
    out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(out)
    return placed


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="shapes.json から編集可能な PPTX を作る")
    ap.add_argument("input", type=Path, help="図形の指示書 (JSON)")
    ap.add_argument("-o", "--output", type=Path, required=True, help="出力する .pptx")
    ap.add_argument("--aspect", choices=sorted(ASPECTS), default="16:9", help="スライドの縦横比 (既定 16:9)")
    args = ap.parse_args(argv)

    if not args.input.is_file():
        print(f"error: 入力が見つからない: {args.input}", file=sys.stderr)
        return 1
    try:
        doc = json.loads(args.input.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"error: JSON として読めない: {args.input}: {e}", file=sys.stderr)
        return 1
    if not doc.get("slides"):
        print(f"error: slides が空: {args.input}", file=sys.stderr)
        return 1

    placed = build(doc, args.output, args.aspect)
    print(f"wrote: {args.output} slides={len(doc['slides'])} shapes={placed}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
