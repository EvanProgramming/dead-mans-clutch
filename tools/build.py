"""Package the static game as an offline HTML file and an itch.io zip."""
import argparse
import base64
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
MODULES = ("moves", "sim", "render", "audio", "main")

def data_url(path, mime):
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"

def bundle_scripts():
    """Wrap each local ES module in its own lexical scope for file:// play."""
    parts = []
    for module in MODULES:
        source = (ROOT / "game" / f"{module}.mjs").read_text(encoding="utf-8")
        exports = re.findall(r"^export (?:function|const) (\w+)", source, re.M)
        source = re.sub(r"^export ", "", source, flags=re.M)
        source = re.sub(r"""import\s*\{([^}]+)\}\s*from\s*['"]\./(\w+)\.mjs['"];""",
                        r"const {\1}=modules.\2;", source)
        parts.append(f"modules.{module}=(()=>{{\n{source}\nreturn {{{','.join(exports)}}};\n}})();")
    return "(()=>{'use strict';const modules={};\n" + "\n".join(parts) + "\n})();"

def build(output):
    output.mkdir(parents=True, exist_ok=True)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    style = (ROOT / "game/style.css").read_text(encoding="utf-8").replace("../assets/barlow.ttf",
                data_url(ROOT / "assets/barlow.ttf", "font/ttf"))
    html = html.replace('<link rel="stylesheet" href="game/style.css">', f"<style>{style}</style>")
    for svg in ("club", "cover", "lettering"):
        html = html.replace(f'"assets/{svg}.svg"', '"' + data_url(ROOT / f"assets/{svg}.svg", "image/svg+xml") + '"')
    html = html.replace('<script type="module" src="game/main.mjs"></script>',
                        "<script>" + bundle_scripts() + "</script>")
    licenses = (ROOT / "LICENSE").read_text(encoding="utf-8") + "\n" + (ROOT / "assets/OFL-Barlow.txt").read_text(encoding="utf-8")
    html = html.replace("</body>", '<script type="text/plain" id="licenses">' + licenses + "</script></body>")
    data = html.encode("utf-8")
    (output / "play-dead-mans-clutch.html").write_bytes(data)
    archive = output / "dead-mans-clutch-itch.zip"
    with ZipFile(archive, "w") as z:
        for name, contents in (("index.html", data), ("LICENSE.txt", licenses.encode())):
            info = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            z.writestr(info, contents, compress_type=ZIP_DEFLATED, compresslevel=9)
    print(f"{archive.name}: {archive.stat().st_size:,} bytes")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    build(parser.parse_args().output)
