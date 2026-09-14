# BrowserCodecAnalyzer / BrowserCodecAnalyzer

**H.264 / H.265 / H.266 / AV1 / VP9 码流分析器 · Bitstream Analyzer**

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()
[![WebAssembly](https://img.shields.io/badge/WASM-supported-654FF0)]()

---

## 简介 / Overview

**中文：**  
BrowserCodecAnalyzer (BrowserCodecAnalyzer) 是一款面向视频编解码工程师的**码流分析工具**，支持 H.264/AVC、H.265/HEVC、H.266/VVC、AV1、VP9 等主流视频编码标准。它提供原生命令行工具与 Web 界面两种形态，可解析裸流、容器封装（MP4/MOV/WebM/IVF）及图像格式（HEIC/AVIF/JPEG/PNG/WebP 等），并给出 NAL/OBU 单元列表、语法树、帧结构时间线、合规性告警、HDR/色彩信息等完整分析视图。

**English:**  
BrowserCodecAnalyzer (BrowserCodecAnalyzer) is a **bitstream analyzer** for video codec engineers, supporting H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9 and other mainstream video coding standards. It provides both a native CLI tool and a Web UI, capable of parsing raw bitstreams, container formats (MP4/MOV/WebM/IVF), and image formats (HEIC/AVIF/JPEG/PNG/WebP, etc.), delivering complete analysis views including NAL/OBU unit lists, syntax trees, frame structure timelines, conformance warnings, and HDR/color information.

---

## 功能特性 / Features

| 功能 | Feature | 说明 / Description |
|------|---------|-------------------|
| **多编解码支持** | Multi-codec Support | H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9 |
| **容器解复用** | Container Demux | MP4, M4V, MOV, WebM, IVF (自动检测 / auto-detect) |
| **图像格式** | Image Formats | HEIC/HEIF, AVIF, JPEG (EXIF), PNG, GIF, WebP, BMP |
| **裸流解析** | Raw Bitstream | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit |
| **NAL/OBU 列表** | NAL/OBU List | 偏移、长度、类型、帧号、关键信息 / Offset, length, type, frame, info |
| **语法树** | Syntax Tree | 完整语法元素树，支持展开/折叠 / Full syntax element tree |
| **十六进制视图** | Hex View | 原始字节十六进制 / Raw bytes in hex |
| **帧结构时间线** | Frame Timeline | I/P/B 帧着色，可点击预览 / I/P/B colored, clickable preview |
| **视频预览** | Video Preview | WebCodecs (H.264/H.265/VP9) + vvdec WASM (H.266) + dav1d WASM (AV1) |
| **合规性告警** | Conformance Warns | 越界、参考结构缺失、Profile 一致性 / Out-of-range, missing ref, profile |
| **HDR/色彩信息** | HDR/Color Info | Mastering display, CLL, 色度格式 / Mastering, CLL, chroma format |
| **MediaInfo 元数据** | MediaInfo Tab | 容器级元数据：格式、时长、码率、轨道 / Container metadata |
| **SEI 插件系统** | SEI Plugin System | 支持加载自定义 .js 插件解析 SEI / Load custom .js plugins for SEI |
| **分栏可调** | Resizable Panels | 拖拽分割条调整布局 / Drag splitters to resize |
| **键盘快捷键** | Keyboard Shortcuts | ←/→ 逐帧，+/- 缩放，空格播放 / Frame step, zoom, play |

---

## 快速开始 / Quick Start

### Web 版 (WASM) / Web Version (WASM)

```bash
# 1. 安装 Emscripten / Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# 2. 构建 / Build
cd BrowserCodecAnalyzer
./build.sh

# 3. 本地预览 / Local preview
python3 -m http.server -d dist 8000
# 打开 http://localhost:8000
```

或直接使用 `make wasm`。

### 原生命令行 / Native CLI

```bash
# 构建 / Build
make native

# 使用 / Usage
./hevcparser_native <input_file> [codec|nal_index] [nal_index]

# 示例 / Examples
./hevcparser_native video.hevc              # 自动检测编解码 / Auto-detect codec
./hevcparser_native video.h264 avc          # 指定为 AVC / Force AVC
./hevcparser_native video.266 vvc 5         # 解析 VVC 并查看 NAL #5 / Parse VVC, view NAL #5
```

---

## 目录结构 / Project Structure

```
BrowserCodecAnalyzer/
├── src/
│   ├── common/           # 通用工具 / Common utilities (BitstreamReader, ConvToString)
│   ├── hevcparser/       # HEVC/H.265 解析器 / HEVC parser
│   ├── h264parser/       # H.264/AVC 解析器 / AVC parser
│   ├── vvcparser/        # VVC/H.266 解析器 / VVC parser
│   ├── web/              # Web 绑定 & 分析器 / Web bindings & analyzers
│   │   ├── CodecDetector.cpp      # 码流类型自动检测 / Auto codec detection
│   │   ├── ProfileConformanceAnalyzer.cpp  # Profile 合规性分析
│   │   ├── WebParser.cpp          # 通用 Web 解析器基类
│   │   ├── AvcWebParser.cpp       # AVC Web 解析器
│   │   ├── VvcWebParser.cpp       # VVC Web 解析器
│   │   └── webapi.cpp             # C API 导出 (hevc_parse, avc_parse, vvc_parse...)
│   └── native_main.cpp   # 原生 CLI 入口 / Native CLI entry
├── www/                  # Web 前端 / Web frontend
│   ├── index.html        # 主页面 / Main page
│   ├── css/style.css     # 样式 / Styles
│   └── js/               # 前端逻辑 / Frontend logic
│       ├── app.js        # 主应用 / Main app
│       ├── demux.js      # 容器解复用 / Container demux
│       ├── plugin.js     # SEI 插件系统 / SEI plugin system
│       ├── jpeg.js       # JPEG/EXIF 解析
│       ├── vvdecapp.js   # vvdec WASM 解码器 (VVC)
│       └── dav1dapp.js   # dav1d WASM 解码器 (AV1)
├── build.sh              # Web 构建脚本 / Web build script
├── Makefile              # 统一构建 / Unified build
└── LICENSE               # GPL v2
```

---

## 支持的格式 / Supported Formats

| 类别 | 扩展名 / Extensions | 备注 / Notes |
|------|-------------------|-------------|
| **裸流** | `.h264`, `.h265`, `.h266`, `.264`, `.265`, `.266`, `.avc`, `.hevc`, `.vvc`, `.bin`, `.bit` | 自动检测 NAL/OBU |
| **容器** | `.mp4`, `.m4v`, `.mov`, `.webm`, `.ivf`, `.ts`, `.m2ts`, `.mts` | MP4/MOV/WebM/IVF/TS |
| **图像** | `.heic`, `.heif`, `.avif`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp` | HEIC/AVIF 需 WASM 解码器 |
| **其他** | `.av1`, `.obu` | AV1 OBU 流 / AV1 OBU stream |

---

## 编解码器支持矩阵 / Codec Support Matrix

| 编解码器 | 解析 | 语法树 | 合规性检查 | 视频预览 | 备注 |
|---------|------|--------|-----------|---------|------|
| **H.264/AVC** | ✅ | ✅ | ✅ | ✅ (WebCodecs) | Baseline/Main/High/High10/High422 |
| **H.265/HEVC** | ✅ | ✅ | ✅ | ✅ (WebCodecs) | Main/Main10/Main Still Picture |
| **H.266/VVC** | ✅ | ✅ | ⚠️ 基础 | ✅ (vvdec WASM) | VVC 部分特性 |
| **AV1** | ⚠️ 容器级 | ⚠️ 有限 | ❌ | ✅ (dav1d WASM) | 通过容器解复用获取 |
| **VP9** | ⚠️ 容器级 | ⚠️ 有限 | ❌ | ✅ (WebCodecs) | 通过容器解复用获取 |

---

## 键盘快捷键 / Keyboard Shortcuts

| 按键 / Key | 功能 / Action |
|-----------|--------------|
| `←` / `→` | 上一帧 / 下一帧 / Prev / Next frame |
| `+` / `-` | 时间线放大 / 缩小 / Timeline zoom in / out |
| `Space` | 播放 / 暂停 / Play / Pause |
| `D` | 切换解码序/显示序 / Toggle decode/display order |
| `Click NAL` | 选中 NAL 单元 / Select NAL unit |
| `Click Timeline` | 选中帧并预览 / Select frame & preview |
| `Drag Splitter` | 调整面板大小 / Resize panels |

---

## 开发指南 / Development

### 架构概览 / Architecture

```
输入数据 (文件/拖拽)
       │
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
   WebAssembly (emscripten)
         │
         ▼
    前端 app.js 渲染
```

### 添加新解析器 / Adding a New Parser

1. 在 `src/` 下创建 `newcodecparser/` 目录，参考 `hevcparser/` 结构
2. 实现 `Parser` 接口 (`create`, `release`, `process`, `addConsumer`, `releaseConsumer`)
3. 在 `src/web/` 实现对应的 `NewCodecWebParser` 消费者，序列化为 JSON
4. 在 `webapi.cpp` 导出 C API: `newcodec_parse`, `newcodec_get_nal_syntax`, `newcodec_reset`
5. 更新 `Makefile` 和 `build.sh` 添加新源文件
6. 在 `CodecDetector.cpp` 添加检测逻辑
7. 前端 `app.js` 添加对应处理逻辑

### SEI 插件开发 / SEI Plugin Development

参考 `www/plugins/example-sei.js`：

```javascript
// 插件需导出 registerSEIPlugin 函数
export function registerSEIPlugin(registry) {
  registry.register({
    uuid: 'your-sei-uuid-hex-string',
    name: 'Your SEI Name',
    parse: (payload, offset, size) => {
      // 返回解析后的对象，会显示在语法树中
      return { customField: 'value' };
    }
  });
}
```

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
