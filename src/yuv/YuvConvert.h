#ifndef YUV_CONVERT_H_
#define YUV_CONVERT_H_

#include <cstdint>
#include <cstddef>

namespace yuv
{

  // format: 0=i420, 1=yv12, 2=nv12, 3=nv21, 4=yuv422p, 5=yuyv, 6=uyvy, 7=yuv444p
  // planes 按前端 getFrame 布局：全部为独立 u/v 平面（nv12/nv21 已由前端解包，
  // yuyv/uyvy 已解包为 (w/2)x(h/2)... 实际为 (w/2)xh）。matrix: 0=bt601, 1=bt709。
  // 返回 malloc 的 RGBA（w*h*4 字节），调用方用 hevc_free 释放；失败返回 nullptr。
  uint8_t *convertPlanes(const uint8_t *y, const uint8_t *u, const uint8_t *v,
                         std::size_t yLen, std::size_t uLen, std::size_t vLen,
                         int width, int height, int format,
                         int matrix, int fullRange);

}

#endif
