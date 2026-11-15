"""MARS Pathfinder – local development server.

Code written with AI assistance (Anthropic Claude), reviewed by the team.

Serves the web client from app/web and a small proxy (/api/proxy) for the USGS
HiRISE DTMs and NASA rover data, used only if the browser cannot read them directly.
"""
import json
import struct
import sys
import threading
from array import array
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

HOST = "127.0.0.1"
PORT = 8000
WEB_ROOT = Path(__file__).resolve().parent / "web"
PROXY_HOSTS = {
    "astrogeo-ard.s3-us-west-2.amazonaws.com",  # HiRISE / CTX DTMs
    "asc-pds-services.s3.us-west-2.amazonaws.com",  # MOLA global DEM
    "stac.astrogeology.usgs.gov",  # USGS STAC catalog
    "mars.nasa.gov",
    "services.arcgis.com",
    "pds-geosciences.wustl.edu",  # PDS Geosciences Node (TES, GRS)
}

# ---------- Global environment grids (built once, then served as static files) ----------
# Measured NASA maps, block-averaged to 0.25° so the app (and GitHub Pages) can load them quickly.
ENV_RES = 0.25
ENV_W, ENV_H = int(360 / ENV_RES), int(180 / ENV_RES)
ENV_BIN = WEB_ROOT / "data" / "env-grids.bin"
ENV_META = WEB_ROOT / "data" / "env-grids.json"
TI_URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img"
ALB_URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif"
GRS_URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/{}_sr_5x5.tab"


def _download(url, label):
    print(f"  {label}: downloading {url}")
    with urlopen(Request(url, headers={"User-Agent": "MARS-Pathfinder"}), timeout=300) as resp:
        total = int(resp.headers.get("Content-Length") or 0)
        chunks, got = [], 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            chunks.append(chunk)
            got += len(chunk)
            if total:
                print(f"\r  {label}: {got / 1e6:.1f} / {total / 1e6:.1f} MB", end="", flush=True)
        print()
    return b"".join(chunks)


def _block_mean(values, src_w, src_h, valid):
    """Average a north-up global raster (lon -180..180) into the 0.25° grid; invalid -> 0."""
    fx, fy = src_w // ENV_W, src_h // ENV_H
    out = array("d", [0.0]) * (ENV_W * ENV_H)
    cnt = array("i", [0]) * (ENV_W * ENV_H)
    for y in range(src_h):
        oy = (y // fy) * ENV_W
        row = values[y * src_w:(y + 1) * src_w]
        for x, v in enumerate(row):
            if valid(v):
                o = oy + x // fx
                out[o] += v
                cnt[o] += 1
    return [out[i] / cnt[i] if cnt[i] else 0.0 for i in range(len(out))]


def _thermal_inertia():
    # PDS3 image: 7200 x 3600, MSB int16, 20 px/deg, line 1 at 90°N, sample 1 at 180°W (Putzig & Mellon 2007).
    raw = _download(TI_URL, "TES thermal inertia")
    vals = array("h", raw[: 7200 * 3600 * 2])
    if sys.byteorder == "little":
        vals.byteswap()
    return _block_mean(vals, 7200, 3600, lambda v: 0 < v < 5000)


def _albedo():
    # GeoTIFF 2880 x 1440 float32, uncompressed, one row per strip, simple cylindrical lon -180..180.
    raw = _download(ALB_URL, "TES albedo")
    le = raw[:2] == b"II"
    e = "<" if le else ">"
    ifd = struct.unpack(e + "I", raw[4:8])[0]
    n = struct.unpack(e + "H", raw[ifd:ifd + 2])[0]
    tags = {}
    sizes = {1: 1, 2: 1, 3: 2, 4: 4, 12: 8}
    for i in range(n):
        tag, typ, cnt, off = struct.unpack(e + "HHII", raw[ifd + 2 + 12 * i: ifd + 14 + 12 * i])
        fmt = {3: "H", 4: "I", 12: "d", 2: "s"}.get(typ)
        if fmt is None:
            continue
        size = sizes[typ] * cnt
        data = raw[ifd + 10 + 12 * i: ifd + 14 + 12 * i] if size <= 4 else raw[off:off + size]
        tags[tag] = data.decode("ascii").strip("\0 ") if typ == 2 else list(struct.unpack(e + fmt * cnt, data[:size]))
    w, h = tags[256][0], tags[257][0]
    if tags.get(259, [1])[0] != 1 or tags[258][0] != 32:
        raise ValueError("unexpected TIFF layout")
    nodata = float(tags[42113]) if 42113 in tags else None
    vals = array("f")
    for off, cnt in zip(tags[273], tags[279]):
        row = array("f", raw[off:off + cnt])
        if (sys.byteorder == "little") != le:
            row.byteswap()
        vals.extend(row)
    return _block_mean(vals, w, h, lambda v: v == v and v != nodata and 0 < v < 1)


def _grs(element):
    text = _download(GRS_URL.format(element), f"GRS {element}").decode("ascii")
    grid = [None] * (36 * 72)
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        lat, lon, val = float(parts[0]), float(parts[1]), float(parts[2])
        row = int((90 - lat) // 5)  # north-up
        col = int(((lon + 180) % 360) // 5)  # lon -180..180
        grid[row * 72 + col] = None if val > 9000 else val
    return grid


# ---------- Geophysics / geochemistry grids (1°), built once ----------
GEO_META = WEB_ROOT / "data" / "geo-grids.json"
GRAV_BASE = "https://pds-geosciences.wustl.edu/mro/mro-m-rss-5-sdp-v1/mrors_1xxx/data/rsdmap/"
GRAV_MAPS = {
    "freeair": ("ggmro_120_anom_100.img", "Free-air gravity anomaly, NASA GMM-3 to degree 100 (PDS GGMRO_120_ANOM_100, Genova et al. 2016), mGal"),
    "bouguer": ("ggmro_120_bouguer_90.img", "Bouguer gravity anomaly, NASA GMM-3 to degree 90, crust 2900 kg/m3 (PDS GGMRO_120_BOUGUER_90, Genova et al. 2016), mGal"),
    "crust": ("ggmro_120_crust.img", "Crustal thickness from GMM-3 gravity and MOLA topography (G. A. Neumann, NASA GSFC; PDS GGMRO_120_CRUST), km"),
}


def _grav_grid(fname, label):
    """5760 x 2880 little-endian float64, 16 px/deg, lon 0..360 E, line 0 at 90 N. Read every 16th row (1° grid)."""
    import http.client
    host = "pds-geosciences.wustl.edu"
    path = urlparse(GRAV_BASE + fname).path
    W, H, RB = 5760, 2880, 5760 * 8
    out = [0.0] * (360 * 180)
    conn = http.client.HTTPSConnection(host, timeout=60)
    print(f"  {label}: reading 180 rows")
    for j in range(180):
        row = 16 * j + 8
        for attempt in range(3):
            try:
                conn.request("GET", path, headers={"Range": f"bytes={row * RB}-{row * RB + RB - 1}", "User-Agent": "MARS-Pathfinder"})
                resp = conn.getresponse()
                data = resp.read()
                if resp.status not in (200, 206) or len(data) < RB:
                    raise OSError(f"HTTP {resp.status}, {len(data)} bytes")
                break
            except (OSError, http.client.HTTPException):
                conn.close()
                conn = http.client.HTTPSConnection(host, timeout=60)
                if attempt == 2:
                    raise
        vals = struct.unpack("<5760d", data[:RB])
        for i in range(360):
            lon_e = (-180 + i + 0.5) % 360  # our column centre, east longitude 0..360
            s = int(lon_e * 16)
            out[j * 360 + i] = round(vals[min(W - 1, s)], 2)
        if j % 30 == 29:
            print(f"\r  {label}: {j + 1}/180 rows", end="", flush=True)
    conn.close()
    print()
    return out


def build_geo_grids():
    if GEO_META.exists():
        return
    print("Building gravity / crust / geochemistry grids (one time) ...")
    try:
        meta = {"w": 360, "h": 180, "res": 1, "west": -180, "north": 90, "layers": {}}
        for key, (fname, desc) in GRAV_MAPS.items():
            meta["layers"][key] = {"values": _grav_grid(fname, key), "source": desc + " – PDS MRO-M-RSS-5-SDP-V1, sampled at 1°"}
        meta["grs"] = {}
        for el in ("fe", "si", "cl", "h2o", "k", "th"):
            meta["grs"][el] = _grs(el)
        meta["grs_source"] = "Mars Odyssey GRS element concentrations, smoothed 5°×5° (PDS ODY-M-GRS-5-ELEMENTS-V1, Boynton et al. 2007)"
        GEO_META.parent.mkdir(parents=True, exist_ok=True)
        GEO_META.write_text(json.dumps(meta), encoding="utf-8")
        print(f"Geophysics grids written to {GEO_META}")
    except Exception as err:
        print(f"Geophysics grids could not be built: {err}")


def build_env_grids():
    if ENV_META.exists() and ENV_BIN.exists():
        return
    print("Building environment grids (one time, ~70 MB download) ...")
    try:
        ti = _thermal_inertia()
        alb = _albedo()
        k, th = _grs("k"), _grs("th")
        body = array("H", [min(65535, round(v)) for v in ti])
        body.extend(min(65535, round(v * 10000)) for v in alb)
        if sys.byteorder == "big":
            body.byteswap()
        ENV_BIN.parent.mkdir(parents=True, exist_ok=True)
        ENV_BIN.write_bytes(body.tobytes())
        meta = {
            "w": ENV_W, "h": ENV_H, "res": ENV_RES, "west": -180, "north": 90,
            "layers": {
                "ti": {"offset": 0, "type": "uint16le", "scale": 1, "nodata": 0, "unit": "J m-2 K-1 s-1/2",
                       "source": "MGS TES nighttime thermal inertia, Putzig & Mellon 2007 (PDS MGS-M-TES-5-TIMAP-V1), 20 px/deg, block-averaged to 0.25°"},
                "albedo": {"offset": ENV_W * ENV_H * 2, "type": "uint16le", "scale": 1e-4, "nodata": 0, "unit": "",
                           "source": "MGS TES bolometric albedo, Christensen et al. 2001 (USGS Astrogeology), 7410 m, block-averaged to 0.25°"},
            },
            "grs": {"w": 72, "h": 36, "res": 5, "west": -180, "north": 90, "k_wtpct": k, "th_ppm": th,
                    "source": "Mars Odyssey GRS element concentrations, smoothed 5°×5° (PDS ODY-M-GRS-5-ELEMENTS-V1, Boynton et al. 2007)"},
        }
        ENV_META.write_text(json.dumps(meta), encoding="utf-8")
        print(f"Environment grids written to {ENV_META.parent}")
    except Exception as err:  # the app still works, only the environment maps stay unavailable
        print(f"Environment grids could not be built: {err}")


class PathfinderHandler(SimpleHTTPRequestHandler):
    # Windows registry can map .js to text/plain; force correct types.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # No caching during development, so edits show up on reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/proxy"):
            self.proxy()
        else:
            super().do_GET()

    def proxy(self):
        url = parse_qs(urlparse(self.path).query).get("url", [""])[0]
        target = urlparse(url)
        if target.scheme != "https" or target.hostname not in PROXY_HOSTS:
            self.send_error(400, "Host not allowed")
            return

        headers = {"User-Agent": "MARS-Pathfinder"}
        if self.headers.get("Range"):
            headers["Range"] = self.headers["Range"]
        try:
            with urlopen(Request(url, headers=headers), timeout=60) as resp:
                body = resp.read()
                self.send_response(resp.status)
                for name in ("Content-Type", "Content-Range", "Accept-Ranges"):
                    if resp.headers.get(name):
                        self.send_header(name, resp.headers[name])
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as err:
            self._safe_error(err.code, err.reason)
        except URLError as err:
            self._safe_error(502, f"Source unreachable: {err.reason}")
        except (ConnectionError, TimeoutError, OSError) as err:
            # Browser cancelled the request (tile/DTM no longer needed) or the source timed out.
            self._safe_error(504, f"Source timeout or connection closed: {err}")

    def _safe_error(self, code, msg):
        try:
            self.send_error(code, msg)
        except (ConnectionError, OSError):
            pass

    def do_HEAD(self):
        if self.path.startswith("/api/proxy"):
            self.send_error(405)
        else:
            super().do_HEAD()

    def log_message(self, fmt, *args):
        # Only log errors, not every asset request.
        # Only real errors; missing favicon and cancelled requests are normal.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")) and "favicon" not in str(args[0]):
            super().log_message(fmt, *args)


class QuietServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # Windows raises ConnectionAbortedError/ResetError when the browser cancels a request; not an app error.
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def main():
    if not (WEB_ROOT / "index.html").exists():
        raise SystemExit(f"index.html not found in {WEB_ROOT}")

    def build_all():
        build_env_grids()
        build_geo_grids()

    threading.Thread(target=build_all, daemon=True).start()
    handler = partial(PathfinderHandler, directory=str(WEB_ROOT))
    server = QuietServer((HOST, PORT), handler)
    print(f"MARS Pathfinder running at http://{HOST}:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
