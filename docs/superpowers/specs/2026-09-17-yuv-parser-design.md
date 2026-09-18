# YUV Raw File Parsing Support — Design

Date: 2026-09-17
Status: Approved (scope revised 2026-09-18, see Addendum)
Approach: A (Pure JS front-end, no WASM)

## Addendum (2026-09-18): scope revision + consistency alignment

- **Single-frame mode only**: YUV is treated as one frame (no multi-frame
  playback); auto-guess accepts only exact single-frame matches
  (fileSize === frameSize); Play is a no-op for YUV
- **8K cap**: max resolution 7680x4320 (MAX_WIDTH/MAX_HEIGHT), validated on Apply
- **Consistency alignment** with the reference Python tool
  (`yuv_converter_bt601_bt709.py`, cv2 INTER_LINEAR + full range):
  - Default `fullRange=true` (Python uses Y as-is)
  - Bilinear chroma upsampling, cv2 convention: `src=(dst+0.5)/sub-0.5`,
    replicate borders, round-half-down descale (frac > 0.5 rounds up —
    empirically fitted against cv2 output)
  - Residual vs Python: maxDiff=2, avg 0.002-0.024 (PSNR ~66dB, visually
    indistinguishable) — caused by cv2's internal per-stage fixed-point
    quantization (non-monotonic under any per-pixel model; not replicable
    without cv2 source)
- **Performance**: downscale-first preview (subsample planes to display size,
  convert ~410K pixels instead of 33M for 8K — preview ~10-20ms); full-res
  conversion deferred to lightbox open (one-shot, needed for lossless PNG)
- **WASM conversion module** (emsdk): `src/yuv/YuvConvert.{h,cpp}` pure
  portable C++ core, exported as `_yuv_convert_planes` via webapi.cpp;
  `build.sh` compiles src/yuv/*.cpp; JS wrapper prefers WASM and falls back
  to `YuvParser.yuvToRGBA` (same conventions, both verified vs Python)
- **Preview lightbox**: click preview canvas → full-res modal (Fit/100%,
  pixelated) + Save PNG (lossless, from full-res snapshot); all codecs
  supported (drawVideoFrame maintains a full-res snapshot)

## Goal

Support parsing raw `.yuv` files in BrowserCodecAnalyzer:

- Auto-guess dimensions and pixel format from file size, with user override
  (resolution input + format selection UI)
- Display format info: pixel arrangement (YUV420p, NV12, YUYV...), resolution
  (width/height), frame rate (fps), frame index, per-frame timestamp
  (synthetic: frameIdx/fps; capture time = file mtime)
- Additional metadata section (SEI-like: sensor params, GPS, IMU) — UI
  placeholder only, data source to be connected later
- Frame preview with YUV→RGB conversion supporting BT.601 and BT.709
  (limited/full range), auto-default by resolution + manual switch

## Background

Raw YUV files carry no header: dimensions, format, fps cannot be read from the
file. Only file size is known, so auto-detection is heuristic and ambiguous
(e.g. 1.5 MB may be one 1080p NV12 frame or four 960x540 frames). User
confirmed: auto-guess + user-modifiable settings; metadata is UI placeholder.

## Architecture

| File | Responsibility |
|------|----------------|
| `www/js/yuv.js` (new) | Format table, guess heuristic, frame plane extraction, YUV→RGBA conversion |
| `www/js/app.js` (mod) | `handleFile` `.yuv` branch; settings UI logic; preview/playback YUV path; per-frame info |
| `www/index.html` (mod) | Include yuv.js; YUV settings panel markup; `.yuv` in accept attr |
| `www/css/style.css` (mod) | Settings panel styles (reuse btn/filter patterns) |

Global API on `window.YuvParser`:
`FORMATS`, `guessFormat(size)`, `frameCount(size, w, h, fmt)`,
`getFrame(bytes, off, w, h, fmt)`, `yuvToRGBA(w, h, fmt, planes, matrix, fullRange)`.

No WASM rebuild required. Precedent: `JpegParser.parseJpeg` (pure JS parser in
demux.js/jpeg.js) already follows this pattern.

## Format Table (8-bit, 8 formats)

| Format key | Pixel arrangement | Frame size (W×H) |
|------------|-------------------|-------------------|
| `i420` (yuv420) | planar Y→U→V | w*h*1.5 |
| `yv12` | planar Y→V→U | w*h*1.5 |
| `nv12` | planar Y + interleaved UV | w*h*1.5 |
| `nv21` | planar Y + interleaved VU | w*h*1.5 |
| `yuv422p` (yuv422) | planar Y→U→V | w*h*2 |
| `yuyv` (YUY2) | packed Y0 U Y1 V | w*h*2 |
| `uyvy` | packed U Y0 V Y1 | w*h*2 |
| `yuv444p` (yuv444) | planar Y→U→V | w*h*3 |

## Auto-Guess + User Override

- `.yuv` extension routes directly to YUV path in `handleFile`
- Common-resolution list (1920x1080, 1280x720, 3840x2160, 2560x1440, 960x540,
  640x480, 704x576, 352x288, ...) × all formats; candidate if
  `fileSize % frameSize === 0 && frames >= 1`
- Rank: common formats (i420/nv12 first) × reasonable frame counts (1..500)
  first; pick best, keep alternatives for display
- **YUV Settings panel** (shown only for YUV files, below statsBar):
  Width/Height number inputs, Format dropdown (8 formats), FPS number input
  (default 30), Color Matrix dropdown (BT.601/BT.709), Apply button →
  re-parse and refresh all views
- Non-divisible file size: parse `floor(fileSize / frameSize)` frames and emit
  warning "last frame incomplete"

## Color Matrix (YUV→RGB)

- BT.601 (SD): Kr=0.299, Kb=0.114
- BT.709 (HD): Kr=0.2126, Kb=0.0722
- Both support limited (16-235 / 16-240) and full (0-255) range
- Default: auto by resolution (SD → BT.601, height ≥ 720 → BT.709); user can
  switch in settings panel; preview redraws immediately

## Display Info

- **statsBar**: Resolution, Format (arrangement), Frames, FPS
- **MediaInfo tab**: Raw YUV section — arrangement, resolution, fps, frame
  count, frame size, file size, duration (frames/fps)
- **HDR/Color panel**: color range (assumed BT.601/709 per matrix setting);
  additional metadata (SEI-like) placeholder section for future
  sensor/GPS/IMU data, showing "no data source" until connected
- **Per-frame info**: frame index, synthetic timestamp = frameIdx/fps (s),
  file mtime as capture time — shown in preview hint and timeline tooltip
- **Timeline**: reuse existing `renderTimeline`; one bar per frame (uniform
  "I" color); NAL list shows one row per frame; click frame → preview

## Data Model

```javascript
currentData = {
  codec: "yuv",
  isYuv: true, isImage: false,
  yuv: { width, height, format, formatName, fps, frameSize, frames,
         colorMatrix, fullRange, mtime },
  nalus: [ { offset, length, typeName: "YUV Frame", sliceType: 2, frameIdx } ],
  streamInfo: { nalus: frames, slices: frames, i: frames, p: 0, b: 0,
                profile: "Raw YUV", level: "-", picWidth, picHeight, fps },
  hdr: { picWidth, picHeight },
  warnings: [ ... ]
}
```

Existing play loop early-returns on `isImage`; YUV uses an `isYuv` branch in
`previewFrame`/`startPlayback`/`stepFrame`. Decode order == display order (no
B-frames in raw YUV).

## Preview & Playback

- Reuse existing Preview tab (Play/Prev/Next)
- `previewFrame(i)` YUV branch: `getFrame` → `yuvToRGBA` → `putImageData`
- Playback: `setInterval` at fps; synthetic timestamps advance per frame

## Error Handling

- Invalid/empty dimensions → error message in settings panel
- Very large frame counts (>100k) → warning (timeline already supports this)
- Partial last frame → warning

## Testing

- Generate test files with ffmpeg for all 8 formats:
  `ffmpeg -f lavfi -i testsrc=size=320x240:rate=30 -frames:v 10 -pix_fmt <fmt> -f rawvideo out.yuv`
- Verify per format: auto-guess picks correct WxH+format; user override
  re-parses; preview colors match ffmpeg RGB conversion; play/prev/next work;
  timeline navigation; ambiguity case lists sensible candidates
- Final: copy to dist, serve via `python3 -m http.server -d dist 8000`
