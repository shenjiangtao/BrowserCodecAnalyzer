// WebParser POC 推导单元测试（红/绿基准）：
//   1) IDR 必须复位 POC 为 0（spec 8.3.1），且不得携带 stale msb
//   2) dependent slice 不得推进/污染 POC unwrap 状态，显示所属图像 POC
//   3) 正常回绕推导不受影响
// log2_max_poc_lsb=8 -> maxLsb=256, 半程 128
#include "WebParser.h"

#include <Hevc.h>

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <string>
#include <vector>

static int g_fail = 0;
#define CHECK(cond, name) do { \
  if (cond) printf("PASS %s\n", name); \
  else { printf("FAIL %s\n", name); g_fail = 1; } \
} while (0)

// 提取 slice 行的 slicePoc（跳过前两行 SPS/PPS 的占位 -1）
static std::vector<int> extractSlicePocs(const std::string &json, std::size_t skipNaluRows)
{
  std::vector<int> out;
  const std::string key = "\"slicePoc\":";
  std::size_t pos = 0;
  while((pos = json.find(key, pos)) != std::string::npos)
  {
    pos += key.size();
    out.push_back(atoi(json.c_str() + pos));
  }
  if(out.size() > skipNaluRows)
    out.erase(out.begin(), out.begin() + skipNaluRows);
  return out;
}

static void feedBase(web::WebParser &wp, HEVC::Parser::Info &info)
{
  auto sps = std::make_shared<HEVC::SPS>();
  sps -> m_nalHeader = HEVC::NALHeader{HEVC::NAL_SPS, 0, 1};
  sps -> sps_seq_parameter_set_id = 0;
  sps -> log2_max_pic_order_cnt_lsb_minus4 = 4;  // maxLsb = 256
  wp.onNALUnit(sps, &info);

  auto pps = std::make_shared<HEVC::PPS>();
  pps -> m_nalHeader = HEVC::NALHeader{HEVC::NAL_PPS, 0, 1};
  pps -> pps_pic_parameter_set_id = 0;
  pps -> pps_seq_parameter_set_id = 0;
  pps -> init_qp_minus26 = 0;
  wp.onNALUnit(pps, &info);
}

static void feedSlice(web::WebParser &wp, HEVC::Parser::Info &info,
                      HEVC::NALUnitType type, uint32_t lsb, bool dependent)
{
  auto slice = std::make_shared<HEVC::Slice>(HEVC::NALHeader{type, 0, 1});
  slice -> slice_pic_parameter_set_id = 0;
  slice -> slice_pic_order_cnt_lsb = lsb;
  slice -> slice_qp_delta = 0;
  slice -> first_slice_segment_in_pic_flag = 1;
  slice -> dependent_slice_segment_flag = dependent ? 1 : 0;
  slice -> slice_type = HEVC::Slice::P_SLICE;
  wp.onNALUnit(slice, &info);
}

static bool runScenario(const char *name, std::vector<std::pair<HEVC::NALUnitType, std::pair<uint32_t, bool>>> seq,
                        const std::vector<int> &expected)
{
  web::WebParser wp;
  HEVC::Parser::Info info;
  info.m_position = 0;
  wp.setTotalSize(1024);
  feedBase(wp, info);
  for(auto &s : seq)
    feedSlice(wp, info, s.first, s.second.first, s.second.second);

  std::vector<int> pocs = extractSlicePocs(wp.serializeSummary(), 2);
  printf("%s POC sequence:", name);
  for(std::size_t i = 0; i < pocs.size(); i++) printf(" %d", pocs[i]);
  printf("  (expected:");
  for(std::size_t i = 0; i < expected.size(); i++) printf(" %d", expected[i]);
  printf(")\n");
  return pocs == expected;
}

int main()
{
  // 场景 A（IDR 复位）：
  //   IDR(0) -> P(250) -> P(130) -> P(100) 保持 msb=-256 且 prevLsb<128，
  //   再遇 IDR：当前代码给出 -256（携带 stale msb），规范要求 0；
  //   其后 P(10) 当前代码 -246，修复后 10
  bool a = runScenario("[A idr-reset]",
    {{HEVC::NAL_IDR_W_RADL, {0, false}},
     {HEVC::NAL_TRAIL_R, {250, false}},
     {HEVC::NAL_TRAIL_R, {130, false}},
     {HEVC::NAL_TRAIL_R, {100, false}},
     {HEVC::NAL_IDR_W_RADL, {0, false}},
     {HEVC::NAL_TRAIL_R, {10, false}}},
    {0, -6, -126, -156, 0, 10});
  CHECK(a, "A: IDR resets POC to 0 (no stale msb)");

  // 场景 B（dependent slice）：
  //   IDR(0) -> P(250) -> dependent(0)：当前代码把状态污染为 (0,0) 且 POC=0；
  //   修复后显示所属图像 POC=-6、状态不动；随后的 P(125) 当前 125 / 修复 -131
  bool b = runScenario("[B dependent]",
    {{HEVC::NAL_IDR_W_RADL, {0, false}},
     {HEVC::NAL_TRAIL_R, {250, false}},
     {HEVC::NAL_TRAIL_R, {0, true}},
     {HEVC::NAL_TRAIL_R, {125, false}}},
    {0, -6, -6, -131});
  CHECK(b, "B: dependent slice keeps picture POC, does not corrupt unwrap state");

  return g_fail;
}
