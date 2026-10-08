# BrowserCodecAnalyzer

**H.264 / H.265 / H.266 / AV1 / VP9 码流分析器 + Raw YUV 检视器 · Bitstream & Raw YUV Analyzer**

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](LICENSE)
[![WebAssembly](https://img.shields.io/badge/WASM-supported-654FF0)]()

---

## 简介 / Overview

**中文：**
BrowserCodecAnalyzer 是一款面向视频编解码工程师的**码流分析工具**，支持 H.264/AVC、H.265/HEVC、H.266/VVC、AV1、VP9 等主流视频编码标准，并支持 8-bit Raw YUV 裸数据检视。它提供原生命令行工具与 Web 界面两种形态，可解析裸流、容器封装（MP4/MOV/WebM/IVF/MPEG-TS）及图像格式（HEIC/AVIF/JPEG/PNG/WebP 等），并给出 NAL/OBU 单元列表、语法树、SEI 消息表、帧结构时间线、码率统计、合规性告警、HDR/色彩信息等完整分析视图。全部解析在浏览器本地完成（WebAssembly），无需上传服务器。

**English:**
BrowserCodecAnalyzer is a **bitstream analyzer** for video codec engineers, supporting H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9, plus 8-bit raw YUV inspection. It provides both a native CLI tool and a Web UI, capable of parsing raw bitstreams, container formats (MP4/MOV/WebM/IVF/MPEG-TS), and image formats (HEIC/AVIF/JPEG/PNG/WebP, etc.), delivering complete analysis views including NAL/OBU unit lists, syntax trees, an SEI message table, frame structure timelines, bitrate statistics, conformance warnings, and HDR/color information. All parsing runs locally in the browser (WebAssembly) — no server upload.

---

## 功能特性 / Features

| 功能 | Feature | 说明 / Description |
|------|---------|-------------------|
| **多编解码支持** | Multi-codec Support | H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9 |
| **容器解复用** | Container Demux | MP4, M4V, MOV (含 fMP4), WebM/Matroska, IVF, MPEG-TS (自动检测 / auto-detect) |
| **图像格式** | Image Formats | HEIC/HEIF, AVIF, JPEG (EXIF), PNG, GIF, WebP, BMP |
| **裸流解析** | Raw Bitstream | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit |
| **Raw YUV 检视** | Raw YUV Inspection | 8 种 8-bit 排列（见下），按文件大小自动猜测尺寸/格式，支持手动设置 |
| **NAL/OBU 列表** | NAL/OBU List | 偏移、长度、类型、帧号、关键信息；虚拟滚动支持海量 NAL / Virtual scrolling |
| **语法树** | Syntax Tree | 完整语法元素树，支持展开/折叠 / Full syntax element tree |
| **SEI 消息表** | SEI Tab | 全流 SEI 汇总表：NAL 编号、偏移、Payload 类型/大小/可读内容、帧时间戳；点击行定位 NAL |
| **十六进制视图** | Hex View | 原始字节十六进制+ASCII（超过 4KB 截断显示 / capped at 4KB per NAL） |
| **帧结构时间线** | Frame Timeline | I/P/B 帧着色，+/- 按钮缩放，\|◀/▶\| 逐帧步进，点击预览 |
| **视频预览** | Video Preview | WebCodecs (H.264/H.265/VP9) + vvdec WASM (H.266) + dav1d WASM (AV1)；支持播放/逐帧/解码序-显示序切换 |
| **帧放大镜** | Frame Lightbox | 点击预览画布 → 全分辨率弹窗（Fit / 100%），可无损导出 PNG（所有编解码器及 YUV） |
| **合规性告警** | Conformance Warnings | 越界、参考结构缺失、Profile 一致性，可按类型筛选 |
| **HDR/色彩信息** | HDR/Color Info | Mastering display, CLL, 色度格式 / Mastering, CLL, chroma format |
| **MediaInfo 元数据** | MediaInfo Tab | 容器级元数据：格式、时长、码率、轨道 / Container metadata |
| **码率统计** | Bitrate Tab | 每帧码率柱状图 + 平均/峰值/最小码率 + I/P/B 统计 |
| **SEI 插件系统** | SEI Plugin System | 通过 ⚙ Plugin 按钮加载自定义 .js 插件解析 SEI payload |
| **分栏可调** | Resizable Panels | 拖拽分割条调整布局 / Drag splitters to resize |
| **自定义帧时间戳 SEI** | Custom frame-ts SEI | 内置识别 H.264 码流中 ASCII `"frame ts"` 定制 SEI，逐帧显示时间戳 |

---

## 快速开始 / Quick Start

### Web 版 (WASM) / Web Version (WASM)

```bash
# 1. 安装 Emscripten / Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# 2. 构建 / Build（build.sh 为标准构建入口）
cd BrowserCodecAnalyzer
./build.sh

# 3. 本地预览 / Local preview
python3 -m http.server -d dist 8000
# 打开 http://localhost:8000
```

> **注意 / Note**: 请使用 `./build.sh` 构建 Web 版。
> `make wasm` 当前未同步 `src/yuv/*.cpp` 与 `_yuv_convert_planes` 导出，
> 产物缺少 YUV WASM 转换能力（CI 已改用 build.sh）。
> Use `./build.sh` for the web build; the `make wasm` target is currently
> out of sync (missing `src/yuv/*.cpp` and `_yuv_convert_planes`).

### 原生命令行 / Native CLI

```bash
# 构建 / Build
make native

# 使用 / Usage（支持 H.264/H.265/H.266 裸流；容器/图像/YUV 请用 Web 版）
./hevcparser_native <input_file> [codec|nal_index] [nal_index]

# 示例 / Examples
./hevcparser_native video.hevc              # 自动检测编解码 / Auto-detect codec
./hevcparser_native video.h264 avc          # 指定为 AVC / Force AVC
./hevcparser_native video.266 vvc 5          # 解析 VVC 并查看 NAL #5 / Parse VVC, view NAL #5
```

---

## Raw YUV 支持 / Raw YUV Support

Raw YUV 文件没有头信息，尺寸/格式/帧率无法从文件读取。本工具按文件大小自动猜测，并允许手动修改（详见 [设计文档](docs/superpowers/specs/2026-09-17-yuv-parser-design.md)）：

- **8 种 8-bit 像素排列**：I420 (YUV420p), YV12, NV12, NV21, YUV422p, YUYV (YUY2), UYVY, YUV444p
- **自动猜测**：仅接受文件大小恰好等于单帧大小的候选（单帧模式）；NV12 优先排序
- **YUV 设置栏**：Width / Height / Format / FPS / 色彩矩阵 (BT.601 / BT.709)，Apply 后重新解析
- **色彩转换**：BT.601 / BT.709，full / limited range；SD 分辨率默认 BT.601，高度 ≥720 默认 BT.709
- **性能**：预览降采样转换（8K 预览约 10-20ms），全分辨率转换仅在放大镜打开时执行；WASM 转换模块 (`yuv_convert_planes`) 优先，JS 兜底
- **上限**：最大分辨率 7680×4320 (8K)
- **导出**：放大镜中可保存无损 PNG

Raw YUV files carry no header. Dimensions/format are guessed from file size
(exact single-frame matches only) and can be overridden in the YUV Settings bar
(Width/Height/Format/FPS/Color Matrix). 8 pixel arrangements are supported
(I420/YV12/NV12/NV21/YUV422p/YUYV/UYVY/YUV444p), with BT.601/BT.709 full/limited
range preview, an 8K resolution cap, downscale-first preview, and lossless PNG
export from the frame lightbox.

---

## 目录结构 / Project Structure

```
BrowserCodecAnalyzer/
├── src/
│   ├── common/           # 通用工具 / Common utilities (BitstreamReader, ConvToString)
│   ├── hevcparser/       # HEVC/H.265 解析器 / HEVC parser
│   ├── h264parser/       # H.264/AVC 解析器 / AVC parser
│   ├── vvcparser/        # VVC/H.266 解析器 / VVC parser
│   ├── yuv/              # YUV→RGBA WASM 转换核心 / YUV→RGBA WASM conversion core
│   ├── web/              # Web 绑定 & 分析器 / Web bindings & analyzers
│   │   ├── CodecDetector.cpp      # 码流类型自动检测 / Auto codec detection
│   │   ├── ProfileConformanceAnalyzer.cpp  # Profile 合规性分析
│   │   ├── WebParser.cpp          # HEVC Web 解析器
│   │   ├── AvcWebParser.cpp       # AVC Web 解析器
│   │   ├── VvcWebParser.cpp       # VVC Web 解析器
│   │   ├── *SyntaxWriter.cpp     # 语法树 JSON 序列化 / Syntax tree JSON writers
│   │   ├── Json.cpp               # JSON 写出工具 / JSON writer
│   │   └── webapi.cpp             # C API 导出 (hevc_parse, avc_parse, vvc_parse, yuv_convert_planes...)
│   └── native_main.cpp   # 原生 CLI 入口 / Native CLI entry
├── www/                  # Web 前端 / Web frontend
│   ├── index.html        # 主页面 / Main page
│   ├── css/style.css     # 样式 / Styles
│   ├── js/               # 前端逻辑 / Frontend logic
│   │   ├── app.js        # 主应用 / Main app (UI, timeline, preview, tabs)
│   │   ├── demux.js      # 容器解复用 (MP4/fMP4/WebM/IVF/TS/AVIF/HEIC)
│   │   ├── yuv.js        # YUV 格式表/猜测/转换 (JS 路径) / YUV guess & convert
│   │   ├── plugin.js     # SEI 插件系统 / SEI plugin system
│   │   ├── jpeg.js       # JPEG/EXIF 解析 / JPEG/EXIF parsing
│   │   ├── vvdecapp.js   # vvdec WASM 解码器 (VVC)
│   │   └── dav1dapp.js   # dav1d WASM 解码器 (AV1)
│   └── plugins/          # 插件示例 / Plugin examples
│       └── example-sei.js
├── docs/
│   └── superpowers/specs/2026-09-17-yuv-parser-design.md  # YUV 设计文档
├── build.sh              # Web 构建脚本（标准入口）/ Web build script (canonical)
├── Makefile              # 原生构建 / Native build（wasm 目标已过期）
├── .github/workflows/deploy.yml  # GitHub Pages CI
├── .gitlab-ci.yml        # GitLab Pages CI
├── USAGE_en.md           # 英文技术文档 / English technical documentation
├── USAGE_zh.md           # 中文技术文档 / Chinese technical documentation
└── LICENSE               # GPL v2
```

---

## 支持的格式 / Supported Formats

| 类别 | 扩展名 / Extensions | 备注 / Notes |
|------|-------------------|-------------|
| **裸流** | `.h264`, `.h265`, `.h266`, `.264`, `.265`, `.266`, `.avc`, `.hevc`, `.vvc`, `.bin`, `.bit` | 自动检测 NAL/OBU |
| **容器** | `.mp4`, `.m4v`, `.mov`, `.webm`, `.ivf`, `.ts`, `.m2ts`, `.mts` | MP4/MOV (含 fMP4)/WebM/IVF/MPEG-TS |
| **图像** | `.heic`, `.heif`, `.avif`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp` | HEIC/AVIF 需 WASM 解码器 |
| **Raw YUV** | `.yuv` | 8-bit；自动猜测仅接受单帧整除匹配 |
| **其他** | `.av1`, `.obu` | AV1 OBU 流 / AV1 OBU stream |

---

## 编解码器支持矩阵 / Codec Support Matrix

| 编解码器/格式 | 解析 | 语法树 | 合规性检查 | 视频预览 | 备注 |
|---------|------|--------|-----------|---------|------|
| **H.264/AVC** | ✅ | ✅ | ✅ | ✅ (WebCodecs) | Baseline/Main/High/High10/High422 |
| **H.265/HEVC** | ✅ | ✅ | ✅ | ✅ (WebCodecs) | Main/Main10/Main Still Picture |
| **H.266/VVC** | ✅ | ✅ | ⚠️ 基础 | ✅ (vvdec WASM) | VVC 部分特性 |
| **AV1** | ⚠️ 容器级 | ⚠️ 有限 | ❌ | ✅ (dav1d WASM) | 通过容器/OBU 解析 |
| **VP9** | ⚠️ 容器级 | ⚠️ 有限 | ❌ | ✅ (WebCodecs) | 通过容器解复用获取 |
| **Raw YUV** | ✅ (帧/平面) | ✅ (格式信息) | ❌ | ✅ (WASM/JS 转换) | 8 种 8-bit 排列，单帧模式 |

---

## 界面操作 / UI Interactions

| 操作 / Action | 功能 / Function |
|---------------|-----------------|
| **点击 NAL 行** | 右侧显示该 NAL 语法树 + Hex 字节 / Show syntax tree & hex for that NAL |
| **点击时间线帧** | 选中帧并预览解码画面 / Select frame & preview |
| **时间线 +/- 按钮** | 缩放 / Zoom in / out |
| **时间线 \|◀ / ▶\| 按钮** | 逐帧步进 / Step frame |
| **Preview 面板按钮** | ▶ Play 播放 / \|◀ Prev / ▶\| Next / Decode Order↔Display Order 切换 |
| **点击预览画布** | 打开全分辨率放大镜（Fit/100%，Save PNG）/ Open full-res lightbox |
| **拖拽分割条** | 调整面板大小 / Resize panels |
| **拖拽文件到页面** | 加载并解析 / Load & parse file |

> 本工具无键盘快捷键，全部通过上述按钮/点击操作。
> There are no keyboard shortcuts; all interactions are via the buttons and clicks above.

---

## 开发指南 / Development

### 架构概览 / Architecture

```
输入数据 (文件/拖拽)                        Input (file / drag-drop)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ 前端路由 handleFile (www/js/app.js)                           │
│  .yuv → YuvParser (纯 JS 猜测+转换, WASM 转换优先)             │
│  JPEG/PNG/GIF/WebP/BMP → 浏览器/JS 解析                       │
│  AVIF/HEIC → demux.js 提取 (libheif/dav1d WASM 解码显示)      │
│  MP4/MOV/TS/WebM/IVF → demux.js 解复用 → 裸流/帧数据           │
└──────────────────────────────┬───────────────────────────────┘
                               │ 裸流 Annex-B
                               ▼
┌──────────────────┐
│  CodecDetector   │  ──► 自动识别: avc / hevc / vvc / unknown
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  对应 Parser      │  ──► HEVC::Parser / AVC::Parser / VVC::Parser
│  (Consumer 模式)  │       采用观察者模式分发 NAL 单元
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  WebParser 系列   │  ──► 序列化为 JSON: summary + 每个 NAL 的语法树
└────────┬─────────┘
         │
         ▼
    WebAssembly (emscripten, webapi.cpp)
         │
         ▼
     前端 app.js 渲染（NAL 表 / 时间线 / 语法树 / Hex / SEI / 码率 / 预览）
```

### 添加新解析器 / Adding a New Parser

1. 在 `src/` 下创建 `newcodecparser/` 目录，参考 `hevcparser/` 结构
2. 实现 `Parser` 接口 (`create`, `release`, `process`, `addConsumer`, `releaseConsumer`)
3. 在 `src/web/` 实现对应的 `NewCodecWebParser` 消费者和 `NewCodecSyntaxWriter`，序列化为 JSON
4. 在 `webapi.cpp` 导出 C API: `newcodec_parse`, `newcodec_get_nal_syntax`, `newcodec_reset`
5. 更新 `build.sh` 添加新源文件与导出函数（`Makefile` 的 `native`/`wasm` 目标同步更新）
6. 在 `CodecDetector.cpp` 添加检测逻辑
7. 前端 `app.js` 添加对应处理逻辑

### SEI 插件开发 / SEI Plugin Development

插件为普通 `.js` 脚本（非 ES module），通过页面右上角 **⚙ Plugin** 按钮加载。加载后调用全局 `BrowserCodecAnalyzer.registerPlugin(...)`，解析匹配 payloadType 的 SEI 消息，结果追加到该 NAL 的语法树中。完整示例见 [`www/plugins/example-sei.js`](www/plugins/example-sei.js)。

Plugins are plain `.js` scripts loaded via the **⚙ Plugin** toolbar button. They call the global `BrowserCodecAnalyzer.registerPlugin(...)`; parsed fields are appended to the syntax tree of matching SEI NALs. See [`www/plugins/example-sei.js`](www/plugins/example-sei.js) for a complete example.

```javascript
BrowserCodecAnalyzer.registerPlugin({
  name: "My SEI (payloadType 137)",  // 显示名 / display name
  codec: "hevc",                     // 可选: "hevc" / "avc"，缺省匹配所有 / optional, matches all if omitted
  payloadType: 137,                  // 或 payloadTypes: [137, 138]  / or a list
  parse: function (ctx, meta) {
    // ctx: 位读取器 BitReader
    //   ctx.readBits(n) / ctx.readU(n)  — 读 n 位 / read n bits
    //   ctx.readUe() / ctx.readSe()    — Exp-Golomb
    //   ctx.bitsLeft                   — 剩余位数 / bits remaining
    // meta: { codec, payloadType, payloadSize }
    var value = ctx.readBits(16);
    return {
      name: "My SEI Group",          // 可选组名 / optional group name
      children: [
        { name: "field1", value: value },
        { name: "sub", children: [ /* ... */ ] }
      ]
    };
  }
});
```

---

## CI / 部署 / CI & Deployment

| 平台 | 配置 | 说明 |
|------|------|------|
| **GitHub Pages** | `.github/workflows/deploy.yml` | push 到 `main`/`master` 自动构建部署 |
| **GitLab Pages** | `.gitlab-ci.yml` | push 到 `main`/`master` 或手动触发，页面位于 `https://<user>.gitlab.io/<project>` |

两者都执行 `./build.sh` 产出 `dist/` 后部署。

Both pipelines run `./build.sh` and deploy the resulting `dist/` directory.

---

## 文档 / Documentation

- [USAGE_zh.md](USAGE_zh.md) — 中文技术文档（构建、界面、CLI、架构、API、排障）
- [USAGE_en.md](USAGE_en.md) — English technical documentation
- [docs/superpowers/specs/2026-09-17-yuv-parser-design.md](docs/superpowers/specs/2026-09-17-yuv-parser-design.md) — YUV 支持设计文档 / YUV support design doc

---

## 许可证 / License

本项目采用 **GNU General Public License v2.0** 许可。详见 [LICENSE](LICENSE)。

This project is licensed under the **GNU General Public License v2.0**. See [LICENSE](LICENSE) for details.

---

## 致谢 / Acknowledgments

- [Emscripten](https://emscripten.org/) — C++ 到 WebAssembly 编译工具链
- [vvdec](https://github.com/fraunhoferhhi/vvdec) — VVC 解码器 (WASM 移植)
- [dav1d](https://code.videolan.org/videolan/dav1d/) — AV1 解码器 (WASM 移植)
- [libheif](https://github.com/strukturag/libheif) — HEIF/HEIC 解码器 (WASM 移植)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) — 浏览器原生视频解码

---
