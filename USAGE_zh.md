# BrowserCodecAnalyzer / BrowserCodecAnalyzer 技术使用文档

## 目录

1. [项目概述](#项目概述)
2. [环境要求](#环境要求)
3. [构建与部署](#构建与部署)
4. [Web 界面使用指南](#web-界面使用指南)
5. [命令行工具使用指南](#命令行工具使用指南)
6. [核心架构与数据流](#核心架构与数据流)
7. [API 参考](#api-参考)
8. [扩展开发指南](#扩展开发指南)
9. [常见问题与排查](#常见问题与排查)
10. [性能优化建议](#性能优化建议)

---

## 项目概述

BrowserCodecAnalyzer (项目代号 BrowserCodecAnalyzer) 是一款专为视频编解码工程师设计的**码流分析工具**。它能够解析主流视频编码标准的裸流、容器封装格式及图像文件，提供直观的可视化分析界面。

### 核心能力

| 能力维度 | 支持范围 |
|---------|---------|
| **视频编码标准** | H.264/AVC, H.265/HEVC, H.266/VVC, AV1, VP9 |
| **容器格式** | MP4/M4V/MOV (含 fMP4), WebM, IVF, MPEG-TS |
| **图像格式** | HEIC/HEIF, AVIF, JPEG, PNG, GIF, WebP, BMP |
| **裸流格式** | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit, .obu |
| **Raw YUV** | 8-bit：I420, YV12, NV12, NV21, YUV422p, YUYV, UYVY, YUV444p (仅 Web 界面) |
| **输出形态** | Web 界面 (WASM), 原生 CLI (C++) |

### 适用场景

- 视频编解码器开发调试：验证编码器输出语法正确性
- 码流合规性分析：Profile/Level 一致性检查、参考结构完整性验证
- HDR/色彩元数据提取：Mastering Display、CLL、色度格式等
- 教学演示：可视化展示 NAL/OBU 结构、帧类型分布、语法元素层级
- 逆向工程：分析未知码流的编码参数、SEI 消息、扩展数据

---

## 环境要求

### Web 版本 (WASM) 构建环境

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| **Emscripten (emcc)** | 3.1.50+ | 推荐通过 emsdk 安装最新版 |
| **Python 3** | 3.8+ | 用于本地 HTTP 服务预览 |
| **Node.js** | 16+ | 可选，用于前端开发调试 |
| **操作系统** | Linux/macOS/Windows(WSL2) | Windows 原生需额外配置 |

#### Emscripten 安装

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# 验证安装
emcc --version
```

> **提示**：将 `source ./emsdk_env.sh` 添加到 `~/.bashrc` 或 `~/.zshrc` 以持久化环境变量。

### 原生版本构建环境

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| **C++ 编译器** | clang++ 10+ / g++ 9+ | 支持 C++11 |
| **CMake** | 3.16+ | 可选，当前使用 Makefile |
| **标准库** | libc++ / libstdc++ | C++11 标准库 |

---

## 构建与部署

### 方式一：Web 版本 (推荐)

```bash
# 1. 进入项目目录
cd /path/to/BrowserCodecAnalyzer

# 2. 执行构建脚本 (自动检测 emcc)
./build.sh

# 3. 构建产物位于 dist/ 目录
ls dist/
# hevc.js          # WASM 模块 + JS 胶水代码
# hevc.wasm        # WebAssembly 二进制
# index.html       # 主页面
# css/style.css    # 样式
# js/              # 前端 JS 模块

# 4. 启动本地服务预览
python3 -m http.server -d dist 8000
# 浏览器访问 http://localhost:8000
```

#### 构建脚本参数说明

`build.sh` 核心编译参数：

```bash
em++ [源文件...] \
  -I[包含路径...] \
  -std=c++11 -O2 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_hevc_parse","_hevc_get_nal_syntax",...]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString",...]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createHevcModule \
  -o dist/hevc.js
```

| 参数 | 说明 |
|------|------|
| `-s WASM=1` | 生成 WebAssembly |
| `-s ALLOW_MEMORY_GROWTH=1` | 允许内存动态增长，防止大文件 OOM |
| `-s MODULARIZE=1` | 生成模块工厂（全局 `createHevcModule`，也可作为 ES 模块 import） |
| `-s EXPORT_NAME=createHevcModule` | 导出的模块工厂函数名 |
| `EXPORTED_FUNCTIONS` | 导出的 C 函数供 JS 调用 |

### 方式二：原生 CLI 版本

```bash
# 使用 Makefile 构建
make native

# 产物：hevcparser_native (可执行文件)
./hevcparser_native --help
# Usage: hevcparser_native <input> [nal_index]
```

#### Makefile 目标

| 目标 | 说明 |
|------|------|
| `make` / `make all` | 默认构建 native |
| `make native` | 构建原生可执行文件 `hevcparser_native` |
| `make wasm` | 构建 Web 版本（源文件、include 路径与 emcc 参数与 `./build.sh` 一致） |
| `make clean` | 清理所有构建产物 |

### 方式三：CI / Pages 自动部署

仓库自带两条开箱即用的部署流水线，均执行 `./build.sh` 并发布 `dist/`：

| 平台 | 配置 | 触发方式 |
|------|------|---------|
| **GitHub Pages** | `.github/workflows/deploy.yml` | push 到 `main`/`master`，或手动触发 |
| **GitLab Pages** | `.gitlab-ci.yml` | push 到 `main`/`master` 或手动流水线（页面地址 `https://<user>.gitlab.io/<project>`） |

---

## Web 界面使用指南

### 界面布局概览

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: Logo | Codec Badge | Reset | File Input | Help/Plugin │
├─────────────────────────────────────────────────────────────┤
│ Dropzone (拖拽上传区域)                                       │
├─────────────────────────────────────────────────────────────┤
│ Stats Bar: 码率、帧率、分辨率、Profile 等统计信息              │
├─────────────────────────────────────────────────────────────┤
│ YUV Settings Bar (仅 .yuv 文件显示)                           │
├─────────────────────────────────────────────────────────────┤
│ Timeline Panel: 帧结构时间轴 (I=红, P=蓝, B=绿)               │
├──────────────────┬──────────────────────────────────────────┤
│ NAL Unit List    │ Syntax / Preview / Hex / SEI / MediaInfo / Bitrate │
│ (左侧面板)        │ (右侧面板，标签页切换)                      │
├──────────────────┴──────────────────────────────────────────┤
│ Bottom Panels: HDR/Color Info | Warnings Table             │
├─────────────────────────────────────────────────────────────┤
│ Status Bar: 状态信息                                          │
└─────────────────────────────────────────────────────────────┘
```

### 文件加载方式

1. **点击 "Open File" 按钮** → 系统文件选择器
2. **拖拽文件到 Dropzone 区域** → 自动检测并解析
3. **命令行参数** (仅 CLI) → `./hevcparser_native input.hevc`

### 核心功能操作

#### 1. NAL/OBU 单元列表 (左侧面板)

| 列 | 含义 | 交互 |
|----|------|------|
| Offset | 文件偏移量 (字节) | - |
| Length | NAL 单元长度 | - |
| Type | NAL 类型名称 (VPS/SPS/PPS/IDR/非IDR/SEI等) | 颜色编码区分 |
| Frame | 所属帧号 (POC) | - |
| Info | 关键语法元素摘要 | 悬浮显示完整信息 |

**操作**：
- 点击任意行 → 右侧显示该 NAL 的完整语法树和 Hex 字节
- 滚动列表 → 自动加载可见区域行 (虚拟滚动，支持百万级 NAL)

#### 2. 语法树标签页 (Syntax)

- **树状结构**：按语法层级展示所有语法元素
- **展开/折叠**：点击 ▶/▼ 图标

**语法元素字段说明**：
```
名称: 值 [描述/约束]
  例：pic_width_in_luma_samples: 1920 [符合 Main 10 Profile]
```

#### 3. 预览标签页 (Preview)

- **视频解码预览**：点击时间轴帧 → 解码并显示该帧
- **播放控制**：▶ 播放、|◀ 上一帧、▶| 下一帧
- **序列切换**："Decode Order" ↔ "Display Order"
- **帧放大镜**：点击预览画布 → 全分辨率弹窗，支持 **Fit / 100%** 两种缩放与 **Save PNG** 无损导出当前帧（所有编解码器及 Raw YUV 均支持）
- **支持的解码器**：
  - H.264/H.265/VP9 → 浏览器原生 WebCodecs
  - H.266/VVC → vvdec WASM (需额外加载)
  - AV1 → dav1d WASM (需额外加载)
  - HEIC → libheif WASM；AVIF → dav1d WASM；JPEG/PNG/GIF/WebP/BMP → 浏览器原生

#### 4. 十六进制视图标签页 (Hex)

- **原始字节查看**：NAL 单元的十六进制 + ASCII
- **地址栏**：显示文件绝对偏移
- **截断上限**：每个 NAL 最多显示前 4KB（YUV 帧可达数十 MB，截断时显示提示）

#### 5. SEI 标签页

全流 SEI 消息汇总表（每条 SEI 消息一行）：

| 列 | 含义 |
|----|------|
| NAL # | 携带该消息的 NAL 单元编号 |
| Offset | 该 NAL 单元的文件偏移 |
| Payload Type | 类型名称（如 decoded picture hash）+ 数字 payloadType |
| Size | Payload 字节数 |
| Text / Content | 可打印内容以文本显示，非文本显示 `(binary)` |
| Frame TS | 从 H.264 定制 `"frame ts"` SEI 提取的帧时间戳（存在时） |

- 点击行 → 选中对应 NAL 单元（并显示其语法树）
- 自定义 SEI payload 可通过 SEI 插件系统解析（见下文）

#### 6. MediaInfo 标签页

容器级元数据 (MP4/MOV/WebM/IVF)：
- 格式、主品牌、兼容品牌
- 时长、总码率
- 轨道信息：类型、编解码器、分辨率、帧率、语言

Raw YUV 文件在该页显示 YUV 信息：像素排列、分辨率、帧率、帧数、帧大小、
文件大小、时长 (frames/fps)，以及预留的 "Additional Metadata (SEI-like)"
占位区（为将来接入传感器/GPS/IMU 数据源）。

#### 7. 码率统计标签页 (Bitrate)

- **帧级码率图表**：每帧瞬时码率柱状图，按帧类型着色 (I=红, P=蓝, B=绿)
- **统计指标**：帧数、FPS、总大小、平均/峰值/最小码率（含帧号）、I/P/B 数量
- **交互**：`+`/`−` 按钮缩放图表；悬浮显示单帧详情；当前选中帧高亮

#### 8. 时间轴面板

- **颜色编码**：I帧=红、P帧=蓝、B帧=绿、IDR=深红
- **缩放**：面板上的 `+` / `−` 按钮
- **逐帧步进**：面板上的 `|◀` / `▶|` 按钮
- **点击帧**：选中并在预览区显示解码帧
- **悬浮提示**：显示帧详情（类型、QP、大小；YUV 显示帧号与合成时间戳）
- **进度指示**：播放时显示当前播放位置高亮
- **长视频**：缩放自动适配；最小可点击帧宽限制保证长流仍可导航

#### 9. HDR/色彩信息面板 (底部左)

| 项目 | 来源 | 示例 |
|------|------|------|
| 色度格式 | SPS/VPS chroma_format_idc | 4:2:0 / 4:2:2 / 4:4:4 |
| 位深 | bit_depth_luma/chroma | 8 / 10 / 12 |
| Mastering Display | SEI mastering_display_colour_volume | G(13250,34500) B(7500,3000) R(34000,16000) WP(15635,16450) |
| MaxCLL / MaxFALL | SEI content_light_level_info | MaxCLL=4000, MaxFALL=2000 |
| 传输特性 | VUI transfer_characteristics | PQ (SMPTE ST 2084) / HLG / BT.709 |
| 色度坐标 | VUI colour_primaries | BT.2020 / BT.709 / P3-D65 |

#### 10. 告警面板 (底部右)

| 等级 | 类型 | 说明 |
|------|------|------|
| 🔴 Error | Out of range | 语法元素值超出标准定义范围 |
| 🟡 Warning | Missing ref structure | 参考图像列表、DPB 状态不一致 |
| 🔵 Info | Profile conformance | 违反 Profile 约束 (如 Main 10 使用 8-bit) |

**筛选器**：下拉框选择告警类型 (-1=全部, 1=越界, 2=参考结构, 3=Profile)

### 界面操作参考

所有操作均通过鼠标完成——本工具**没有键盘快捷键**。

| 操作 | 位置 | 功能 |
|------|------|------|
| `+` / `−` 按钮 | 时间轴 / 码率面板 | 放大 / 缩小 |
| `\|◀` / `▶\|` 按钮 | 时间轴面板 | 上一帧 / 下一帧 |
| ▶ Play / \|◀ Prev / ▶\| Next | 预览标签页 | 播放与逐帧步进 |
| "Decode Order" 切换 | 预览标签页 | 解码序 ↔ 显示序切换 |
| 点击预览画布 | 预览标签页 | 打开全分辨率放大镜 (Fit/100%，Save PNG) |
| 点击 NAL 行 | NAL 列表 | 显示该 NAL 的语法树 + Hex |
| 点击帧条 | 时间轴 | 选中并预览该帧 |
| 拖拽分割条 | 面板之间 | 调整栏宽 / 行高 |

### Raw YUV 文件 (.yuv)

Raw YUV 没有头信息——尺寸、格式、帧率依据文件大小猜测，用户可手动修改。
YUV 支持**仅限 Web 界面**（CLI 只解析 H.264/HEVC/VVC 裸流）。

- **自动猜测**：仅接受文件大小恰好等于单帧大小的候选
  (`fileSize === frameSize`)；排序 NV12 优先（相机/ADAS 惯例），其次
  I420、packed YUYV/UYVY。无匹配候选时打开设置面板等待手动输入。
- **YUV 设置栏**（统计栏下方，仅 YUV 文件显示）：
  Width / Height 数字输入、Format 下拉（8 种排列：I420、YV12、NV12、
  NV21、YUV422p、YUYV、UYVY、YUV444p）、FPS（默认 30）、色彩矩阵
  (BT.601 / BT.709)、Apply 按钮 → 重新解析并刷新所有视图。
- **单帧模式**：`.yuv` 文件按单帧处理；Play 对 YUV 无效果。
  最大分辨率 7680×4320 (8K)，Apply 时校验。
- **色彩转换**：默认按分辨率自动选矩阵（SD → BT.601，高度 ≥720 →
  BT.709），可手动切换；默认 full range。色度双线性上采样与参考
  Python 工具 (cv2 INTER_LINEAR) 对齐；转换优先走 `yuv_convert_planes`
  WASM 导出，JS (`YuvParser.yuvToRGBA`) 兜底。
- **性能**：预览采用降采样优先转换（8K 预览约 10-20ms）；全分辨率转换
  延迟到放大镜打开时一次性执行（无损 PNG 导出需要）。
- **显示**：统计栏显示分辨率/格式/帧数/FPS；MediaInfo 显示 YUV 信息；
  时间轴每帧一条；帧详情显示帧号与合成时间戳 (frameIdx/fps)，文件
  mtime 作为采集时间。

设计详见 [`docs/superpowers/specs/2026-09-17-yuv-parser-design.md`](docs/superpowers/specs/2026-09-17-yuv-parser-design.md)

### SEI 插件系统

#### 插件加载

1. 点击工具栏 "⚙ Plugin" 按钮
2. 选择 `.js` 插件文件（普通脚本，非 ES module）
3. 插件调用全局 `BrowserCodecAnalyzer.registerPlugin(...)` 自行注册；成功后状态栏显示注册的 SEI 解析器数量
4. 在 NAL 列表点击 SEI NAL — 插件解析出的字段追加显示在语法树中

#### 插件开发规范

插件为普通 `.js` 文件，调用 `BrowserCodecAnalyzer.registerPlugin(...)`。
按 **SEI payloadType** 匹配（而非 UUID）。完整可运行示例：
[`www/plugins/example-sei.js`](www/plugins/example-sei.js)。

```javascript
// my-sei-plugin.js
BrowserCodecAnalyzer.registerPlugin({
  // 显示名称
  name: "Custom SEI (payloadType 137)",

  // 可选编解码器过滤: "hevc" / "avc"；缺省匹配所有
  codec: "hevc",

  // payloadType: 单个数字，或 payloadTypes: [137, 138]
  payloadType: 137,

  // 解析函数: ctx 为位读取器 BitReader，meta 携带 payload 信息。
  // 返回树节点，渲染进语法树。
  parse: function (ctx, meta) {
    // ctx.readBits(n) / ctx.readU(n)   — 读 n 位
    // ctx.readUe() / ctx.readSe()      — 无符号 / 有符号 Exp-Golomb
    // ctx.bitsLeft                     — 剩余位数
    // meta: { codec, payloadType, payloadSize }
    var value = ctx.readBits(16);
    return {
      name: "My SEI Group",       // 可选组名
      children: [
        { name: "field1", value: value },
        { name: "sub", children: [ /* 嵌套组 */ ] }
      ]
    };
  }
});
```

**插件注册表 API**（全局对象 `window.BrowserCodecAnalyzer`）：

| 函数 | 说明 |
|------|------|
| `registerPlugin(plugin)` | 注册插件；缺少 `parse` 或 `payloadType(s)` 时返回 `false`（并在控制台告警） |
| `getPlugins()` | 列出已注册插件 |
| `clearPlugins()` | 清空所有插件 |
| `runSeiPlugin(fileBytes, nal, codec)` | 内部接口：对 SEI NAL 运行第一个匹配的插件 |

说明：
- 每个 NAL 单元内仅第一条 SEI 消息会传给插件。
- 插件在页面上下文中执行，文件在加载时求值一次。

---

## 命令行工具使用指南

> 范围说明：CLI 仅解析 **H.264/HEVC/VVC 裸流**。容器
> (MP4/WebM/IVF/TS)、图像 (HEIC/AVIF/JPEG/...) 与 Raw YUV 仅支持 Web 界面。

### 基本语法

```bash
./hevcparser_native <input_file> [codec|nal_index] [nal_index]
```

### 参数说明

| 位置 | 参数 | 类型 | 说明 |
|------|------|------|------|
| 1 | `input_file` | string | 必需，输入文件路径 |
| 2 | `codec` | string | 可选，强制指定编解码器：`avc` \| `hevc` \| `vvc` |
| 2 | `nal_index` | integer | 可选，若第2参数非编解码器名，视为 NAL 索引 |
| 3 | `nal_index` | integer | 可选，当第2参数为编解码器名时，第3参数为 NAL 索引 |

### 使用示例

```bash
# 1. 自动检测编解码器，输出汇总信息
./hevcparser_native video.hevc

# 2. 强制按 HEVC 解析
./hevcparser_native video.bin hevc

# 3. 解析并查看第 0 个 NAL 单元语法 (自动检测)
./hevcparser_native video.h265 0

# 4. 强制 AVC 并查看第 5 个 NAL
./hevcparser_native video.h264 avc 5

# 5. 解析 VVC 码流
./hevcparser_native video.vvc vvc
```

### 输出格式

**标准输出** (stdout)：JSON 格式的汇总信息
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

**标准错误** (stderr)：解析日志、NAL 语法详情、错误信息

### 返回码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 参数错误 (缺少输入文件) |
| 2 | 文件打开失败 |
| 3 | 解析失败 (码流损坏/不支持) |

---

## 核心架构与数据流

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        输入层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  文件输入    │  │  拖拽上传    │  │  CLI 参数    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     前端路由层 (app.js handleFile)                 │
│  .yuv → YuvParser: 按文件大小猜测尺寸/格式                         │
│         (WASM yuv_convert_planes 转换优先, JS 兜底)                │
│  JPEG/PNG/GIF/WebP/BMP → 浏览器原生 / JpegParser                  │
│  AVIF/HEIC → demux.js 提取 (libheif/dav1d WASM 解码显示)          │
│  MP4/MOV  → ISOBMFF 解析  → 提取视频轨道 + 码流数据                 │
│  WebM     → Matroska 解析 → 提取视频轨道 + 码流数据                 │
│  IVF/TS   → IVF/MPEG-TS 解析 → 提取帧数据/码流                     │
└────────────────────────────┬──────────────────────────────────────┘
                             │ 原始码流字节流 (Uint8Array)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     编解码器检测层 (CodecDetector.cpp)             │
│  扫描起始码 (00 00 01 / 00 00 00 01)                             │
│  ├── AVC: nal_unit_type == 7 (SPS) + 合法 profile_idc           │
│  ├── HEVC: (nal_unit_type >> 1) & 0x3F ∈ {32,33,34} + layer_id=0│
│  └── VVC: (byte1 >> 3) & 0x1F ∈ {14,15,16}                      │
└────────────────────────────┬──────────────────────────────────────┘
                             │ 检测结果: "avc" | "hevc" | "vvc" | "unknown"
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     解析器核心层 (C++ 核心)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ HEVC::Parser │  │ AVC::Parser  │  │ VVC::Parser  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  Consumer 接口 (观察者模式)              │       │
│  │  onNALUnit(NALUnit*, Info*)                           │       │
│  │  onWarning(warning_string, Info*, WarningType)        │       │
│  └────────────────────────────┬───────────────────────────┘       │
│                               │                                   │
│         ┌─────────────────────┼─────────────────────┐             │
│         ▼                     ▼                     ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐       │
│  │ WebParser   │      │ProfileConf- │      │  (可扩展)    │       │
│  │ (序列化JSON)│      │ ormanceAnal │      │              │       │
│  └──────┬──────┘      └──────┬──────┘      └─────────────┘       │
│         │                    │                                    │
│         ▼                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              WebAssembly 导出接口 (webapi.cpp)             │    │
│  │  hevc_parse/avc_parse/vvc_parse → JSON Summary           │    │
│  │  hevc_get_nal_syntax/... → JSON NAL Syntax Tree          │    │
│  │  hevc_reset/avc_reset/vvc_reset → 释放资源                │    │
│  │  detect_codec → "avc"/"hevc"/"vvc"/"unknown"              │    │
│  │  hevc_free → 释放 C 字符串内存                             │    │
│  └────────────────────────────┬──────────────────────────────┘    │
└─────────────────────────────┼─────────────────────────────────────┘
                              │ JavaScript (全局 createHevcModule)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      前端渲染层 (app.js)                          │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌────────┐  │
│  │ NAL List   │ │ Timeline │ │ Syntax  │ │ Preview│ │ Hex    │  │
│  │ Virtual    │ │ Canvas   │ │ Tree    │ │ Canvas │ │ View   │  │
│  │ Scroll     │ │ Rendering│ │ (DOM)   │ │+放大镜 │ │(4KB上限)│ │
│  └────────────┘ └──────────┘ └─────────┘ └────────┘ └────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ SEI 标签页│ │ Bitrate  │ │ MediaInfo  │ │ YUV 设置栏        │  │
│  │ (消息表)  │ │ (码率图) │ │ / HDR/告警 │ │ (猜测+转换)       │  │
│  └──────────┘ └──────────┘ └────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 关键数据结构

#### NALUnit (HEVC/VVC/AVC 通用基类)

```cpp
// src/hevcparser/include/Hevc.h 等
class NALUnit {
public:
    uint32_t        m_nalUnitType;      // NAL 类型
    uint32_t        m_nuhLayerId;       // Layer ID (HEVC/VVC)
    uint32_t        m_nuhTemporalIdPlus1; // Temporal ID + 1
    std::size_t     m_offset;           // 文件偏移
    std::size_t     m_size;             // 单元大小
    // ... 具体载荷字段由子类定义
};
```

#### WebParser 序列化输出格式

**Summary JSON** (`serializeSummary()`)：
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

**NAL Syntax JSON** (`serializeNalSyntax(index)`)：
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

## API 参考

### C API (webapi.cpp 导出)

所有函数均标记 `HEVC_KEEPALIVE` (Emscripten 保留符号)。

#### 通用函数

```c
// 释放由 API 分配的字符串内存
void hevc_free(void *ptr);

// 检测码流类型
// 返回: "avc" | "hevc" | "vvc" | "unknown" (需 hevc_free 释放)
char *detect_codec(const uint8_t *data, size_t size);
```

#### HEVC/H.265 API

```c
// 解析 HEVC 码流，返回汇总 JSON (需 hevc_free 释放)
char *hevc_parse(const uint8_t *data, size_t size);

// 获取指定索引 NAL 单元的语法树 JSON (需 hevc_free 释放)
char *hevc_get_nal_syntax(size_t index);

// 重置解析器状态，释放内部资源
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

#### YUV 转换 API (仅 WASM)

```c
// 将独立的 Y/U/V 平面转换为 RGBA 缓冲 (malloc 分配; 用 hevc_free 释放)。
// JS 包装层先用 getFrame 提取独立的 u/v 平面，因此 format 仅决定子采样参数。
// format 为 JS YuvParser.FORMAT_ORDER 表的索引：
// 0=i420, 1=nv12, 2=yv12, 3=nv21, 4=yuv422p, 5=yuyv, 6=uyvy, 7=yuv444p
// matrix: 0=bt601, 1=bt709；fullRange: 0/1
uint8_t *yuv_convert_planes(const uint8_t *y, size_t yLen,
                            const uint8_t *u, size_t uLen,
                            const uint8_t *v, size_t vLen,
                            int width, int height, int format,
                            int matrix, int fullRange);
```

### JavaScript API (app.js 核心模块)

#### createHevcModule (WASM 模块工厂)

`www/index.html` 通过普通 `<script src="hevc.js">` 标签加载 Emscripten
胶水代码；工厂函数作为**全局变量**使用（无需打包器 / ES import）：

```javascript
// app.js 启动：实例化模块，保存解析后的实例
createHevcModule().then(function (m) {
  Module = m;   // 就绪 — 可调用 _malloc / _hevc_parse / ...
});

// 实际用法 (app.js 代码)：直接调用 _ 前缀导出，
// 用 UTF8ToString 读取 C 字符串
var ptr = Module._malloc(bytes.length);
Module.HEAPU8.set(bytes, ptr);
var outPtr = Module._hevc_parse(ptr, bytes.length);   // 或 _avc_parse / _vvc_parse
var json = Module.UTF8ToString(outPtr);
Module._hevc_free(outPtr);
Module._free(ptr);

// 编解码器检测
var codecPtr = Module._detect_codec(ptr, bytes.length);
var codec = Module.UTF8ToString(codecPtr);            // "avc" | "hevc" | "vvc" | "unknown"
Module._hevc_free(codecPtr);

// YUV 转换 (WASM 路径)
var rgbaPtr = Module._yuv_convert_planes(py, yLen, pu, uLen, pv, vLen,
                                         w, h, fmtIdx, matrix, fullRange);
```

`cwrap`/`ccall` 也已导出（见 `EXPORTED_RUNTIME_METHODS`），可替代 `_`
前缀直接调用。

#### 内存管理模式

任何调用方都必须遵守的所有权规则：

- `hevc_parse` / `avc_parse` / `vvc_parse` / `detect_codec` /
  `*_get_nal_syntax` / `yuv_convert_planes` 返回 **malloc 分配的 C 缓冲**——
  拷贝到 JS 后必须用 `hevc_free` 释放。
- 用 `_malloc` 拷入 WASM 堆的缓冲必须用 `_free` 释放
  （参考流程见 app.js 的 `parseBuffer`）。

```javascript
var ptr = Module._malloc(bytes.length);
Module.HEAPU8.set(bytes, ptr);
try {
  var outPtr = Module._hevc_parse(ptr, bytes.length);
  var summary = JSON.parse(Module.UTF8ToString(outPtr));
  Module._hevc_free(outPtr);       // 释放返回的 JSON 缓冲
  return summary;
} finally {
  Module._free(ptr);               // 释放输入拷贝
}
```

#### 前端结构 (app.js)

`app.js` 为 IIFE 组织的纯函数集合（无类）。关键函数：

```javascript
// 文件加载入口：按扩展名/魔数路由
// (.yuv / JPEG / 图像 / AVIF / HEIC / MP4 / TS / IVF / WebM / 裸流)
handleFile(file)                    // app.js:~2645

// 裸流解析：检测编解码器 → 调用 WASM hevc/avc/vvc_parse
parseBuffer(bytes, hintCodec)       // app.js:~79

// NAL 列表行点击 → 该 NAL 的语法树 + Hex
selectNal(index, scrollTo)          // app.js:~2438

// 时间轴画布渲染 (帧条、缩放、悬浮提示)
renderTimeline()

// 帧预览：WebCodecs / vvdec / dav1d / YUV 转换分支
previewFrame(sliceIndex)

// 每条 SEI 消息汇总表
renderSeiTab()                      // app.js:~2402

// 帧放大镜：全分辨率弹窗，Fit/100%，Save PNG
openFrameModal()                    // app.js:~639

// YUV 设置面板 + Apply 重新解析
showYuvSettings() / applyYuvSettings() / buildYuvData(...)  // app.js:~439-563
```

---

## 扩展开发指南

### 新增视频编解码器支持

#### 1. 创建解析器目录结构

```
src/newcodecparser/
├── include/
│   ├── NewCodec.h          # 数据结构定义
│   └── NewCodecParser.h    # Parser 接口 (参考 HevcParser.h)
└── src/
    ├── NewCodec.cpp        # 数据结构实现
    ├── NewCodecParser.cpp  # 解析逻辑实现
    └── NewCodecParserImpl.h/cpp  # 具体实现细节
```

#### 2. 实现 Parser 接口

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

#### 3. 实现 WebParser 消费者

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
    
    // 内部数据结构...
  };
}
```

#### 4. 导出 C API (webapi.cpp)

```cpp
// 在 webapi.cpp 中添加
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

#### 5. 更新构建系统

**build.sh**（Web 构建标准入口——CI 即使用它）：将新源文件加入 `em++`
源文件列表，include 路径追加 `-Isrc/newcodecparser/include` 等，并将
`_newcodec_parse`、`_newcodec_get_nal_syntax`、`_newcodec_reset` 加入
`-s EXPORTED_FUNCTIONS`。

**Makefile**：将新源文件加入 `NATIVE_SRC` 与 `wasm` 目标的源列表
（两者需与 `build.sh` 保持同步）。

#### 6. 更新 CodecDetector

```cpp
// src/web/CodecDetector.cpp
std::string detectCodec(const uint8_t* data, size_t size) {
  // ... 现有逻辑后添加
  if (isNewCodecNAL(hdr, remaining))
    return "newcodec";
}
```

#### 7. 前端集成 (app.js)

```javascript
// 在 parseBuffer / handleFile 中为新增编解码器添加分支，
// 通过 Module.cwrap 包装 WASM 导出，例如：
if (codec === 'newcodec') {
  summary = parseNewCodec(data);   // cwrap('newcodec_parse', ...) + JSON.parse
}
```

### 新增容器格式支持

在 `www/js/demux.js` 中扩展 `H26xDemux` 对象（普通函数集合，并非类），
然后在 `handleFile`（`www/js/app.js`）中路由：

```javascript
// demux.js — 魔数探测 (同步，直接操作完整 Uint8Array)
function isNewFmt(d) { /* 魔数检查 */ }
function demuxNewFmt(d) {
  // 解析容器 → 返回 { annexb, frames, ... }
  // 或 AV1/VP9 路径的 { frames, obus/units, width, height, ... }
}

// 在共享对象上导出 (见 demux.js 末尾)：
// H26xDemux.isNewFmt = isNewFmt;
// H26xDemux.demuxNewFmt = demuxNewFmt;

// app.js handleFile() — 在裸流兜底分支之前添加：
// else if (H26xDemux.isNewFmt(rawBytes)) { ... }
```

---

## 常见问题与排查

### 构建问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `emcc: command not found` | Emscripten 未激活 | 运行 `source ./emsdk_env.sh` 或重启终端 |
| `error: unknown argument: -s MODULARIZE` | emcc 版本过旧 | 升级 emsdk: `./emsdk install latest && ./emsdk activate latest` |
| WASM 内存不足 | 大文件超出默认内存 | 已启用 `ALLOW_MEMORY_GROWTH=1`，确认生效 |
| 编译报错 `std::filesystem` | C++17 特性 | 当前代码仅用 C++11，检查是否误引入 C++17 头文件 |

### 运行时问题

| 问题 | 现象 | 排查步骤 |
|------|------|----------|
| 文件加载后无反应 | 状态栏显示 "Loading parser module..." | 1. 检查浏览器控制台是否有 WASM 加载错误<br>2. 确认 `dist/hevc.wasm` 可访问 (MIME: application/wasm)<br>3. 检查 `createHevcModule` 是否正常 resolve |
| 解析报错 "parse failed" | CLI 返回码 3 | 1. 确认文件非空<br>2. 用 `xxd` 检查起始码 `00 00 01` 或 `00 00 00 01`<br>3. 尝试强制指定编解码器 `./hevcparser_native file.bin hevc` |
| 语法树显示异常/为空 | 右侧面板空白 | 1. 点击 NAL 列表不同行测试<br>2. 检查控制台 `hevc_get_nal_syntax` 返回值<br>3. 确认 NAL 索引未越界 |
| 视频预览黑屏 | Preview 标签页无画面 | 1. 确认浏览器支持 WebCodecs (Chrome 94+, Firefox 110+)<br>2. VVC 需加载 vvdec WASM，检查网络面板<br>3. AV1 需加载 dav1d WASM<br>4. 尝试点击时间轴不同帧 |
| HDR 信息不显示 | 底部面板为空 | 1. 确认码流包含 SEI: mastering_display_colour_volume / content_light_level_info<br>2. HEVC: VUI 中的 colour_description_present_flag=1<br>3. 点击对应 NAL (通常是 SPS/VPS) 查看语法树确认 |
| YUV 自动猜测失败 | 设置面板显示 "size not divisible — set resolution/format" | 非常规尺寸属预期行为：手动输入 Width/Height/Format 后点击 Apply |
| YUV 颜色异常 | 预览偏色/偏移 | 在 YUV 设置栏切换色彩矩阵 (BT.601 ↔ BT.709)；默认 full range |
| YUV 点击 Play 无反应 | 播放按钮无效 | 符合设计：单帧模式——`.yuv` 文件按单帧处理 |

### 性能问题

| 现象 | 优化建议 |
|------|----------|
| 大文件 (>500MB) 解析缓慢 | 1. 仅加载可见 NAL 范围 (虚拟滚动已实现)<br>2. 考虑分片解析 (Web Worker)<br>3. 启用 `ALLOW_MEMORY_GROWTH` |
| 时间轴渲染卡顿 | 长流已实现缩放自动适配 + 离屏底图缓存；可进一步用 Worker + OffscreenCanvas |
| 内存占用过高 | 1. 及时调用 `hevc_reset()` 释放解析器<br>2. 避免同时持有多个大文件数据<br>3. 使用 `URL.revokeObjectURL()` 释放 Blob URL |
| 8K YUV 预览慢 | 已实现降采样预览 + WASM 转换；全分辨率转换延迟到放大镜打开 |

---

## 性能优化

已实现的优化（代码中可验证）：

- **虚拟滚动**：NAL 列表仅渲染可见行
- **YUV 降采样预览**：仅转换显示尺寸像素（8K 约 80 倍工作量削减）；全分辨率转换延迟到放大镜打开
- **YUV LUT 转换 + WASM**：256 项查找表；优先 WASM `yuv_convert_planes`，JS 兜底
- **Hex 视图 4KB 上限**：避免 YUV 帧渲染数十 MB HTML
- **时间轴**：离屏底图缓存；长视频缩放自动适配与最小可点击帧宽
- **ALLOW_MEMORY_GROWTH**：WASM 堆按需增长，支持大文件

后续优化方向（尚未实现）：

- Web Worker 分片/并行解析
- OffscreenCanvas 时间轴渲染移入 Worker
- HTTP Range 请求 / Service Worker 缓存 / CDN 分发
- emcc 参数调优 (`-O3` / `-flto` / `INITIAL_MEMORY`)

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2024 | 初始版本：HEVC/AVC/VVC 解析、Web 界面、CLI、SEI 插件、HDR 支持 |
| (HEAD) | 2026-09 | Raw YUV 支持（8 种格式、自动猜测+设置面板、BT.601/709、WASM 转换、放大镜+PNG 导出）；SEI 标签页；全编解码器帧放大镜；H.264 定制 frame-ts SEI；Hex 4KB 上限；GitHub/GitLab Pages CI |

---

## 附录：标准参考

| 标准 | 文档编号 | 版本 | 备注 |
|------|----------|------|------|
| H.264/AVC | ITU-T H.264 / ISO/IEC 14496-10 | 2023 | 含 FRExt, MVC, SVC |
| H.265/HEVC | ITU-T H.265 / ISO/IEC 23008-2 | 2023 | Main/Main10/Still Picture/3D |
| H.266/VVC | ITU-T H.266 / ISO/IEC 23090-3 | 2022 | 基础 Profile 支持 |
| AV1 | AOMedia Video 1 | 1.0.0+ | 容器级解复用 |
| VP9 | VP9 Bitstream & Decoding Process | v0.6 | 容器级解复用 |
| MP4 | ISO/IEC 14496-12 | 2022 | ISOBMFF |
| WebM | Matroska / WebM | - | EBML 子集 |
| IVF | IVF Format Specification | - | 简单容器 |
| HEIC | ISO/IEC 23008-12 | - | 基于 HEVC |
| AVIF | AV1 Image File Format | 1.0.0 | 基于 AV1 |

---

