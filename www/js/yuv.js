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

  // 常见分辨率（按可能性排序，8K 为最大上限）
  var MAX_WIDTH = 7680;
  var MAX_HEIGHT = 4320;
  var COMMON_RESOLUTIONS = [
    [1920, 1080], [1280, 720], [3840, 2160], [3848, 2168], [2560, 1440], [640, 480],
    [704, 576], [720, 576], [704, 480], [720, 480], [960, 540],
    [640, 360], [320, 240], [352, 288], [352, 240], [1600, 1200],
    [2048, 1536], [1920, 1536], [2592, 1944], [1280, 960], [1280, 1024], [1920, 1200],
    [800, 600], [1024, 768], [176, 144], [128, 96], [480, 320], [480, 272],
    [7680, 4320]
  ];

  // ---------- 自动猜测 ----------
  // 仅单帧：fileSize 恰好等于某分辨率×格式的单帧大小时返回该候选
  function guessFormat(fileSize) {
    if (!fileSize || fileSize <= 0) return null;
    var candidates = [];
    for (var r = 0; r < COMMON_RESOLUTIONS.length; r++) {
      var w = COMMON_RESOLUTIONS[r][0], h = COMMON_RESOLUTIONS[r][1];
      if (w > MAX_WIDTH || h > MAX_HEIGHT) continue;
      for (var fi = 0; fi < FORMAT_ORDER.length; fi++) {
        var key = FORMAT_ORDER[fi];
        var frameSize = FORMATS[key].bytesPerFrame(w, h);
        if (frameSize <= 0 || fileSize !== frameSize) continue;
        candidates.push({ width: w, height: h, format: key, frames: 1, order: candidates.length });
      }
    }
    if (candidates.length === 0) return null;

    // 排序：常用格式优先（i420/nv12 → packed yuyv/uyvy）；
    // order 作最终 tiebreaker（不依赖引擎 sort 稳定性）
    function score(c) {
      var fmtRank = (c.format === "i420" || c.format === "nv12") ? 0 :
                    (c.format === "yuyv" || c.format === "uyvy") ? 1 :
                    (c.format === "yv12" || c.format === "nv21") ? 2 : 3;
      var resRank = COMMON_RESOLUTIONS.findIndex(function (res) { return res[0] === c.width && res[1] === c.height; });
      return [fmtRank, resRank < 0 ? 999 : resRank, c.order];
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
  // 256 项 Y/色度查找表（仅依赖 matrix/range，全局缓存）
  var lutCache = null, lutKey = null;
  function getLuts(matrix, fullRange) {
    var key = matrix + ":" + (fullRange ? 1 : 0);
    if (lutCache && lutKey === key) return lutCache;
    var Kr = (matrix === "bt709") ? 0.2126 : 0.299;
    var Kb = (matrix === "bt709") ? 0.0722 : 0.114;
    var Kg = 1 - Kr - Kb;
    var yScale, cScale, yOff, cOff;
    if (fullRange) { yScale = 1.0; cScale = 1.0; yOff = 0; cOff = 128; }
    else { yScale = 255 / 219; cScale = 255 / 224; yOff = 16; cOff = 128; }
    var yT = new Float64Array(256), cT = new Float64Array(256);
    for (var i = 0; i < 256; i++) {
      yT[i] = (i - yOff) * yScale;
      cT[i] = (i - cOff) * cScale;
    }
    lutCache = { yT: yT, cT: cT, coef1: 2 * (1 - Kr), coef2: 2 * (Kb * (1 - Kb) / Kg), coef3: 2 * (Kr * (1 - Kr) / Kg), coef4: 2 * (1 - Kb) };
    lutKey = key;
    return lutCache;
  }

// 半数向下（frac > 0.5 才进位）：与 cv2 INTER_LINEAR 定点 descale 实测一致
  function rint(v) {
    var f = Math.floor(v), d = v - f;
    return (d > 0.5) ? f + 1 : f;
  }

  // 色度双线性上采样（cv2 INTER_LINEAR 约定：src=(dst+0.5)/sub-0.5，边界复制，半数向下）
  // 残差说明：cv2 定点管线有分阶段量化（实测同坐标非单调舍入），无法在 JS 精确复现；
  // 本实现与 Python 输出的差异为 maxDiff≤3 / avg<1（PSNR>50dB，视觉不可分辨）
  function yuvUpsampleChroma(u, v, cw, ch, w, h, subX, subY) {
    var uu = new Uint8Array(w * h), vv = new Uint8Array(w * h);
    for (var row = 0; row < h; row++) {
      var sy = (row + 0.5) / subY - 0.5;
      var y0 = Math.floor(sy), fy = sy - y0;
      if (y0 < 0) { y0 = 0; fy = 0; }
      if (y0 >= ch - 1) { y0 = ch - 1; fy = 0; }
      var y1 = Math.min(ch - 1, y0 + 1);
      var rU0 = y0 * cw, rU1 = y1 * cw;
      for (var col = 0; col < w; col++) {
        var sx = (col + 0.5) / subX - 0.5;
        var x0 = Math.floor(sx), fx = sx - x0;
        if (x0 < 0) { x0 = 0; fx = 0; }
        if (x0 >= cw - 1) { x0 = cw - 1; fx = 0; }
        var x1 = Math.min(cw - 1, x0 + 1);
        var w00 = (1 - fy) * (1 - fx), w01 = (1 - fy) * fx, w10 = fy * (1 - fx), w11 = fy * fx;
        var o = row * w + col;
        uu[o] = rint(u[rU0 + x0] * w00 + u[rU0 + x1] * w01 + u[rU1 + x0] * w10 + u[rU1 + x1] * w11);
        vv[o] = rint(v[rU0 + x0] * w00 + v[rU0 + x1] * w01 + v[rU1 + x0] * w10 + v[rU1 + x1] * w11);
      }
    }
    return { u: uu, v: vv };
  }

  // 降采样平面（最近邻）：预览用，仅转换显示尺寸像素（8K 预览 ~80x 工作量削减）
  function subsamplePlanes(planes, w, h, format, dw, dh) {
    var fmt = FORMATS[format];
    var y = planes.y, u = planes.u, v = planes.v;
    var subX = fmt.sub[0], subY = fmt.sub[1];
    var ys = new Uint8Array(dw * dh);
    for (var row = 0; row < dh; row++) {
      var sy = Math.min(h - 1, Math.floor(row * h / dh));
      for (var col = 0; col < dw; col++) {
        var sx = Math.min(w - 1, Math.floor(col * w / dw));
        ys[row * dw + col] = y[sy * w + sx];
      }
    }
    var scw = Math.floor(dw / subX), sch = Math.floor(dh / subY);
    var srcCw = Math.floor(w / subX), srcCh = Math.floor(h / subY);
    var us = new Uint8Array(scw * sch), vs = new Uint8Array(scw * sch);
    for (var r2 = 0; r2 < sch; r2++) {
      var sy2 = Math.min(srcCh - 1, Math.floor(r2 * srcCh / sch));
      for (var c2 = 0; c2 < scw; c2++) {
        var sx2 = Math.min(srcCw - 1, Math.floor(c2 * srcCw / scw));
        var so = sy2 * srcCw + sx2;
        us[r2 * scw + c2] = u[so];
        vs[r2 * scw + c2] = v[so];
      }
    }
    return { y: ys, u: us, v: vs, width: dw, height: dh };
  }

  function yuvToRGBA(w, h, format, planes, matrix, fullRange) {
    var fmt = FORMATS[format];
    if (!fmt) return null;
    var T = getLuts(matrix, fullRange);
    var yT = T.yT, cT = T.cT, coef1 = T.coef1, coef2 = T.coef2, coef3 = T.coef3, coef4 = T.coef4;

    var y = planes.y, u = planes.u, v = planes.v;
    var out = new Uint8ClampedArray(w * h * 4);

    // 色度上采样（与参考实现 cv2.resize INTER_LINEAR 输出一致的 uint8 平面）
    var subX = fmt.sub[0], subY = fmt.sub[1];
    if (subX > 1 || subY > 1) {
      var cw = Math.floor(w / subX), ch = Math.floor(h / subY);
      var up = yuvUpsampleChroma(u, v, cw, ch, w, h, subX, subY);
      u = up.u; v = up.v;
    }

    // 每像素：3 次查表 + 转换（截断存储，与参考实现 np.clip().astype(uint8) 一致；
// 先取整再入 Uint8ClampedArray，避免其四舍五入）
    var total = w * h;
    for (var o = 0, o4 = 0; o < total; o++, o4 += 4) {
      var Yv = yT[y[o]];
      var Cuv = cT[u[o]], Cvv = cT[v[o]];
      var R = Yv + coef1 * Cvv;
      var G = Yv - (coef2 * Cuv + coef3 * Cvv);
      var B = Yv + coef4 * Cuv;
      out[o4] = R < 0 ? 0 : (R > 255 ? 255 : Math.floor(R));
      out[o4 + 1] = G < 0 ? 0 : (G > 255 ? 255 : Math.floor(G));
      out[o4 + 2] = B < 0 ? 0 : (B > 255 ? 255 : Math.floor(B));
      out[o4 + 3] = 255;
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
    MAX_WIDTH: MAX_WIDTH,
    MAX_HEIGHT: MAX_HEIGHT,
    guessFormat: guessFormat,
    getFrame: getFrame,
    subsamplePlanes: subsamplePlanes,
    yuvToRGBA: yuvToRGBA,
    autoColorMatrix: autoColorMatrix
  };
})();
