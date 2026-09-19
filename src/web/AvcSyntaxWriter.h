#ifndef WEB_AVC_SYNTAX_WRITER_H_
#define WEB_AVC_SYNTAX_WRITER_H_

#include <Avc.h>
#include <AvcParser.h>

#include "Json.h"

#include <memory>
#include <map>
#include <string>
#include <vector>

namespace web
{

  std::string avcNalTypeName(AVC::NALUnitType type);

  std::string seiPayloadTypeName(uint32_t payloadType);
  // 定制时间戳 SEI：payload 为 ASCII "%lu %ld"（帧号 + 时间戳）
  bool seiCustomTimestamp(const std::vector<uint8_t> &data, unsigned long &frame, long long &ts);
  // payload ASCII 可打印内容（用于 user_data_* SEI）
  std::string seiAsciiText(const std::vector<uint8_t> &data);

  class AvcSyntaxWriter
  {
    public:
      void setParameterSets(const std::map<uint32_t, std::shared_ptr<AVC::SPS_NAL> > &spsMap,
                            const std::map<uint32_t, std::shared_ptr<AVC::PPS_NAL> > &ppsMap);

      std::string write(std::shared_ptr<AVC::NALUnit> pNALUnit);

    private:
      void createSPS(const AVC::SPS &sps, SyntaxNode &parent);
      void createPPS(const AVC::PPS &pps, SyntaxNode &parent);
      void createSlice(const AVC::Slice &slice, SyntaxNode &parent);
      void createAUD(const AVC::AUD &aud, SyntaxNode &parent);
      void createSEI(const AVC::SEI_NAL &sei, SyntaxNode &parent);
      void createScalingMatrix(const AVC::ScalingMatrix &sm, SyntaxNode &parent);
      void createVui(const AVC::VuiParameters &vui, SyntaxNode &parent);
      void createRefPicListModification(const AVC::RefPicListModification &r, bool isB, SyntaxNode &parent);
      void createDecRefPicMarking(const AVC::Slice &slice, SyntaxNode &parent);
      void createPredWeightTable(const AVC::PredWeightTable &p, uint32_t sliceType, SyntaxNode &parent);

      std::map<uint32_t, std::shared_ptr<AVC::SPS_NAL> > m_spsMap;
      std::map<uint32_t, std::shared_ptr<AVC::PPS_NAL> > m_ppsMap;
  };

}

#endif
