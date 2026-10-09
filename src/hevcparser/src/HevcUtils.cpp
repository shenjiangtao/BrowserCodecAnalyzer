#include "HevcUtils.h"

#include "Hevc.h"

static const uint8_t log2_tab[256]={
        0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
        5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
        6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
        6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
        7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7
};

uint32_t HEVC::log2(uint32_t k)
{
  uint32_t res = 0;

  if (k & 0xffff0000) {
      k >>= 16;
      res += 16;
  }


  if (k & 0xff00) {
      k >>= 8;
      res += 8;
  }

  res += log2_tab[k];

  return res;
}

uint32_t HEVC::calcNumPocTotalCurr(std::shared_ptr<HEVC::Slice> pslice, std::shared_ptr<HEVC::SPS> psps)
{
  std::size_t NumPocTotalCurr = 0;
  std::size_t currRpsIdx;

  // num_long_term 可能来自损坏码流的无界 Golomb 值（解析层已限制 ≤64，此处再做防御）：
  // 用动态数组替代固定 [16] 栈数组，并对两个下标做边界检查
  std::size_t num_long_term = pslice -> num_long_term_sps + pslice -> num_long_term_pics;
  std::vector<char> UsedByCurrPicLt(num_long_term, 0);

  for(std::size_t i=0; i < num_long_term; i++)
  {
    if (i < pslice -> num_long_term_sps)
    {
      if (i < pslice -> lt_idx_sps.size() &&
          pslice -> lt_idx_sps[i] < psps -> used_by_curr_pic_lt_sps_flag.size())
        UsedByCurrPicLt[i] = psps -> used_by_curr_pic_lt_sps_flag[pslice -> lt_idx_sps[i]];
    }
    else if (i < pslice -> used_by_curr_pic_lt_flag.size())
      UsedByCurrPicLt[i] = pslice -> used_by_curr_pic_lt_flag[i];
  }

  if(pslice -> short_term_ref_pic_set_sps_flag)
    currRpsIdx = pslice -> short_term_ref_pic_set_idx;
  else
    currRpsIdx = psps -> num_short_term_ref_pic_sets;

  if(psps -> short_term_ref_pic_set.size() <= currRpsIdx)
  {
    if(currRpsIdx != 0 || pslice->short_term_ref_pic_set_sps_flag)
      return 0;
  }

  ShortTermRefPicSet strps;

  if(currRpsIdx < psps -> short_term_ref_pic_set.size()  )
    strps = psps -> short_term_ref_pic_set[currRpsIdx];
  else
    strps = pslice -> short_term_ref_pic_set;

  for(std::size_t i = 0; i < strps.num_negative_pics; i++)
    if (strps.used_by_curr_pic_s0_flag[i])
      NumPocTotalCurr++;

  for(std::size_t i = 0; i < strps.num_positive_pics; i++)
    if (strps.used_by_curr_pic_s1_flag[i])
      NumPocTotalCurr++;

  for(std::size_t i = 0;i < (pslice -> num_long_term_sps + pslice -> num_long_term_pics); i++)
    if (UsedByCurrPicLt[i])
      NumPocTotalCurr++;

  return NumPocTotalCurr;
}
