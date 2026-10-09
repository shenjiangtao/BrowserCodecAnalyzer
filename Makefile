CXX ?= clang++
CXXFLAGS ?= -std=c++11 -O2 -Wall
DEPFLAGS = -MMD -MP
EMCC ?= em++

INC := -Isrc/hevcparser/include -Isrc/hevcparser/src -Isrc/h264parser/include -Isrc/h264parser/src -Isrc/vvcparser/include -Isrc/vvcparser/src -Isrc/common -Isrc/web -Isrc/yuv

PARSER_SRC := $(wildcard src/hevcparser/src/*.cpp)
AVC_SRC := $(wildcard src/h264parser/src/*.cpp)
VVC_SRC := $(wildcard src/vvcparser/src/*.cpp)
COMMON_SRC := $(wildcard src/common/*.cpp)
WEB_SRC := $(wildcard src/web/*.cpp)
YUV_SRC := $(wildcard src/yuv/*.cpp)

NATIVE_SRC := $(PARSER_SRC) $(AVC_SRC) $(VVC_SRC) $(COMMON_SRC) $(WEB_SRC) $(YUV_SRC) src/native_main.cpp
NATIVE_OBJ := $(NATIVE_SRC:.cpp=.o)

.PHONY: all native wasm clean

all: native

native: hevcparser_native

hevcparser_native: $(NATIVE_OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $^

%.o: %.cpp
	$(CXX) $(CXXFLAGS) $(DEPFLAGS) $(INC) -c -o $@ $<

# 头文件依赖（-MMD -MP 生成）：改 .h 也会触发正确重编译
-include $(NATIVE_OBJ:.o=.d)

wasm:
	mkdir -p dist
	$(EMCC) $(PARSER_SRC) $(AVC_SRC) $(VVC_SRC) $(COMMON_SRC) $(WEB_SRC) $(YUV_SRC) \
	  $(INC) \
	  -std=c++11 -O2 \
	  -s WASM=1 \
	  -s ALLOW_MEMORY_GROWTH=1 \
	  -s EXPORTED_FUNCTIONS='["_hevc_parse","_hevc_get_nal_syntax","_hevc_reset","_avc_parse","_avc_get_nal_syntax","_avc_reset","_vvc_parse","_vvc_get_nal_syntax","_vvc_reset","_detect_codec","_hevc_free","_yuv_convert_planes","_malloc","_free"]' \
	  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","lengthBytesUTF8","HEAPU8"]' \
	  -s MODULARIZE=1 \
	  -s EXPORT_NAME=createHevcModule \
	  -o dist/hevc.js
	cp -r www/index.html www/css www/js dist/

clean:
	rm -f $(NATIVE_OBJ) $(NATIVE_OBJ:.o=.d) hevcparser_native
	rm -rf dist
