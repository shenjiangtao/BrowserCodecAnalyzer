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
| **容器格式** | MP4/M4V/MOV, WebM, IVF, MPEG-TS |
| **图像格式** | HEIC/HEIF, AVIF, JPEG, PNG, GIF, WebP, BMP |
| **裸流格式** | .h264, .h265, .h266, .264, .265, .266, .avc, .hevc, .vvc, .bin, .bit, .obu |
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
| `-s MODULARIZE=1` | 生成 ES6 模块，支持 `import`/`await` |
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
| `make wasm` | 构建 Web 版本 (等同 `./build.sh`) |
| `make clean` | 清理所有构建产物 |

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
│ Timeline Panel: 帧结构时间轴 (I=红, P=蓝, B=绿)               │
├──────────────────┬──────────────────────────────────────────┤
│ NAL Unit List    │ Syntax / Preview / Hex / MediaInfo / Bitrate │
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
| Offset | 文件偏移量 (字节) | 点击复制偏移量 |
| Length | NAL 单元长度 | - |
| Type | NAL 类型名称 (VPS/SPS/PPS/IDR/非IDR/SEI等) | 颜色编码区分 |
| Frame | 所属帧号 (POC) | - |
| Info | 关键语法元素摘要 | 悬浮显示完整信息 |

**操作**：
- 点击任意行 → 右侧显示该 NAL 的完整语法树
- 滚动列表 → 自动加载可见区域行 (虚拟滚动，支持百万级 NAL)
- 双击 → 定位到时间轴对应帧

#### 2. 语法树标签页 (Syntax)

- **树状结构**：按语法层级展示所有语法元素
- **展开/折叠**：点击 ▶/▼ 图标
- **搜索**：`Ctrl+F` 在语法树中查找字段名/值
- **复制**：点击行 → 复制路径/值/完整行

**语法元素字段说明**：
```
名称: 值 [描述/约束]
  例：pic_width_in_luma_samples: 1920 [符合 Main 10 Profile]
```

#### 3. 预览标签页 (Preview)

- **视频解码预览**：点击时间轴帧 → 解码并显示该帧
- **播放控制**：▶ 播放、|◀ 上一帧、▶| 下一帧
- **序列切换**："Decode Order" ↔ "Display Order"
- **支持的解码器**：
  - H.264/H.265/VP9 → 浏览器原生 WebCodecs
  - H.266/VVC → vvdec WASM (需额外加载)
  - AV1 → dav1d WASM (需额外加载)

#### 4. 十六进制视图标签页 (Hex)

- **原始字节查看**：完整 NAL 单元的十六进制 + ASCII
- **高亮当前语法元素**：点击语法树节点 → Hex 视图高亮对应字节范围
- **地址栏**：显示文件绝对偏移

#### 5. MediaInfo 标签页

容器级元数据 (仅 MP4/MOV/WebM/IVF)：
- 格式、主品牌、兼容品牌
- 时长、总码率
- 轨道信息：类型、编解码器、分辨率、帧率、语言

#### 6. 码率统计标签页 (Bitrate)

- **帧级码率图表**：每帧大小随时间变化
- **统计指标**：平均码率、峰值码率、I/P/B 平均帧大小
- **导出**：CSV 格式下载

#### 7. 时间轴面板

- **颜色编码**：I帧=红、P帧=蓝、B帧=绿、IDR=深红
- **缩放**：`+`/`-` 键 或鼠标滚轮
- **平移**：拖拽空白区域
- **点击帧**：选中并在预览区显示解码帧
- **进度指示**：播放时显示当前播放位置高亮

#### 8. HDR/色彩信息面板 (底部左)

| 项目 | 来源 | 示例 |
|------|------|------|
| 色度格式 | SPS/VPS chroma_format_idc | 4:2:0 / 4:2:2 / 4:4:4 |
| 位深 | bit_depth_luma/chroma | 8 / 10 / 12 |
| Mastering Display | SEI mastering_display_colour_volume | G(13250,34500) B(7500,3000) R(34000,16000) WP(15635,16450) |
| MaxCLL / MaxFALL | SEI content_light_level_info | MaxCLL=4000, MaxFALL=2000 |
| 传输特性 | VUI transfer_characteristics | PQ (SMPTE ST 2084) / HLG / BT.709 |
| 色度坐标 | VUI colour_primaries | BT.2020 / BT.709 / P3-D65 |

#### 9. 告警面板 (底部右)

| 等级 | 类型 | 说明 |
|------|------|------|
| 🔴 Error | Out of range | 语法元素值超出标准定义范围 |
| 🟡 Warning | Missing ref structure | 参考图像列表、DPB 状态不一致 |
| 🔵 Info | Profile conformance | 违反 Profile 约束 (如 Main 10 使用 8-bit) |

**筛选器**：下拉框选择告警类型 (-1=全部, 1=越界, 2=参考结构, 3=Profile)

### 键盘快捷键完整表

| 快捷键 | 功能 | 作用区域 |
|--------|------|---------|
| `←` | 上一帧 | 全局 (聚焦非输入框时) |
| `→` | 下一帧 | 全局 |
| `+` / `=` | 时间轴放大 | 时间轴聚焦时 |
| `-` / `_` | 时间轴缩小 | 时间轴聚焦时 |
| `Space` | 播放/暂停 | 预览区聚焦时 |
| `D` | 切换解码/显示序 | 预览区聚焦时 |
| `Home` | 跳转首帧 | 时间轴 |
| `End` | 跳转末帧 | 时间轴 |
| `Ctrl+F` | 搜索语法树 | 语法树标签页 |
| `Esc` | 关闭模态框/取消选择 | 全局 |

### SEI 插件系统

#### 内置插件加载

1. 点击工具栏 "⚙ Plugin" 按钮
2. 选择 `.js` 插件文件
3. 插件自动注册，解析对应 UUID 的 SEI 消息

#### 插件开发规范

插件文件需导出 `registerSEIPlugin(registry)` 函数：

```javascript
// my-sei-plugin.js
export function registerSEIPlugin(registry) {
  registry.register({
    // SEI payloadType UUID (16字节十六进制字符串)
    uuid: '12345678-9abc-def0-1234-56789abcdef0',
    
    // 显示名称
    name: 'Custom SEI Message',
    
    // 解析函数：payload 为 Uint8Array，返回解析后的对象
    parse: (payload, offset, size) => {
      const view = new DataView(payload.buffer, offset, size);
      // 解析逻辑...
      return {
        field1: view.getUint32(0),
        field2: view.getUint16(4),
        // 嵌套对象自动在语法树中展开
        nested: { a: 1, b: 2 }
      };
    }
  });
}
```

**注册表 API**：

```typescript
interface SEIRegistry {
  register(plugin: SEIPlugin): void;
  unregister(uuid: string): void;
  get(uuid: string): SEIPlugin | undefined;
}

interface SEIPlugin {
  uuid: string;           // 16字节 UUID，十六进制含连字符
  name: string;           // 显示名称
  parse: (payload: Uint8Array, offset: number, size: number) => any;
}
```

---

## 命令行工具使用指南

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
│                     容器解复用层 (demux.js)                        │
│  MP4/MOV  → ISOBMFF 解析  → 提取视频轨道 + 码流数据                │
│  WebM     → Matroska 解析 → 提取视频轨道 + 码流数据                │
│  IVF      → IVF 解析      → 提取帧数据                            │
│  图像     → 格式识别      → 提取编码数据 (HEIC→libheif, AVIF→dav1d) │
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
                              │ JavaScript (ES Module)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      前端渲染层 (app.js)                          │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌────────┐  │
│  │ NAL List   │ │ Timeline │ │ Syntax  │ │ Preview│ │ Hex    │  │
│  │ Virtual    │ │ Canvas   │ │ Tree    │ │ Canvas │ │ View   │  │
│  │ Scroll     │ │ Rendering│ │ (DOM)   │ │(WebGL/2D)          │  │
│  └────────────┘ └──────────┘ └─────────┘ └────────┘ └────────┘  │
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

### JavaScript API (app.js 核心模块)

#### createHevcModule (WASM 模块工厂)

```javascript
// hevc.js 由 Emscripten 生成，导出默认工厂函数
import createHevcModule from './hevc.js';

const Module = await createHevcModule({
  locateFile: (path) => `./${path}`  // WASM 文件路径解析
});

// 可用函数 (Module.cwrap 包装)
const hevc_parse = Module.cwrap('hevc_parse', 'string', ['number', 'number']);
const hevc_get_nal_syntax = Module.cwrap('hevc_get_nal_syntax', 'string', ['number']);
const hevc_reset = Module.cwrap('hevc_reset', null, []);
const detect_codec = Module.cwrap('detect_codec', 'string', ['number', 'number']);
const hevc_free = Module.cwrap('hevc_free', null, ['number']);
const _malloc = Module.cwrap('malloc', 'number', ['number']);
const _free = Module.cwrap('free', null, ['number']);
const HEAPU8 = Module.HEAPU8;
```

#### 内存管理模式

```javascript
// 将 Uint8Array 复制到 WASM 堆
function copyToHeap(uint8Array) {
  const ptr = _malloc(uint8Array.length);
  HEAPU8.set(uint8Array, ptr);
  return ptr;
}

// 完整调用示例
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

#### 前端核心类 (app.js)

```javascript
// App 类 - 主应用控制器
class App {
  constructor() { ... }
  
  // 加载文件入口
  async loadFile(file) { ... }
  
  // 解析码流
  async parseBitstream(data, codecHint) { ... }
  
  // 渲染 NAL 列表
  renderNalList(summary) { ... }
  
  // 渲染语法树
  renderSyntaxTree(nalIndex) { ... }
  
  // 渲染时间轴
  renderTimeline(summary) { ... }
  
  // 视频预览
  previewFrame(frameIndex, decodeOrder) { ... }
}
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

**Makefile**：
```makefile
NEWCODEC_SRC := $(wildcard src/newcodecparser/src/*.cpp)
NATIVE_SRC := ... $(NEWCODEC_SRC) ...

wasm:
	$(EMCC) ... $(NEWCODEC_SRC) ... -o dist/hevc.js
```

**build.sh**：同步添加源文件和导出函数。

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
// 在 App.parseBitstream 中添加分支
if (codec === 'newcodec') {
  summary = await this.parseNewCodec(data);
}
```

### 新增容器格式支持

在 `www/js/demux.js` 中扩展 `Demuxer` 类：

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
    // 新增格式检测...
  }
  
  static async demux(file, type) {
    switch (type) {
      case 'mp4': return this.demuxMP4(file);
      case 'webm': return this.demuxWebM(file);
      case 'ivf': return this.demuxIVF(file);
      case 'newfmt': return this.demuxNewFormat(file); // 新增
    }
  }
}
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

### 性能问题

| 现象 | 优化建议 |
|------|----------|
| 大文件 (>500MB) 解析缓慢 | 1. 仅加载可见 NAL 范围 (虚拟滚动已实现)<br>2. 考虑分片解析 (Web Worker)<br>3. 启用 `ALLOW_MEMORY_GROWTH` |
| 时间轴渲染卡顿 | 1. 减少 Canvas 重绘频率<br>2. 使用 OffscreenCanvas (Web Worker)<br>3. 简化帧绘制逻辑 |
| 内存占用过高 | 1. 及时调用 `hevc_reset()` 释放解析器<br>2. 避免同时持有多个大文件数据<br>3. 使用 `URL.revokeObjectURL()` 释放 Blob URL |

---

## 性能优化建议

### 1. 解析层面

- **增量解析**：大文件分块解析，配合 `process(data, size, offset)` 的 offset 参数
- **并行化**：多线程解析不同 Layer/Temporal ID (需解析器支持)
- **流式处理**：配合 `ReadableStream` 实现边下载边解析

### 2. WASM 层面

```bash
# 优化编译选项
-s WASM=1 \
-s ALLOW_MEMORY_GROWTH=1 \
-s INITIAL_MEMORY=64MB \        # 根据典型文件大小调整
-s MAXIMUM_MEMORY=2GB \         # 设置上限
-s STACK_SIZE=5MB \             # 栈大小
-O3 \                           # 发布版用 O3
-flto \                         # 链接时优化
```

### 3. 前端渲染层面

- **虚拟滚动**：NAL 列表仅渲染可视区域 (已实现)
- **Canvas 离屏渲染**：时间轴用 `OffscreenCanvas` 移至 Worker
- **防抖/节流**：窗口 resize、滚动事件防抖
- **Web Worker**：语法树构建、Hex 视图生成移至 Worker

### 4. 网络层面

- **Range 请求**：大文件支持 HTTP Range 加载部分内容
- **Service Worker**：缓存 WASM、JS、插件文件
- **CDN 分发**：静态资源走 CDN

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2024 | 初始版本：HEVC/AVC/VVC 解析、Web 界面、CLI、SEI 插件、HDR 支持 |

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

