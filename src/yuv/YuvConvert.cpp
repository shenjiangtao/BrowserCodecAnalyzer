#include "YuvConvert.h"

#include <cstdlib>
#include <cmath>

namespace yuv
{

  namespace
  {
    // 与前端 yuv.js FORMAT_ORDER 一致：子采样参数
    struct FormatInfo { int subX; int subY; };

    FormatInfo formatInfo(int format)
    {
      switch (format)
      {
        case 0: case 1: case 2: case 3: return { 2, 2 };  // i420/yv12/nv12/nv21
        case 4: case 5: case 6: return { 2, 1 };          // yuv422p/yuyv/uyvy
        default: return { 1, 1 };                          // yuv444p
      }
    }

    inline int roundHalfDown(double v)
    {
      // 半数向下（frac > 0.5 才进位）：与 cv2 INTER_LINEAR 定点 descale 实测一致
      double f = std::floor(v);
      return (v - f > 0.5) ? (int)f + 1 : (int)f;
    }

    inline uint8_t clampU8(double v)
    {
      if (v < 0) return 0;
      if (v > 255) return 255;
      return (uint8_t)v;
    }

    // 色度双线性上采样（cv2 INTER_LINEAR 约定：src=(dst+0.5)/sub-0.5，边界复制）
    void upsampleChroma(const uint8_t *src, int cw, int ch, int w, int h, int subX, int subY, uint8_t *dst)
    {
      for (int row = 0; row < h; row++)
      {
        double sy = (row + 0.5) / subY - 0.5;
        int y0 = (int)std::floor(sy);
        double fy = sy - y0;
        if (y0 < 0) { y0 = 0; fy = 0; }
        if (y0 >= ch - 1) { y0 = ch - 1; fy = 0; }
        int y1 = y0 + 1 < ch ? y0 + 1 : ch - 1;
        const uint8_t *r0 = src + (std::size_t)y0 * cw;
        const uint8_t *r1 = src + (std::size_t)y1 * cw;
        for (int col = 0; col < w; col++)
        {
          double sx = (col + 0.5) / subX - 0.5;
          int x0 = (int)std::floor(sx);
          double fx = sx - x0;
          if (x0 < 0) { x0 = 0; fx = 0; }
          if (x0 >= cw - 1) { x0 = cw - 1; fx = 0; }
          int x1 = x0 + 1 < cw ? x0 + 1 : cw - 1;
          double w00 = (1 - fy) * (1 - fx), w01 = (1 - fy) * fx, w10 = fy * (1 - fx), w11 = fy * fx;
          dst[(std::size_t)row * w + col] = (uint8_t)roundHalfDown(
            r0[x0] * w00 + r0[x1] * w01 + r1[x0] * w10 + r1[x1] * w11);
        }
      }
    }
  }

  uint8_t *convertPlanes(const uint8_t *y, const uint8_t *u, const uint8_t *v,
                         std::size_t yLen, std::size_t uLen, std::size_t vLen,
                         int width, int height, int format,
                         int matrix, int fullRange)
  {
    if (!y || !u || !v || width <= 0 || height <= 0) return nullptr;
    std::size_t total = (std::size_t)width * height;
    if (total > yLen) return nullptr;

    FormatInfo fi = formatInfo(format);
    int cw = width / fi.subX, ch = height / fi.subY;
    std::size_t cTotal = (std::size_t)cw * ch;
    if (cTotal > uLen || cTotal > vLen) return nullptr;

    // LUT（与前端 yuv.js 一致）
    double yScale, cScale, yOff, cOff;
    if (fullRange) { yScale = 1.0; cScale = 1.0; yOff = 0; cOff = 128; }
    else { yScale = 255.0 / 219.0; cScale = 255.0 / 224.0; yOff = 16; cOff = 128; }
    double yT[256], cT[256];
    for (int i = 0; i < 256; i++)
    {
      yT[i] = (i - yOff) * yScale;
      cT[i] = (i - cOff) * cScale;
    }
    double Kr = matrix == 1 ? 0.2126 : 0.299;
    double Kb = matrix == 1 ? 0.0722 : 0.114;
    double Kg = 1 - Kr - Kb;
    double coef1 = 2 * (1 - Kr);
    double coef2 = 2 * (Kb * (1 - Kb) / Kg);
    double coef3 = 2 * (Kr * (1 - Kr) / Kg);
    double coef4 = 2 * (1 - Kb);

    // 色度上采样到全分辨率（子采样格式）
    uint8_t *uFull = nullptr, *vFull = nullptr;
    if (fi.subX > 1 || fi.subY > 1)
    {
      uFull = (uint8_t *)malloc(total);
      vFull = (uint8_t *)malloc(total);
      if (!uFull || !vFull)
      {
        free(uFull);
        free(vFull);
        return nullptr;
      }
      upsampleChroma(u, cw, ch, width, height, fi.subX, fi.subY, uFull);
      upsampleChroma(v, cw, ch, width, height, fi.subX, fi.subY, vFull);
      u = uFull;
      v = vFull;
    }

    // 转换（截断，与参考实现 np.clip().astype(uint8) 一致）
    uint8_t *out = (uint8_t *)malloc(total * 4);
    if (!out)
    {
      free(uFull);
      free(vFull);
      return nullptr;
    }
    for (std::size_t o = 0, o4 = 0; o < total; o++, o4 += 4)
    {
      double Yv = yT[y[o]];
      double Cuv = cT[u[o]], Cvv = cT[v[o]];
      out[o4]     = clampU8(Yv + coef1 * Cvv);
      out[o4 + 1] = clampU8(Yv - (coef2 * Cuv + coef3 * Cvv));
      out[o4 + 2] = clampU8(Yv + coef4 * Cuv);
      out[o4 + 3] = 255;
    }

    free(uFull);
    free(vFull);
    return out;
  }

}
