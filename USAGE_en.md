# BrowserCodecAnalyzer / BrowserCodecAnalyzer Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Requirements](#requirements)
3. [Build & Deployment](#build--deployment)
4. [Web UI User Guide](#web-ui-user-guide)
5. [CLI Tool User Guide](#cli-tool-user-guide)
6. [Core Architecture & Data Flow](#core-architecture--data-flow)
7. [API Reference](#api-reference)
8. [Extension Development Guide](#extension-development-guide)
9. [Troubleshooting](#troubleshooting)
10. [Performance Optimization](#performance-optimization)

---

## Project Overview

BrowserCodecAnalyzer (project codename BrowserCodecAnalyzer) is a **bitstream analyzer** designed for video codec engineers. It parses mainstream video coding standards (raw bitstreams, container formats, and image files) and provides an intuitive visual analysis interface.

### Core Capabilities

| Capability | Support Range |
|------------|---------------|
| **Video Coding Standards** | H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9 |
| **Container Formats** | MP4/M4V/MOV (incl. fMP4), WebM, IVF, MPEG-TS |
| **Image Formats** | HEIC/HEIF, AVIF, JPEG, PNG, GIF, WebP, BMP |
| **Raw Bitstream Formats** | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit, .obu |
| **Raw YUV** | 8-bit: I420, YV12, NV12, NV21, YUV422p, YUYV, UYVY, YUV444p (Web UI only) |
| **Output Forms** | Web UI (WASM), Native CLI (C++) |

### Use Cases

- **Codec Development & Debugging**: Verify encoder output syntax correctness
- **Bitstream Conformance Analysis**: Profile/Level compliance checks, reference structure integrity validation
- **HDR/Color Metadata Extraction**: Mastering Display, CLL, chroma format, etc.
- **Educational Demonstration**: Visualize NAL/OBU structure, frame type distribution, syntax element hierarchy
- **Reverse Engineering**: Analyze unknown bitstream encoding parameters, SEI messages, extension data

---

## Requirements

### Web Version (WASM) Build Environment

| Dependency | Version | Notes |
|------------|---------|-------|
| **Emscripten (emcc)** | 3.1.50+ | Install latest via emsdk |
| **Python 3** | 3.8+ | For local HTTP server preview |
| **Node.js** | 16+ | Optional, for frontend development |
| **OS** | Linux/macOS/Windows(WSL2) | Windows native requires extra config |

#### Emscripten Installation

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Verify installation
emcc --version
```

> **Tip**: Add `source ./emsdk_env.sh` to `~/.bashrc` or `~/.zshrc` for persistent environment.

### Native Version Build Environment

| Dependency | Version | Notes |
|------------|---------|-------|
| **C++ Compiler** | clang++ 10+ / g++ 9+ | C++11 support |
| **CMake** | 3.16+ | Optional, currently using Makefile |
| **Standard Library** | libc++ / libstdc++ | C++11 standard library |

---

## Build & Deployment

### Method 1: Web Version (Recommended)

```bash
# 1. Enter project directory
cd /path/to/BrowserCodecAnalyzer

# 2. Run build script (auto-detects emcc)
./build.sh

# 3. Build artifacts in dist/
ls dist/
# hevc.js          # WASM module + JS glue code
# hevc.wasm        # WebAssembly binary
# index.html       # Main page
# css/style.css    # Styles
# js/              # Frontend JS modules

# 4. Start local server for preview
python3 -m http.server -d dist 8000
# Open http://localhost:8000 in browser
```

#### Build Script Parameters Explained

Core compilation parameters in `build.sh`:

```bash
em++ [source_files...] \
  -I[include_paths...] \
  -std=c++11 -O2 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_hevc_parse","_hevc_get_nal_syntax",...]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString",...]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createHevcModule \
  -o dist/hevc.js
```

| Parameter | Description |
|-----------|-------------|
| `-s WASM=1` | Generate WebAssembly |
| `-s ALLOW_MEMORY_GROWTH=1` | Allow dynamic memory growth, prevents OOM on large files |
| `-s MODULARIZE=1` | Generate a module factory (global `createHevcModule`, also importable as ES module) |
| `-s EXPORT_NAME=createHevcModule` | Exported module factory function name |
| `EXPORTED_FUNCTIONS` | C functions exported for JS calls |

### Method 2: Native CLI Version

```bash
# Build using Makefile
make native

# Artifact: hevcparser_native (executable)
./hevcparser_native --help
# Usage: hevcparser_native <input> [codec|nal_index] [nal_index]
#   --help / -h  print full usage and exit 0
```

#### Makefile Targets

| Target | Description |
|--------|-------------|
| `make` / `make all` | Default builds native |
| `make native` | Build native executable `hevcparser_native` |
| `make wasm` | Build web version — identical to `./build.sh` (sources, emcc flags and packaging) |
| `make clean` | Clean all build artifacts |

### Method 3: CI / Pages Deployment

The repository ships two ready-to-use deployment pipelines, both running `./build.sh` and publishing `dist/`:

| Platform | Config | Trigger |
|----------|--------|---------|
| **GitHub Pages** | `.github/workflows/deploy.yml` | Push to `main`/`master`, or manual dispatch |
| **GitLab Pages** | `.gitlab-ci.yml` | Push to `main`/`master`, or manual pipeline run (page at `https://<user>.gitlab.io/<project>`) |

---

## Web UI User Guide

### Interface Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: Logo | Codec Badge | Reset | File Input | Help/Plugin │
├─────────────────────────────────────────────────────────────┤
│ Dropzone (Drag & Drop Upload Area)                           │
├─────────────────────────────────────────────────────────────┤
│ Stats Bar: Bitrate, FPS, Resolution, Profile, etc.           │
├─────────────────────────────────────────────────────────────┤
│ YUV Settings Bar (only for .yuv files)                       │
├─────────────────────────────────────────────────────────────┤
│ Timeline Panel: Frame Structure Timeline (I=Red, P=Blue, B=Green) │
├─────────────────────────────────────────────────────────────┤
│ NAL Unit List    │ Syntax / Preview / Hex / SEI / MediaInfo / Bitrate │
│ (Left Panel)     │ (Right Panel, Tabbed)                       │
├──────────────────┴──────────────────────────────────────────┤
│ Bottom Panels: HDR/Color Info | Warnings Table             │
├─────────────────────────────────────────────────────────────┤
│ Status Bar: Status Messages                                  │
└─────────────────────────────────────────────────────────────┘
```

### File Loading Methods

1. **Click "Open File" button** → System file picker
2. **Drag file to Dropzone** → Auto-detect and parse
3. **Command line argument** (CLI only) → `./hevcparser_native input.hevc`

### Core Feature Operations

#### 1. NAL/OBU Unit List (Left Panel)

| Column | Meaning | Interaction |
|--------|---------|-------------|
| Offset | File offset (bytes) | - |
| Length | NAL unit length | - |
| Type | NAL type name (VPS/SPS/PPS/IDR/Non-IDR/SEI/etc.) | Color-coded |
| Frame | Frame number (POC) | - |
| Info | Key syntax element summary | Hover for full details |

**Operations**:
- Click any row → Right panel shows full syntax tree and Hex dump for that NAL
- Scroll list → Auto-load visible rows (virtual scrolling, supports millions of NALs)

#### 2. Syntax Tree Tab (Syntax)

- **Tree Structure**: Hierarchical display of all syntax elements
- **Expand/Collapse**: Click ▶/▼ icons

**Syntax Element Field Format**:
```
name: value [description/constraint]
Example: pic_width_in_luma_samples: 1920 [compliant with Main 10 Profile]
```

#### 3. Preview Tab (Preview)

- **Video Decode Preview**: Click timeline frame → Decode and display frame
- **Playback Controls**: ▶ Play, |◀ Prev Frame, ▶| Next Frame
- **Order Toggle**: "Decode Order" ↔ "Display Order"
- **Frame Lightbox**: Click the preview canvas → full-resolution modal with **Fit / 100%** zoom modes and **Save PNG** (lossless export of the current frame snapshot; available for all codecs and raw YUV)
- **Supported Decoders**:
  - H.264/H.265/VP9 → Browser native WebCodecs
  - H.266/VVC → vvdec WASM (requires extra load)
  - AV1 → dav1d WASM (requires extra load)
  - HEIC → libheif WASM; AVIF → dav1d WASM; JPEG/PNG/GIF/WebP/BMP → browser-native

#### 4. Hex View Tab (Hex)

- **Raw Bytes View**: NAL unit in hex + ASCII
- **Address Bar**: Shows absolute file offset
- **Truncation**: Display is capped at the first 4 KB per NAL unit (raw YUV frames can be tens of MB; a notice is shown when truncated)

#### 5. SEI Tab

Aggregated table of all SEI messages across the parsed stream (one row per SEI message):

| Column | Meaning |
|--------|---------|
| NAL # | Index of the NAL unit carrying the message |
| Offset | File offset of the NAL unit |
| Payload Type | Type name (e.g., decoded picture hash) + numeric payloadType |
| Size | Payload size in bytes |
| Text / Content | Printable payload as text, `(binary)` if not textual |
| Frame TS | Frame timestamp extracted from custom H.264 `"frame ts"` SEI (when present) |

- Click a row → selects the corresponding NAL unit in the list (and shows its syntax tree)
- Custom SEI payloads can be decoded via the SEI plugin system (see below)

#### 6. MediaInfo Tab

Container-level metadata (MP4/MOV/WebM/IVF):
- Format, major brand, compatible brands
- Duration, total bitrate
- Track info: type, codec, resolution, frame rate, language

For raw YUV files, this tab shows the raw YUV section: pixel arrangement,
resolution, fps, frame count, frame size, file size, and duration (frames/fps),
plus an "Additional Metadata (SEI-like)" placeholder section reserved for future
sensor/GPS/IMU data sources.

#### 7. Bitrate Statistics Tab (Bitrate)

- **Frame-level Bitrate Chart**: Per-frame instantaneous bitrate bar chart, colored by frame type (I=red, P=blue, B=green)
- **Statistics**: Frames, FPS, total size, average / peak / min bitrate (with frame index), I/P/B counts
- **Interaction**: `+`/`−` buttons zoom the chart; hover a bar for per-frame details; the selected frame is highlighted

#### 8. Timeline Panel

- **Color Coding**: I-frame=Red, P-frame=Blue, B-frame=Green, IDR=Dark Red
- **Zoom**: `+` / `−` buttons on the panel
- **Frame Step**: `|◀` / `▶|` buttons on the panel
- **Click Frame**: Select and preview decoded frame
- **Hover**: Tooltip with frame details (type, QP, size; for YUV: frame index and synthetic timestamp)
- **Progress Indicator**: Highlights current playback position during play
- **Long videos**: Zoom auto-fits; a minimum clickable frame width is enforced so long streams stay navigable

#### 9. HDR/Color Info Panel (Bottom Left)

| Item | Source | Example |
|------|--------|---------|
| Chroma Format | SPS/VPS chroma_format_idc | 4:2:0 / 4:2:2 / 4:4:4 |
| Bit Depth | bit_depth_luma/chroma | 8 / 10 / 12 |
| Mastering Display | SEI mastering_display_colour_volume | G(13250,34500) B(7500,3000) R(34000,16000) WP(15635,16450) |
| MaxCLL / MaxFALL | SEI content_light_level_info | MaxCLL=4000, MaxFALL=200 |
| Transfer Characteristics | VUI transfer_characteristics | PQ (SMPTE ST 2084) / HLG / BT.709 |
| Color Primaries | VUI colour_primaries | BT.2020 / BT.709 / P3-D65 |

#### 10. Warnings Panel (Bottom Right)

| Level | Type | Description |
|-------|------|-------------|
| 🔴 Error | Out of range | Syntax element value exceeds standard-defined range |
| 🟡 Warning | Missing ref structure | Reference picture list, DPB state inconsistency |
| 🔵 Info | Profile conformance | Violates Profile constraints (e.g., Main 10 using 8-bit) |

**Filter**: Dropdown to select warning type (-1=All, 1=Out of range, 2=Ref structure, 3=Profile)

### UI Controls Reference

Most interactions are mouse-driven; the app also supports a minimal keyboard set:
`Esc` closes the open modal (frame lightbox / help) and returns focus to the
trigger button, `←` / `→` step one frame back/forward (ignored while typing in
inputs). Tabs expose ARIA `tablist`/`tab` roles with `aria-selected` state.

| Control | Location | Function |
|---------|----------|----------|
| `+` / `−` buttons | Timeline / Bitrate panels | Zoom in / out |
| `\|◀` / `▶\|` buttons | Timeline panel | Previous / next frame |
| ▶ Play / \|◀ Prev / ▶\| Next | Preview tab | Playback and frame stepping |
| "Decode Order" toggle | Preview tab | Switch between decode order and display order |
| Click preview canvas | Preview tab | Open full-resolution lightbox (Fit / 100%, Save PNG) |
| Click NAL row | NAL list | Show syntax tree + hex for that NAL |
| Click frame bar | Timeline | Select and preview frame |
| Drag splitters | Between panels | Resize columns / rows |
| `Esc` | Global (when a modal is open) | Close modal, focus returns to trigger |
| `←` / `→` | Global (file loaded, not typing in an input) | Previous / next frame |
| Drag file onto the window | Anytime, even with a file loaded | Load / replace file (overlay confirms the drop zone) |

### Raw YUV Files (.yuv)

Raw YUV carries no header — dimensions, format, and fps are guessed from the
file size and can be overridden by the user. YUV support is **Web UI only** (the
CLI handles H.264/HEVC/VVC bitstreams only).

- **Auto-guess**: only exact single-frame matches are accepted
  (`fileSize === frameSize`), ranked with NV12 first (camera/ADAS convention),
  then I420, packed YUYV/UYVY. If no candidate matches, the settings panel opens
  waiting for manual input.
- **YUV Settings bar** (shown below the stats bar, YUV files only):
  Width / Height number inputs, Format dropdown (8 arrangements: I420, YV12,
  NV12, NV21, YUV422p, YUYV, UYVY, YUV444p), FPS (default 30), Color Matrix
  (BT.601 / BT.709), Apply button → re-parse and refresh all views.
- **Single-frame mode**: a `.yuv` file is treated as one frame; Play is a no-op
  for YUV. Max resolution 7680×4320 (8K), validated on Apply.
- **Color conversion**: BT.601 (SD) / BT.709 (height ≥ 720) auto-default with
  manual switch; full range by default. Bilinear chroma upsampling aligned with
  the reference Python tool (cv2 INTER_LINEAR); conversion runs in the
  `yuv_convert_planes` WASM export with a pure-JS fallback (`YuvParser.yuvToRGBA`).
- **Performance**: preview uses downscale-first conversion (an 8K preview takes
  ~10-20 ms); full-resolution conversion is deferred until the lightbox opens
  (one-shot, needed for lossless PNG export).
- **Display**: stats bar shows resolution/format/frames/FPS; MediaInfo shows the
  raw YUV section; timeline shows one bar per frame; per-frame info shows frame
  index and synthetic timestamp (frameIdx/fps), with file mtime as capture time.

Design details: [`docs/superpowers/specs/2026-09-17-yuv-parser-design.md`](docs/superpowers/specs/2026-09-17-yuv-parser-design.md)

### SEI Plugin System

#### Loading a Plugin

1. Click the "⚙ Plugin" button in the toolbar
2. Select a `.js` plugin file (a plain script, not an ES module)
3. The plugin registers itself via the global `BrowserCodecAnalyzer.registerPlugin(...)`; on success the status bar reports the number of registered plugins
4. Click an SEI NAL in the NAL list — the plugin's parsed fields are appended to the syntax tree

#### Plugin Development Specification

A plugin is a plain `.js` file that calls `BrowserCodecAnalyzer.registerPlugin(...)`.
Matching is by **SEI payloadType** (not UUID). A complete, runnable example:
[`www/plugins/example-sei.js`](www/plugins/example-sei.js).

```javascript
// my-sei-plugin.js
BrowserCodecAnalyzer.registerPlugin({
  // Display name
  name: "Custom SEI (payloadType 137)",

  // Optional codec filter: "hevc" / "avc"; omit to match all codecs
  codec: "hevc",

  // payloadType: single number, or payloadTypes: [137, 138]
  payloadType: 137,

  // Parse function: ctx is a BitReader, meta carries payload info.
  // Return a tree node rendered in the syntax tree.
  parse: function (ctx, meta) {
    // ctx.readBits(n) / ctx.readU(n)   — read n bits
    // ctx.readUe() / ctx.readSe()      — unsigned / signed Exp-Golomb
    // ctx.bitsLeft                     — remaining bits
    // meta: { codec, payloadType, payloadSize }
    var value = ctx.readBits(16);
    return {
      name: "My SEI Group",       // optional group name
      children: [
        { name: "field1", value: value },
        { name: "sub", children: [ /* nested groups */ ] }
      ]
    };
  }
});
```

**Plugin registry API** (global object `window.BrowserCodecAnalyzer`):

| Function | Description |
|----------|-------------|
| `registerPlugin(plugin)` | Register a plugin; returns `false` (with console warning) if `parse` or `payloadType(s)` is missing |
| `getPlugins()` | List registered plugins |
| `clearPlugins()` | Remove all plugins |
| `runSeiPlugin(fileBytes, nal, codec)` | Internal: run the first matching plugin on an SEI NAL |

Notes:
- Only the first SEI message inside a NAL unit is passed to plugins.
- Plugins run in the page context; the file is evaluated once on load.

---

## CLI Tool User Guide

> Scope: the CLI parses **raw H.264/HEVC/VVC bitstreams only**. Containers
> (MP4/WebM/IVF/TS), images (HEIC/AVIF/JPEG/...), and raw YUV are Web UI only.

### Basic Syntax

```bash
./hevcparser_native <input_file> [codec|nal_index] [nal_index]
```

### Parameter Description

| Position | Parameter | Type | Description |
|----------|-----------|------|-------------|
| 1 | `input_file` | string | Required, input file path |
| 2 | `codec` | string | Optional, force codec: `avc` \| `hevc` \| `vvc` |
| 2 | `nal_index` | integer | Optional, if arg2 not a codec name, treated as NAL index |
| 3 | `nal_index` | integer | Optional, when arg2 is codec name, arg3 is NAL index |

### Usage Examples

```bash
# 1. Auto-detect codec, output summary
./hevcparser_native video.hevc

# 2. Force HEVC parsing
./hevcparser_native video.bin hevc

# 3. Parse and view NAL #0 syntax (auto-detect)
./hevcparser_native video.h265 0

# 4. Force AVC and view NAL #5
./hevcparser_native video.h264 avc 5

# 5. Parse VVC bitstream
./hevcparser_native video.vvc vvc
```

### Output Format

**Standard Output (stdout)**: JSON summary
```json
{
  "codec": "hevc",
  "nal_count": 150,
  "width": 1920,
  "height": 1080,
  "profile": "Main 10",
  "level": "4.1",
  "fps": 30,
  "bit_depth": 10,
  "chroma_format": "4:2:0",
  "nal_units": [
    {"index": 0, "type": "VPS", "offset": 0, "size": 42},
    {"index": 1, "type": "SPS", "offset": 42, "size": 68},
    ...
  ]
}
```

**Standard Error (stderr)**: Parse logs, NAL syntax details, errors

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Argument error (missing input file) |
| 2 | File open failed |
| 3 | Parse failed (corrupt/unsupported bitstream) |

---

## Core Architecture & Data Flow

### Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Input Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  File Input  │  │  Drag Drop  │  │  CLI Args   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Router (app.js handleFile)           │
│  .yuv → YuvParser: guess size/format from file size (+ WASM      │
│         yuv_convert_planes conversion, JS fallback)               │
│  JPEG/PNG/GIF/WebP/BMP → browser-native / JpegParser             │
│  AVIF/HEIC → demux.js extract (libheif/dav1d WASM decode)       │
│  MP4/MOV  → ISOBMFF Parse  → Extract Video Track + Bitstream     │
│  WebM     → Matroska Parse → Extract Video Track + Bitstream     │
│  IVF/TS   → IVF/MPEG-TS Parse → Extract Frame Data/Bitstream     │
└────────────────────────────┬────────────────────────────────────┘
                             │ Raw Bitstream Bytes (Uint8Array)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Codec Detection Layer (CodecDetector.cpp)     │
│  Scan Start Codes (00 00 01 / 00 00 00 01)                       │
│  ├── AVC: nal_unit_type == 7 (SPS) + Valid profile_idc           │
│  ├── HEVC: (nal_unit_type >> 1) & 0x3F ∈ {32,33,34} + layer_id=0│
│  └── VVC: (byte1 >> 3) & 0x1F ∈ {14,15,16}                      │
└────────────────────────────┬──────────────────────────────────────┘
                             │ Detection Result: "avc" | "hevc" | "vvc" | "unknown"
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Parser Core Layer (C++ Core)                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ HEVC::Parser │  │ AVC::Parser  │  │ VVC::Parser  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  Consumer Interface (Observer Pattern)  │       │
│  │  onNALUnit(NALUnit*, Info*)                           │       │
│  │  onWarning(warning_string, Info*, WarningType)        │       │
│  └────────────────────────────┬───────────────────────────┘       │
│                               │                                   │
│         ┌─────────────────────┼─────────────────────┐             │
│         ▼                     ▼                     ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐       │
│  │ WebParser   │      │ProfileConf- │      │  (Extensible)│       │
│  │ (JSON Ser.) │      │ ormanceAnal │      │              │       │
│  └──────┬──────┘      └──────┬──────┘      └─────────────┘       │
│         │                    │                                    │
│         ▼                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              WebAssembly Export Interface (webapi.cpp)     │    │
│  │  hevc_parse/avc_parse/vvc_parse → JSON Summary           │    │
│  │  hevc_get_nal_syntax/... → JSON NAL Syntax Tree          │    │
│  │  hevc_reset/avc_reset/vvc_reset → Release Resources      │    │
│  │  detect_codec → "avc"/"hevc"/"vvc"/"unknown"             │    │
│  │  hevc_free → Free C String Memory                        │    │
│  └────────────────────────────┬──────────────────────────────┘    │
└─────────────────────────────┼─────────────────────────────────────┘
                              │ JavaScript (global createHevcModule)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Render Layer (app.js)               │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌────────┐  │
│  │ NAL List   │ │ Timeline │ │ Syntax │ │ Preview│ │ Hex    │  │
│  │ Virtual    │ │ Canvas   │ │ Tree    │ │ Canvas │ │ View   │  │
│  │ Scroll     │ │ Rendering│ │ (DOM)   │ │+Lightbox│ │(4KB cap)│ │
│  └────────────┘ └──────────┘ └─────────┘ └────────┘ └────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ SEI Tab  │ │ Bitrate  │ │ MediaInfo  │ │ YUV Settings     │  │
│  │ (table)  │ │ (chart)  │ │ / HDR /Warn│ │ (guess + convert) │  │
│  └──────────┘ └──────────┘ └────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Data Structures

#### NALUnit (Common Base for HEVC/VVC/AVC)

```cpp
// src/hevcparser/include/Hevc.h etc.
class NALUnit {
public:
    uint32_t        m_nalUnitType;      // NAL type
    uint32_t        m_nuhLayerId;       // Layer ID (HEVC/VVC)
    uint32_t        m_nuhTemporalIdPlus1; // Temporal ID + 1
    std::size_t     m_offset;           // File offset
    std::size_t     m_size;             // Unit size
    // ... Payload fields defined by subclass
};
```

#### WebParser Serialization Output Format

**Summary JSON** (`serializeSummary()`):
```json
{
  "codec": "hevc",
  "totalSize": 10485760,
  "nalCount": 1250,
  "width": 3840,
  "height": 2160,
  "bitDepth": 10,
  "chromaFormat": "4:2:0",
  "profile": "Main 10",
  "level": "5.1",
  "fpsNum": 60,
  "fpsDen": 1,
  "firstFrameOffset": 0,
  "lastFrameOffset": 10485000,
  "warnings": [
    {"offset": 1024, "message": "pic_width_in_luma_samples out of range", "type": 1}
  ],
  "hdrInfo": {
    "masteringDisplay": {...},
    "maxCLL": 4000,
    "maxFALL": 200,
    "transferCharacteristics": 16,
    "colourPrimaries": 9
  }
}
```

**NAL Syntax JSON** (`serializeNalSyntax(index)`):
```json
{
  "n": "SPS",
  "offset": 42,
  "size": 68,
  "type": 33,
  "layerId": 0,
  "temporalId": 0,
  "syntax": [
    {"name": "vps_video_parameter_set_id", "value": 0, "bits": 4},
    {"name": "vps_max_layers_minus1", "value": 0, "bits": 6},
    {"name": "vps_max_sub_layers_minus1", "value": 0, "bits": 3},
    ...
    {"name": "sps_seq_parameter_set_id", "value": 0, "bits": 4},
    {"name": "chroma_format_idc", "value": 1, "bits": 2, "desc": "4:2:0"},
    {"name": "pic_width_in_luma_samples", "value": 1920, "bits": 16},
    ...
  ]
}
```

---

## API Reference

### C API (Exported from webapi.cpp)

All functions marked `HEVC_KEEPALIVE` (Emscripten symbol retention).

#### Common Functions

```c
// Free string memory allocated by API
void hevc_free(void *ptr);

// Detect bitstream type
// Returns: "avc" | "hevc" | "vvc" | "unknown" (must hevc_free)
char *detect_codec(const uint8_t *data, size_t size);
```

#### HEVC/H.265 API

```c
// Parse HEVC bitstream, returns summary JSON (must hevc_free)
char *hevc_parse(const uint8_t *data, size_t size);

// Get syntax tree JSON for NAL at index (must hevc_free)
char *hevc_get_nal_syntax(size_t index);

// Reset parser state, release internal resources
void hevc_reset();
```

#### AVC/H.264 API

```c
char *avc_parse(const uint8_t *data, size_t size);
char *avc_get_nal_syntax(size_t index);
void avc_reset();
```

#### VVC/H.266 API

```c
char *vvc_parse(const uint8_t *data, size_t size);
char *vvc_get_nal_syntax(size_t index);
void vvc_reset();
```

#### YUV Conversion API (WASM only)

```c
// Convert separate Y/U/V planes to an RGBA buffer (malloc'd; free with hevc_free).
// The JS wrapper extracts separate u/v planes first (getFrame), so format only
// selects the subsampling factors. format is the index into the JS
// YuvParser.FORMAT_ORDER table: 0=i420, 1=nv12, 2=yv12, 3=nv21,
// 4=yuv422p, 5=yuyv, 6=uyvy, 7=yuv444p
// matrix: 0=bt601, 1=bt709;  fullRange: 0/1
uint8_t *yuv_convert_planes(const uint8_t *y, size_t yLen,
                            const uint8_t *u, size_t uLen,
                            const uint8_t *v, size_t vLen,
                            int width, int height, int format,
                            int matrix, int fullRange);
```

### JavaScript API (app.js Core Module)

#### createHevcModule (WASM Module Factory)

`www/index.html` loads the Emscripten glue via a plain `<script src="hevc.js">`
tag; the factory is consumed as a **global** (no bundler / ES import needed):

```javascript
// app.js boot: instantiate the module, keep the resolved instance
createHevcModule().then(function (m) {
  Module = m;   // ready — _malloc / _hevc_parse / ... available
});

// Usage pattern (actual app.js code): call the _-prefixed exports
// directly on the module and read C strings with UTF8ToString
var ptr = Module._malloc(bytes.length);
Module.HEAPU8.set(bytes, ptr);
var outPtr = Module._hevc_parse(ptr, bytes.length);   // or _avc_parse / _vvc_parse
var json = Module.UTF8ToString(outPtr);
Module._hevc_free(outPtr);
Module._free(ptr);

// Codec detection
var codecPtr = Module._detect_codec(ptr, bytes.length);
var codec = Module.UTF8ToString(codecPtr);            // "avc" | "hevc" | "vvc" | "unknown"
Module._hevc_free(codecPtr);

// YUV conversion (WASM path)
var rgbaPtr = Module._yuv_convert_planes(py, yLen, pu, uLen, pv, vLen,
                                         w, h, fmtIdx, matrix, fullRange);
```

`cwrap`/`ccall` are also exported (`EXPORTED_RUNTIME_METHODS`) and may be used
instead of the `_`-prefixed direct calls.

#### Memory Management Pattern

The ownership rules that must be respected by any caller:

- `hevc_parse` / `avc_parse` / `vvc_parse` / `detect_codec` /
  `*_get_nal_syntax` / `yuv_convert_planes` return a **malloc'd C buffer** —
  always release it with `hevc_free` after copying to JS.
- Buffers copied into the WASM heap with `_malloc` must be released with
  `_free` (see `parseBuffer` in app.js for the reference flow).

```javascript
var ptr = Module._malloc(bytes.length);
Module.HEAPU8.set(bytes, ptr);
try {
  var outPtr = Module._hevc_parse(ptr, bytes.length);
  var summary = JSON.parse(Module.UTF8ToString(outPtr));
  Module._hevc_free(outPtr);       // release the returned JSON buffer
  return summary;
} finally {
  Module._free(ptr);               // release the input copy
}
```

#### Frontend Structure (app.js)

`app.js` is written as an IIFE of plain functions (no classes). Key functions:

```javascript
// File loading entry point: routes by extension/signature
// (.yuv / JPEG / image / AVIF / HEIC / MP4 / TS / IVF / WebM / raw)
handleFile(file)                    // app.js:~2645

// Raw bitstream parse: detect codec → call WASM hevc/avc/vvc_parse
parseBuffer(bytes, hintCodec)       // app.js:~79

// NAL list row click → syntax tree + hex for that NAL
selectNal(index, scrollTo)          // app.js:~2438

// Timeline canvas render (frame bars, zoom, hover tooltip)
renderTimeline()

// Frame preview: WebCodecs / vvdec / dav1d / YUV-convert branch
previewFrame(sliceIndex)

// Per-NAL SEI message table
renderSeiTab()                      // app.js:~2402

// Frame lightbox: full-res modal, Fit/100%, Save PNG
openFrameModal()                    // app.js:~639

// YUV settings panel + re-parse on Apply
showYuvSettings() / applyYuvSettings() / buildYuvData(...)  // app.js:~439-563
```

---

## Extension Development Guide

### Adding New Video Codec Support

#### 1. Create Parser Directory Structure

```
src/newcodecparser/
├── include/
│   ├── NewCodec.h          # Data structure definitions
│   └── NewCodecParser.h    # Parser interface (ref HevcParser.h)
└── src/
    ├── NewCodec.cpp        # Data structure implementation
    ├── NewCodecParser.cpp  # Parsing logic implementation
    └── NewCodecParserImpl.h/cpp  // Implementation details
```

#### 2. Implement Parser Interface

```cpp
// NewCodecParser.h
namespace NEWCODEC {
  class Parser {
  public:
    struct Info { size_t m_position; };
    enum WarningType { NONE, OUT_OF_RANGE, ... };
    
    class Consumer {
      virtual void onNALUnit(std::shared_ptr<NALUnit> pNALUnit, const Info* pInfo) = 0;
      virtual void onWarning(const std::string&, const Info*, WarningType) = 0;
    };
    
    virtual ~Parser();
    virtual size_t process(const uint8_t* pdata, size_t size, size_t offset = 0) = 0;
    virtual void addConsumer(Consumer* pconsumer) = 0;
    virtual void releaseConsumer(Consumer* pconsumer) = 0;
    static Parser* create();
    static void release(Parser*);
  };
}
```

#### 3. Implement WebParser Consumer

```cpp
// src/web/NewCodecWebParser.h
namespace web {
  class NewCodecWebParser : public NEWCODEC::Parser::Consumer {
  public:
    void setTotalSize(size_t size);
    std::string serializeSummary();
    std::string serializeNalSyntax(size_t index);
    
  private:
    void onNALUnit(std::shared_ptr<NEWCODEC::NALUnit> pNALUnit, const Info* pInfo) override;
    void onWarning(const std::string&, const Info*, WarningType) override;
    
    // Internal data structures...
  };
}
```

#### 4. Export C API (webapi.cpp)

```cpp
// In webapi.cpp add:
namespace {
  NEWCODEC::Parser* g_newCodecParser = nullptr;
  web::NewCodecWebParser* g_newCodecWebParser = nullptr;
}

extern "C" {
  HEVC_KEEPALIVE void newcodec_reset() { ... }
  HEVC_KEEPALIVE char* newcodec_parse(const uint8_t* data, size_t size) { ... }
  HEVC_KEEPALIVE char* newcodec_get_nal_syntax(size_t index) { ... }
}
```

#### 5. Update Build System

**build.sh** (canonical web build — CI uses it): add the new sources to the
`em++` source list, add `-Isrc/newcodecparser/include` etc. to the include
paths, and add `_newcodec_parse`, `_newcodec_get_nal_syntax`, `_newcodec_reset`
to `-s EXPORTED_FUNCTIONS`.

**Makefile**: add the new sources to `NATIVE_SRC` and to the `wasm` target's
source list (keep both in sync with `build.sh`).

#### 6. Update CodecDetector

```cpp
// src/web/CodecDetector.cpp
std::string detectCodec(const uint8_t* data, size_t size) {
  // ... After existing logic
  if (isNewCodecNAL(hdr, remaining))
    return "newcodec";
}
```

#### 7. Frontend Integration (app.js)

```javascript
// In parseBuffer / handleFile add a branch for the new codec,
// wrapping the WASM exports via Module.cwrap, e.g.:
if (codec === 'newcodec') {
  summary = parseNewCodec(data);   // cwrap('newcodec_parse', ...) + JSON.parse
}
```

### Adding New Container Format Support

Extend the `H26xDemux` object in `www/js/demux.js` (a plain module of probe +
parse functions, not a class), then route to it in `handleFile` (`www/js/app.js`):

```javascript
// demux.js — signature probe (synchronous, operates on the full Uint8Array)
function isNewFmt(d) { /* magic-byte check */ }
function demuxNewFmt(d) {
  // Parse container → return { annexb, frames, ... } or codec-specific
  // { frames, obus/units, width, height, ... } for AV1/VP9-style paths
}

// Export on the shared object (see the bottom of demux.js):
// H26xDemux.isNewFmt = isNewFmt;
// H26xDemux.demuxNewFmt = demuxNewFmt;

// app.js handleFile() — add a branch BEFORE the raw-bitstream fallback:
// else if (H26xDemux.isNewFmt(rawBytes)) { ... }
```

---

## Troubleshooting

### Build Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `emcc: command not found` | Emscripten not activated | Run `source ./emsdk_env.sh` or restart terminal |
| `error: unknown argument: -s MODULARIZE` | emcc version too old | Upgrade: `./emsdk install latest && ./emsdk activate latest` |
| WASM OOM | Large file exceeds default memory | `ALLOW_MEMORY_GROWTH=1` enabled, verify it's active |
| Compile error `std::filesystem` | C++17 feature used | Code uses C++11 only; check for accidental C++17 header inclusion |

### Runtime Issues

| Issue | Symptom | Debugging Steps |
|-------|---------|-----------------|
| No response after file load | Status bar shows "Loading parser module..." | 1. Check browser console for WASM load errors<br>2. Verify `dist/hevc.wasm` accessible (MIME: application/wasm)<br>3. Check `createHevcModule` resolves normally |
| "parse failed" error | CLI returns code 3 | 1. Verify file not empty<br>2. Check start codes with `xxd` (`00 00 01` or `00 00 00 01`)<br>3. Try force codec: `./hevcparser_native file.bin hevc` |
| Syntax tree empty/broken | Right panel blank | 1. Click different NAL list rows<br>2. Check console `hevc_get_nal_syntax` return value<br>3. Verify NAL index not out of bounds |
| Preview shows black screen | Preview tab no image | 1. Verify WebCodecs support (Chrome 94+, Firefox 110+)<br>2. VVC needs vvdec WASM - check Network tab<br>3. AV1 needs dav1d WASM<br>4. Click different frames on timeline |
| HDR info not showing | Bottom panel empty | 1. Confirm bitstream has SEI: mastering_display_colour_volume / content_light_level_info<br>2. HEVC: VUI colour_description_present_flag=1<br>3. Click corresponding NAL (usually SPS/VPS) to verify in syntax tree |
| YUV auto-guess fails | Settings panel shows "size not divisible — set resolution/format" | Expected for non-standard sizes: enter Width/Height/Format manually and click Apply |
| YUV colors look wrong | Preview tinted/shifted | Switch Color Matrix (BT.601 ↔ BT.709) in the YUV settings bar; default is full range |
| YUV Play does nothing | Play button no effect | By design: single-frame mode — a `.yuv` file is treated as one frame |

### Performance Issues

| Symptom | Optimization Suggestions |
|---------|-------------------------|
| Slow parsing on large files (>500MB) | 1. Only load visible NAL range (virtual scroll implemented)<br>2. Consider chunked parsing (Web Worker)<br>3. Ensure `ALLOW_MEMORY_GROWTH` enabled |
| Timeline rendering lag | Long streams: zoom auto-fit + offscreen base-image cache (implemented); further: OffscreenCanvas in Worker |
| High memory usage | 1. Call `hevc_reset()` promptly to release parser<br>2. Avoid holding multiple large files simultaneously<br>3. Use `URL.revokeObjectURL()` to release Blob URLs |
| YUV preview slow on 8K | Downscale-first preview + WASM conversion implemented; full-res conversion deferred to lightbox open |

---

## Performance Optimization

Implemented optimizations (verified in code):

- **Virtual scrolling**: NAL list renders only visible rows
- **Downscale-first YUV preview**: converts only display-size pixels (~80x work reduction for 8K); full-res conversion deferred to lightbox
- **YUV LUT conversion + WASM**: 256-entry lookup tables; WASM `yuv_convert_planes` preferred with JS fallback
- **Hex view 4 KB cap**: prevents multi-MB HTML renders for YUV frames
- **Timeline**: offscreen base-image cache; auto-fit zoom and min clickable frame width for long videos
- **ALLOW_MEMORY_GROWTH**: WASM heap grows dynamically for large files

Future optimization directions (not yet implemented):

- Chunked/parallel parsing in Web Workers
- OffscreenCanvas timeline rendering in a Worker
- HTTP Range requests / Service Worker caching / CDN distribution
- `-O3` / `-flto` / `INITIAL_MEMORY` tuning in the emcc flags

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2024 | Initial release: HEVC/AVC/VVC parsing, Web UI, CLI, SEI plugins, HDR support |
| (HEAD) | 2026-09 | Raw YUV support (8 formats, auto-guess + settings, BT.601/709, WASM conversion, lightbox + PNG export); SEI tab; frame lightbox for all codecs; custom H.264 frame-ts SEI; hex 4KB cap; GitHub/GitLab Pages CI |

---

## Appendix: Standards Reference

| Standard | Document ID | Version | Notes |
|----------|-------------|---------|-------|
| H.264/AVC | ITU-T H.264 / ISO/IEC 14496-10 | 2023 | Incl. FRExt, MVC, SVC |
| H.265/HEVC | ITU-T H.265 / ISO/IEC 23008-2 | 2023 | Main/Main10/Still Picture/3D |
| H.266/VVC | ITU-T H.266 / ISO/IEC 23090-3 | 2022 | Basic Profile Support |
| AV1 | AOMedia Video 1 | 1.0.0+ | Container-level Demux |
| VP9 | VP9 Bitstream & Decoding Process | v0.6 | Container-level Demux |
| MP4 | ISO/IEC 14496-12 | 2022 | ISOBMFF |
| WebM | Matroska / WebM | - | EBML Subset |
| IVF | IVF Format Specification | - | Simple Container |
| HEIC | ISO/IEC 23008-12 | - | HEVC-based |
| AVIF | AV1 Image File Format | 1.0.0 | AV1-based |

---
