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
| **Container Formats** | MP4/M4V/MOV, WebM, IVF, MPEG-TS |
| **Image Formats** | HEIC/HEIF, AVIF, JPEG, PNG, GIF, WebP, BMP |
| **Raw Bitstream Formats** | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit, .obu |
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
| `-s MODULARIZE=1` | Generate ES6 module, supports `import`/`await` |
| `-s EXPORT_NAME=createHevcModule` | Exported module factory function name |
| `EXPORTED_FUNCTIONS` | C functions exported for JS calls |

### Method 2: Native CLI Version

```bash
# Build using Makefile
make native

# Artifact: hevcparser_native (executable)
./hevcparser_native --help
# Usage: hevcparser_native <input> [nal_index]
```

#### Makefile Targets

| Target | Description |
|--------|-------------|
| `make` / `make all` | Default builds native |
| `make native` | Build native executable `hevcparser_native` |
| `make wasm` | Build web version (same as `./build.sh`) |
| `make clean` | Clean all build artifacts |

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
│ Timeline Panel: Frame Structure Timeline (I=Red, P=Blue, B=Green) │
├─────────────────────────────────────────────────────────────┤
│ NAL Unit List    │ Syntax / Preview / Hex / MediaInfo / Bitrate │
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
| Offset | File offset (bytes) | Click to copy offset |
| Length | NAL unit length | - |
| Type | NAL type name (VPS/SPS/PPS/IDR/Non-IDR/SEI/etc.) | Color-coded |
| Frame | Frame number (POC) | - |
| Info | Key syntax element summary | Hover for full details |

**Operations**:
- Click any row → Right panel shows full syntax tree for that NAL
- Scroll list → Auto-load visible rows (virtual scrolling, supports millions of NALs)
- Double-click → Jump to corresponding frame on timeline

#### 2. Syntax Tree Tab (Syntax)

- **Tree Structure**: Hierarchical display of all syntax elements
- **Expand/Collapse**: Click ▶/▼ icons
- **Search**: `Ctrl+F` to find field names/values in syntax tree
- **Copy**: Click row → Copy path/value/full line

**Syntax Element Field Format**:
```
name: value [description/constraint]
Example: pic_width_in_luma_samples: 1920 [compliant with Main 10 Profile]
```

#### 3. Preview Tab (Preview)

- **Video Decode Preview**: Click timeline frame → Decode and display frame
- **Playback Controls**: ▶ Play, |◀ Prev Frame, ▶| Next Frame
- **Order Toggle**: "Decode Order" ↔ "Display Order"
- **Supported Decoders**:
  - H.264/H.265/VP9 → Browser native WebCodecs
  - H.266/VVC → vvdec WASM (requires extra load)
  - AV1 → dav1d WASM (requires extra load)

#### 4. Hex View Tab (Hex)

- **Raw Bytes View**: Complete NAL unit in hex + ASCII
- **Syntax Element Highlight**: Click syntax tree node → Hex view highlights corresponding byte range
- **Address Bar**: Shows absolute file offset

#### 5. MediaInfo Tab

Container-level metadata (MP4/MOV/WebM/IVF only):
- Format, major brand, compatible brands
- Duration, total bitrate
- Track info: type, codec, resolution, frame rate, language

#### 6. Bitrate Statistics Tab (Bitrate)

- **Frame-level Bitrate Chart**: Frame size over time
- **Statistics**: Average bitrate, peak bitrate, I/P/B average frame size
- **Export**: Download as CSV

#### 7. Timeline Panel

- **Color Coding**: I-frame=Red, P-frame=Blue, B-frame=Green, IDR=Dark Red
- **Zoom**: `+`/`-` keys or mouse wheel
- **Pan**: Drag empty area
- **Click Frame**: Select and preview decoded frame
- **Progress Indicator**: Highlights current playback position during play

#### 8. HDR/Color Info Panel (Bottom Left)

| Item | Source | Example |
|------|--------|---------|
| Chroma Format | SPS/VPS chroma_format_idc | 4:2:0 / 4:2:2 / 4:4:4 |
| Bit Depth | bit_depth_luma/chroma | 8 / 10 / 12 |
| Mastering Display | SEI mastering_display_colour_volume | G(13250,34500) B(7500,3000) R(34000,16000) WP(15635,16450) |
| MaxCLL / MaxFALL | SEI content_light_level_info | MaxCLL=4000, MaxFALL=200 |
| Transfer Characteristics | VUI transfer_characteristics | PQ (SMPTE ST 2084) / HLG / BT.709 |
| Color Primaries | VUI colour_primaries | BT.2020 / BT.709 / P3-D65 |

#### 9. Warnings Panel (Bottom Right)

| Level | Type | Description |
|-------|------|-------------|
| 🔴 Error | Out of range | Syntax element value exceeds standard-defined range |
| 🟡 Warning | Missing ref structure | Reference picture list, DPB state inconsistency |
| 🔵 Info | Profile conformance | Violates Profile constraints (e.g., Main 10 using 8-bit) |

**Filter**: Dropdown to select warning type (-1=All, 1=Out of range, 2=Ref structure, 3=Profile)

### Complete Keyboard Shortcuts

| Shortcut | Function | Context |
|----------|----------|---------|
| `←` | Previous Frame | Global (when not focused on input) |
| `→` | Next Frame | Global |
| `+` / `=` | Timeline Zoom In | Timeline focused |
| `-` / `_` | Timeline Zoom Out | Timeline focused |
| `Space` | Play/Pause | Preview focused |
| `D` | Toggle Decode/Display Order | Preview focused |
| `Home` | Jump to First Frame | Timeline |
| `End` | Jump to Last Frame | Timeline |
| `Ctrl+F` | Search Syntax Tree | Syntax Tree Tab |
| `Esc` | Close Modal/Cancel Selection | Global |

### SEI Plugin System

#### Built-in Plugin Loading

1. Click "⚙ Plugin" button in toolbar
2. Select `.js` plugin file
3. Plugin auto-registers, parses SEI messages with matching UUID

#### Plugin Development Specification

Plugin file must export `registerSEIPlugin(registry)` function:

```javascript
// my-sei-plugin.js
export function registerSEIPlugin(registry) {
  registry.register({
    // SEI payloadType UUID (16-byte hex string)
    uuid: '12345678-9abc-def0-1234-56789abcdef0',
    
    // Display name
    name: 'Custom SEI Message',
    
    // Parse function: payload is Uint8Array, returns parsed object
    parse: (payload, offset, size) => {
      const view = new DataView(payload.buffer, offset, size);
      // Parsing logic...
      return {
        field1: view.getUint32(0),
        field2: view.getUint16(4),
        // Nested objects auto-expand in syntax tree
        nested: { a: 1, b: 2 }
      };
    }
  });
}
```

**Registry API**:

```typescript
interface SEIRegistry {
  register(plugin: SEIPlugin): void;
  unregister(uuid: string): void;
  get(uuid: string): SEIPlugin | undefined;
}

interface SEIPlugin {
  uuid: string;           // 16-byte UUID, hex with hyphens
  name: string;           // Display name
  parse: (payload: Uint8Array, offset: number, size: number) => any;
}
```

---

## CLI Tool User Guide

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
│                     Container Demux Layer (demux.js)              │
│  MP4/MOV  → ISOBMFF Parse  → Extract Video Track + Bitstream     │
│  WebM     → Matroska Parse → Extract Video Track + Bitstream     │
│  IVF      → IVF Parse      → Extract Frame Data                  │
│  Images   → Format Detect  → Extract Encoded Data (HEIC→libheif) │
└────────────────────────────┬──────────────────────────────────────┘
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
                              │ JavaScript (ES Module)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Render Layer (app.js)               │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌────────┐  │
│  │ NAL List   │ │ Timeline │ │ Syntax  │ │ Preview│ │ Hex    │  │
│  │ Virtual    │ │ Canvas   │ │ Tree    │ │ Canvas │ │ View   │  │
│  │ Scroll     │ │ Rendering│ │ (DOM)   │ │(WebGL/2D)          │  │
│  └────────────┘ └──────────┘ └─────────┘ └────────┘ └────────┘  │
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

### JavaScript API (app.js Core Module)

#### createHevcModule (WASM Module Factory)

```javascript
// hevc.js generated by Emscripten, exports default factory
import createHevcModule from './hevc.js';

const Module = await createHevcModule({
  locateFile: (path) => `./${path}`  // WASM file path resolution
});

// Available functions (wrapped via Module.cwrap)
const hevc_parse = Module.cwrap('hevc_parse', 'string', ['number', 'number']);
const hevc_get_nal_syntax = Module.cwrap('hevc_get_nal_syntax', 'string', ['number']);
const hevc_reset = Module.cwrap('hevc_reset', null, []);
const detect_codec = Module.cwrap('detect_codec', 'string', ['number', 'number']);
const hevc_free = Module.cwrap('hevc_free', null, ['number']);
const _malloc = Module.cwrap('malloc', 'number', ['number']);
const _free = Module.cwrap('free', null, ['number']);
const HEAPU8 = Module.HEAPU8;
```

#### Memory Management Pattern

```javascript
// Copy Uint8Array to WASM heap
function copyToHeap(uint8Array) {
  const ptr = _malloc(uint8Array.length);
  HEAPU8.set(uint8Array, ptr);
  return ptr;
}

// Complete call example
async function parseHEVC(fileData) {
  const Module = await createHevcModule();
  const ptr = copyToHeap(fileData);
  try {
    const summaryJson = Module.hevc_parse(ptr, fileData.length);
    Module.hevc_free(ptr);
    return JSON.parse(summaryJson);
  } catch (e) {
    Module.hevc_free(ptr);
    throw e;
  }
}
```

#### Frontend Core Classes (app.js)

```javascript
// App Class - Main Application Controller
class App {
  constructor() { ... }
  
  // File loading entry point
  async loadFile(file) { ... }
  
  // Parse bitstream
  async parseBitstream(data, codecHint) { ... }
  
  // Render NAL list
  renderNalList(summary) { ... }
  
  // Render syntax tree
  renderSyntaxTree(nalIndex) { ... }
  
  // Render timeline
  renderTimeline(summary) { ... }
  
  // Video preview
  previewFrame(frameIndex, decodeOrder) { ... }
}
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

**Makefile**:
```makefile
NEWCODEC_SRC := $(wildcard src/newcodecparser/src/*.cpp)
NATIVE_SRC := ... $(NEWCODEC_SRC) ...

wasm:
	$(EMCC) ... $(NEWCODEC_SRC) ... -o dist/hevc.js
```

**build.sh**: Sync add source files and exported functions.

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
// In App.parseBitstream add branch
if (codec === 'newcodec') {
  summary = await this.parseNewCodec(data);
}
```

### Adding New Container Format Support

Extend `Demuxer` class in `www/js/demux.js`:

```javascript
class Demuxer {
  static async probe(file) {
    const header = await file.slice(0, 12).arrayBuffer();
    const view = new DataView(header);
    
    // MP4/MOV: ftyp box
    if (view.getUint32(4) === 0x66747970) return 'mp4';
    // WebM: EBML header
    if (view.getUint32(0) === 0x1A45DFA3) return 'webm';
    // IVF: "DKIF"
    if (view.getUint32(0) === 0x444B4946) return 'ivf';
    // New format detection...
  }
  
  static async demux(file, type) {
    switch (type) {
      case 'mp4': return this.demuxMP4(file);
      case 'webm': return this.demuxWebM(file);
      case 'ivf': return this.demuxIVF(file);
      case 'newfmt': return this.demuxNewFormat(file); // New
    }
  }
}
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

### Performance Issues

| Symptom | Optimization Suggestions |
|---------|-------------------------|
| Slow parsing on large files (>500MB) | 1. Only load visible NAL range (virtual scroll implemented)<br>2. Consider chunked parsing (Web Worker)<br>3. Ensure `ALLOW_MEMORY_GROWTH` enabled |
| Timeline rendering lag | 1. Reduce Canvas redraw frequency<br>2. Use OffscreenCanvas in Worker<br>3. Simplify frame drawing logic |
| High memory usage | 1. Call `hevc_reset()` promptly to release parser<br>2. Avoid holding multiple large files simultaneously<br>3. Use `URL.revokeObjectURL()` to release Blob URLs |

---

## Performance Optimization

### 1. Parsing Level

- **Incremental Parsing**: Large files parsed in chunks using `process(data, size, offset)` offset parameter
- **Parallelization**: Multi-thread parsing of different Layer/Temporal IDs (requires parser support)
- **Streaming Processing**: Combine with `ReadableStream` for parse-while-download

### 2. WASM Level

```bash
# Optimized compilation flags
-s WASM=1 \
-s ALLOW_MEMORY_GROWTH=1 \
-s INITIAL_MEMORY=64MB \        # Adjust based on typical file sizes
-s MAXIMUM_MEMORY=2GB \         # Set upper limit
-s STACK_SIZE=5MB \             # Stack size
-O3 \                           # Release build uses O3
-flto \                         # Link-time optimization
```

### 3. Frontend Rendering Level

- **Virtual Scrolling**: NAL list renders only visible rows (implemented)
- **Offscreen Canvas**: Timeline rendering moved to Worker via OffscreenCanvas
- **Debounce/Throttle**: Window resize, scroll events debounced
- **Web Workers**: Syntax tree building, Hex view generation moved to Workers

### 4. Network Level

- **Range Requests**: Large files support HTTP Range for partial loading
- **Service Worker**: Cache WASM, JS, plugin files
- **CDN Distribution**: Static assets via CDN

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2024 | Initial release: HEVC/AVC/VVC parsing, Web UI, CLI, SEI plugins, HDR support |

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
