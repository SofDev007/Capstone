from pathlib import Path
from docx import Document
from docx.shared import Pt


def is_table_separator(line: str) -> bool:
    s = line.strip()
    return s.startswith("---|") or s == "---|---" or s.startswith("|---")


def add_markdown_table(doc: Document, lines: list[str], start: int) -> int:
    header = [c.strip() for c in lines[start].split("|")]
    cols = len(header)
    data_rows = []
    i = start + 2
    while i < len(lines):
        row = lines[i].strip()
        if not row or "|" not in row or row.startswith("#"):
            break
        data_rows.append([c.strip() for c in row.split("|")])
        i += 1

    table = doc.add_table(rows=1, cols=cols)
    table.style = "Table Grid"
    for c, text in enumerate(header):
        table.rows[0].cells[c].text = text

    for row in data_rows:
        tr = table.add_row().cells
        for c in range(cols):
            tr[c].text = row[c] if c < len(row) else ""

    return i


def build_docx(md_path: Path, out_path: Path) -> None:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    doc = Document()

    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(12)

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            doc.add_paragraph("")
            i += 1
            continue

        if stripped.startswith("# "):
            doc.add_heading(stripped[2:].strip(), level=1)
            i += 1
            continue
        if stripped.startswith("## "):
            doc.add_heading(stripped[3:].strip(), level=2)
            i += 1
            continue
        if stripped.startswith("### "):
            doc.add_heading(stripped[4:].strip(), level=3)
            i += 1
            continue
        if stripped.startswith("#### "):
            doc.add_heading(stripped[5:].strip(), level=4)
            i += 1
            continue

        if "|" in stripped and i + 1 < len(lines) and is_table_separator(lines[i + 1]):
            i = add_markdown_table(doc, lines, i)
            continue

        if stripped.startswith("- "):
            doc.add_paragraph(stripped[2:].strip(), style="List Bullet")
            i += 1
            continue

        if stripped.startswith("1. ") or stripped.startswith("2. ") or stripped.startswith("3. "):
            doc.add_paragraph(stripped.split(". ", 1)[1], style="List Number")
            i += 1
            continue

        if stripped == "---":
            doc.add_page_break()
            i += 1
            continue

        doc.add_paragraph(line)
        i += 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out_path)


if __name__ == "__main__":
    base = Path(r"d:\capstone")
    md = base / "Real_Time_Public_Transport_Tracking_Report_Exact_Structure.md"
    out = base / "Real_Time_Public_Transport_Tracking_Report_Exact_Structure.docx"
    build_docx(md, out)
    print(f"Generated: {out}")
