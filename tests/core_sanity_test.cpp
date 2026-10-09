// 核心内存安全/语义单元测试（ASAN，CI 必跑）：
//   A2  calcNumPocTotalCurr 越界（曾为 bool[16] 栈溢出，构造流可打穿原生栈）
//   A2b lt_idx_sps 越界下标
//   A3a skipBits 越界读钳位  A3b availableInNalU 小缓冲下溢
//   A3c/d availableInNalU 单位一致性（bit）
// Phase 1 red/green sanity tests (ASAN): A2 stack overflow, A3 BitstreamReader OOB
#include "HevcUtils.h"
#include "Hevc.h"
#include "BitstreamReader.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static int g_fail = 0;
#define CHECK(cond, name) do { \
  if (cond) printf("PASS %s\n", name); \
  else { printf("FAIL %s\n", name); g_fail = 1; } \
} while (0)

// A2: num_long_term = 32 (spec-conformant max) must not smash the [16] stack array
static void test_calcNumPocTotalCurr_overflow()
{
  auto sps = std::make_shared<HEVC::SPS>();
  auto slice = std::make_shared<HEVC::Slice>(HEVC::NALHeader{HEVC::NAL_TRAIL_R, 0, 1});

  slice->num_long_term_sps = 0;
  slice->num_long_term_pics = 32;
  slice->used_by_curr_pic_lt_flag.assign(32, 1);
  slice->short_term_ref_pic_set_sps_flag = 0;
  slice->short_term_ref_pic_set.num_negative_pics = 0;
  slice->short_term_ref_pic_set.num_positive_pics = 0;
  sps->num_short_term_ref_pic_sets = 0;

  std::size_t n = HEVC::calcNumPocTotalCurr(slice, sps);
  CHECK(n == 32, "A2 calcNumPocTotalCurr 32 LT pics (no stack smash, correct count)");
}

// A2b: out-of-range lt_idx_sps must not read OOB on the SPS vector
static void test_calcNumPocTotalCurr_lt_idx_oob()
{
  auto sps = std::make_shared<HEVC::SPS>();
  auto slice = std::make_shared<HEVC::Slice>(HEVC::NALHeader{HEVC::NAL_TRAIL_R, 0, 1});

  slice->num_long_term_sps = 1;
  slice->num_long_term_pics = 0;
  slice->lt_idx_sps.assign(1, 999);            // corrupt index vs empty SPS vector
  slice->short_term_ref_pic_set_sps_flag = 0;
  slice->short_term_ref_pic_set.num_negative_pics = 0;
  slice->short_term_ref_pic_set.num_positive_pics = 0;
  sps->num_short_term_ref_pic_sets = 0;
  sps->used_by_curr_pic_lt_sps_flag.clear();

  std::size_t n = HEVC::calcNumPocTotalCurr(slice, sps);
  CHECK(n == 0, "A2b out-of-range lt_idx_sps ignored safely");
}

// A3a: skipBits beyond buffer must not read OOB
static void test_skipBits_oob()
{
  std::vector<uint8_t> buf(16, 0xAB);
  BitstreamReader bs(buf.data(), buf.size());
  bs.skipBits(16 * 8 + 8000);          // way past the end
  CHECK(bs.availableInNalU() == 0, "A3a skipBits past end clamps (availableInNalU == 0 after)");
  CHECK(bs.available() == 0, "A3a skipBits past end clamps (available == 0)");
}

// A3b: availableInNalU on tiny buffer (m_size < 3) must not underflow-scan
static void test_availableInNalU_tiny()
{
  std::vector<uint8_t> buf = {0x11, 0x22};
  BitstreamReader bs(buf.data(), buf.size());
  CHECK(bs.availableInNalU() == 16, "A3b m_size<3: returns remaining bits (16), no OOB scan");
}

// A3c: units consistency — no start code following → bits remaining, not bytes
static void test_availableInNalU_units()
{
  std::vector<uint8_t> buf(16, 0xAB);          // no start code inside
  BitstreamReader bs(buf.data(), buf.size());
  CHECK(bs.availableInNalU() == 16 * 8, "A3c no-startcode path returns bits (128), not bytes (16)");
}

// A3d: with a start code after 8 bytes → bits until start code
static void test_availableInNalU_startcode()
{
  std::vector<uint8_t> buf = {1,2,3,4,5,6,7,8, 0,0,1, 9};
  BitstreamReader bs(buf.data(), buf.size());
  CHECK(bs.availableInNalU() == 8 * 8, "A3d startcode path returns 64 bits before 00 00 01");
}

int main()
{
  test_availableInNalU_units();
  test_availableInNalU_startcode();
  test_availableInNalU_tiny();
  test_skipBits_oob();
  test_calcNumPocTotalCurr_overflow();
  test_calcNumPocTotalCurr_lt_idx_oob();
  return g_fail;
}
