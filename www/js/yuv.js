// YUV raw file parser (8-bit)
// Raw YUV has no header: dimensions/format/fps are guessed from file size,
// and can be overridden by the user via the YUV settings panel.

var YuvParser = (function () {
  "use strict";

  // ---------- 格式表 ----------
  // planar: 平面排列；packed: 打包排列
  // bytesPerFrame(w, h) 返回单帧字节数
  var FORMATS = {
    i420:    { name: "YUV420p (I420)",  arrangement: "Planar Y→U→V",        planar: true,  sub: [2, 2],  bytesPerFrame: function (w, h) { return w * h + 2 * (Math.floor(w / 2) * Math.floor(h / 2)); } },
    yv12:    { name: "YV12",            arrangement: "Planar Y→V→U",        planar: true,  sub: [2, 2],  bytesPerFrame: function (w, h) { return w * h + 2 * (Math.floor(w / 2) * Math.floor(h / 2)); } },
    nv12:    { name: "NV12",            arrangement: "Planar Y + UV interleaved", planar: false, sub: [2, 2], bytesPerFrame: function (w, h) { return w * h + 2 * (Math.floor(w / 2) * Math.floor(h / 2)); } },
    nv21:    { name: "NV21",            arrangement: "Planar Y + VU interleaved", planar: false, sub: [2, 2], bytesPerFrame: function (w, h) { return w * h + 2 * (Math.floor(w / 2) * Math.floor(h / 2)); } },
    yuv422p: { name: "YUV422p",         arrangement: "Planar Y→U→V",        planar: true,  sub: [2, 1],  bytesPerFrame: function (w, h) { return w * h + 2 * (Math.floor(w / 2) * h); } },
    yuyv:    { name: "YUYV (YUY2)",     arrangement: "Packed Y0 U Y1 V",    planar: false, sub: [2, 1],  bytesPerFrame: function (w, h) { return w * h * 2; } },
    uyvy:    { name: "UYVY",            arrangement: "Packed U Y0 V Y1",    planar: false, sub: [2, 1],  bytesPerFrame: function (w, h) { return w * h * 2; } },
    yuv444p: { name: "YUV444p",         arrangement: "Planar Y→U→V",        planar: true,  sub: [1, 1],  bytesPerFrame: function (w, h) { return w * h * 3; } }
  };

  var FORMAT_ORDER = ["i420", "nv12", "yv12", "nv21", "yuv422p", "yuyv", "uyvy", "yuv444p"];

  // 常见分辨率（按可能性排序）
  var COMMON_RESOLUTIONS = [
    [1920, 1080], [1280, 720], [3840, 2160], [3848, 2168], [2560, 1440], [640, 480],
    [704, 576], [720, 576], [704, 480], [720, 480], [960, 540],
    [640, 360], [320, 240], [352, 288], [352, 240], [1600, 1200],
    [2048, 1536], [1920, 1536], [2592, 1944], [1280, 960], [1280, 1024], [1920, 1200],
    [800, 600], [1024, 768], [176, 144], [128, 96], [480, 320], [480, 272]
  ];

  // ---------- 自动猜测 ----------
  // fileSize 整除性检查：返回最佳候选 { width, height, format, frames, alternatives }
  function guessFormat(fileSize) {
    if (!fileSize || fileSize <= 0) return null;
    var candidates = [];
    for (var r = 0; r < COMMON_RESOLUTIONS.length; r++) {
      var w = COMMON_RESOLUTIONS[r][0], h = COMMON_RESOLUTIONS[r][1];
      for (var fi = 0; fi < FORMAT_ORDER.length; fi++) {
        var key = FORMAT_ORDER[fi];
        var fmt = FORMATS[key];
        var frameSize = fmt.bytesPerFrame(w, h);
        if (frameSize <= 0 || fileSize % frameSize !== 0) continue;
        var frames = fileSize / frameSize;
        if (frames < 1 || frames > 1000000) continue;
        candidates.push({ width: w, height: h, format: key, frames: frames, order: candidates.length });
      }
    }
    if (candidates.length === 0) return null;

    // 排序：单帧匹配优先（巧合最少），其次常用格式（i420/nv12 → packed yuyv/uyvy），
    // 帧数适中优先；order 作最终 tiebreaker（不依赖引擎 sort 稳定性）
    function score(c) {
      var fmtRank = (c.format === "i420" || c.format === "nv12") ? 0 :
                    (c.format === "yuyv" || c.format === "uyvy") ? 1 :
                    (c.format === "yv12" || c.format === "nv21") ? 2 : 3;
      var frames = c.frames;
      var framesRank = (frames === 1) ? 0 : (frames <= 500 ? 1 : 2);
      var resRank = COMMON_RESOLUTIONS.findIndex(function (res) { return res[0] === c.width && res[1] === c.height; });
      return [framesRank, fmtRank, resRank < 0 ? 999 : resRank, frames, c.order];
    }
    candidates.sort(function (a, b) {
      var sa = score(a), sb = score(b);
      for (var i = 0; i < sa.length; i++) {
        if (sa[i] !== sb[i]) return sa[i] - sb[i];
      }
      return 0;
    });
    var best = candidates[0];
    best.alternatives = candidates.slice(1, 8);
    return best;
  }

  function frameCount(fileSize, w, h, format) {
    var fmt = FORMATS[format];
    if (!fmt) return 0;
    var frameSize = fmt.bytesPerFrame(w, h);
    if (frameSize <= 0) return 0;
    return Math.floor(fileSize / frameSize);
  }

  // ---------- 帧平面提取 ----------
  // 返回 { y: Uint8Array, u: Uint8Array, v: Uint8Array, width, height }
  function getFrame(bytes, offset, w, h, format) {
    var fmt = FORMATS[format];
    if (!fmt) return null;
    var frameSize = fmt.bytesPerFrame(w, h);
    if (offset < 0 || offset + frameSize > bytes.length) return null;

    var cw = Math.floor(w / 2), ch = Math.floor(h / 2);
    var ySize = w * h;

    if (format === "i420" || format === "yv12") {
      var y = bytes.subarray(offset, offset + ySize);
      var uStart = offset + ySize;
      var vStart = uStart + cw * ch;
      if (format === "i420") return { y: y, u: bytes.subarray(uStart, uStart + cw * ch), v: bytes.subarray(vStart, vStart + cw * ch), width: w, height: h };
      return { y: y, u: bytes.subarray(vStart, vStart + cw * ch), v: bytes.subarray(uStart, uStart + cw * ch), width: w, height: h };
    }
    if (format === "yuv422p") {
      var u422 = cw * h;
      var y4 = bytes.subarray(offset, offset + ySize);
      var u4 = bytes.subarray(offset + ySize, offset + ySize + u422);
      var v4 = bytes.subarray(offset + ySize + u422, offset + ySize + 2 * u422);
      return { y: y4, u: u4, v: v4, width: w, height: h };
    }
    if (format === "yuv444p") {
      var y44 = bytes.subarray(offset, offset + ySize);
      var u44 = bytes.subarray(offset + ySize, offset + 2 * ySize);
      var v44 = bytes.subarray(offset + 2 * ySize, offset + 3 * ySize);
      return { y: y44, u: u44, v: v44, width: w, height: h };
    }
    if (format === "nv12" || format === "nv21") {
      var yN = bytes.subarray(offset, offset + ySize);
      var cN = bytes.subarray(offset + ySize, offset + ySize + 2 * cw * ch);
      // NV12: U V U V ...; NV21: V U V U ...
      var u = new Uint8Array(cw * ch), v = new Uint8Array(cw * ch);
      for (var i = 0; i < cw * ch; i++) {
        if (format === "nv12") { u[i] = cN[2 * i]; v[i] = cN[2 * i + 1]; }
        else { v[i] = cN[2 * i]; u[i] = cN[2 * i + 1]; }
      }
      return { y: yN, u: u, v: v, width: w, height: h };
    }
    if (format === "yuyv" || format === "uyvy") {
      // packed: 每像素对 4 字节
      var yP = new Uint8Array(ySize), uP = new Uint8Array(cw * h), vP = new Uint8Array(cw * h);
      for (var row = 0; row < h; row++) {
        for (var px = 0; px < cw; px++) {
          var base = offset + row * w * 2 + px * 4;
          var y0, y1, uu, vv;
          if (format === "yuyv") { y0 = bytes[base]; uu = bytes[base + 1]; y1 = bytes[base + 2]; vv = bytes[base + 3]; }
          else { uu = bytes[base]; y0 = bytes[base + 1]; vv = bytes[base + 2]; y1 = bytes[base + 3]; }
          yP[row * w + 2 * px] = y0;
          yP[row * w + 2 * px + 1] = y1;
          uP[row * cw + px] = uu;
          vP[row * cw + px] = vv;
        }
      }
      return { y: yP, u: uP, v: vP, width: w, height: h };
    }
    return null;
  }

  // ---------- YUV → RGBA 转换 ----------
  // format: FORMATS key；matrix: "bt601" | "bt709"；fullRange: true/false
  // limited range: Y ∈ [16,235], C ∈ [16,240]; full: [0,255]
  function yuvToRGBA(w, h, format, planes, matrix, fullRange) {
    var fmt = FORMATS[format];
    if (!fmt) return null;
    var Kr = (matrix === "bt709") ? 0.2126 : 0.299;
    var Kb = (matrix === "bt709") ? 0.0722 : 0.114;
    var Kg = 1 - Kr - Kb;

    var yScale, cScale, yOff, cOff;
    if (fullRange) { yScale = 1.0; cScale = 1.0; yOff = 0; cOff = 128; }
    else { yScale = 255 / 219; cScale = 255 / 224; yOff = 16; cOff = 128; }

    var y = planes.y, u = planes.u, v = planes.v;
    var out = new Uint8ClampedArray(w * h * 4);
    // 色度平面尺寸按格式子采样（getFrame 返回的 u/v 布局与此一致）
    var subX = fmt.sub[0], subY = fmt.sub[1];
    var chromaW = Math.floor(w / subX), chromaH = Math.floor(h / subY);

    for (var row = 0; row < h; row++) {
      var cRow = Math.floor(row / subY);
      for (var col = 0; col < w; col++) {
        var Yv = (y[row * w + col] - yOff) * yScale;
        var cIdx = (subX === 1 && subY === 1) ? (row * w + col) : (cRow * chromaW + Math.floor(col / subX));
        var Cuv = (u[cIdx] - cOff) * cScale;
        var Cvv = (v[cIdx] - cOff) * cScale;
        var R = Yv + 2 * (1 - Kr) * Cvv;
        var G = Yv - 2 * (Kb * (1 - Kb) / Kg) * Cuv - 2 * (Kr * (1 - Kr) / Kg) * Cvv;
        var B = Yv + 2 * (1 - Kb) * Cuv;
        var o = (row * w + col) * 4;
        out[o] = R;
        out[o + 1] = G;
        out[o + 2] = B;
        out[o + 3] = 255;
      }
    }
    return out;
  }

  // 按分辨率自动选择色彩矩阵：SD → bt601，height ≥ 720 → bt709
  function autoColorMatrix(height) {
    return (height >= 720) ? "bt709" : "bt601";
  }

  return {
    FORMATS: FORMATS,
    FORMAT_ORDER: FORMAT_ORDER,
    COMMON_RESOLUTIONS: COMMON_RESOLUTIONS,
    guessFormat: guessFormat,
    frameCount: frameCount,
    getFrame: getFrame,
    yuvToRGBA: yuvToRGBA,
    autoColorMatrix: autoColorMatrix
  };
})();
