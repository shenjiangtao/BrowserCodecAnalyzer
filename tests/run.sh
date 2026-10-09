#!/bin/bash
# BrowserCodecAnalyzer 质量门禁（本地与 CI 共用）：
#   1. ASAN 单元测试（BitstreamReader 越界、calcNumPocTotalCurr、POC 推导）
#   2. 原生构建
#   3. Golden 基线：fixtures 码流的 CLI 解析输出与入库 golden 做 JSON 语义对比
# 任一步失败即退出非零，阻断 CI 部署。
set -e
cd "$(dirname "$0")/.."

CXX="${CXX:-g++}"
CXXFLAGS="${CXXFLAGS:--std=c++11 -O1 -g}"
INC="-Isrc/hevcparser/include -Isrc/hevcparser/src -Isrc/h264parser/include \
-Isrc/h264parser/src -Isrc/vvcparser/include -Isrc/vvcparser/src -Isrc/common -Isrc/web"

TMPDIR_T="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_T"' EXIT

echo "== [1/3] ASAN unit tests =="
"$CXX" $CXXFLAGS -fsanitize=address $INC tests/core_sanity_test.cpp \
  src/hevcparser/src/HevcUtils.cpp src/hevcparser/src/Hevc.cpp src/common/BitstreamReader.cpp \
  -o "$TMPDIR_T/core_sanity_test"
"$TMPDIR_T/core_sanity_test"

"$CXX" $CXXFLAGS $INC tests/webparser_poc_test.cpp \
  src/web/WebParser.cpp src/web/WebSyntaxWriter.cpp src/web/AvcSyntaxWriter.cpp \
  src/web/Json.cpp src/common/ConvToString.cpp \
  src/hevcparser/src/Hevc.cpp src/hevcparser/src/HevcUtils.cpp src/h264parser/src/Avc.cpp \
  -o "$TMPDIR_T/webparser_poc_test"
"$TMPDIR_T/webparser_poc_test"

echo "== [2/3] native build =="
make native >/dev/null

echo "== [3/3] golden baseline =="
fail=0
for f in tests/fixtures/*; do
  stem="$(basename "$f")"
  stem="${stem%.*}"
  ./hevcparser_native "$f" > "$TMPDIR_T/out.json" 2>/dev/null \
    || { echo "FAIL $stem (CLI returned error)"; fail=1; continue; }
  python3 tests/verify.py "tests/golden/$stem.json" "$TMPDIR_T/out.json" || fail=1
done

if [ "$fail" -ne 0 ]; then
  echo "== RESULT: FAIL =="
  exit 1
fi
echo "== RESULT: ALL PASS =="
