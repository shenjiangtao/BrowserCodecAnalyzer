// BrowserCodecAnalyzer 解析 Worker —— WASM 解析器运行于此，主线程保持可交互。
//
// 消息协议（主线程 ↔ worker，除 reset 外均以 id 关联请求/响应）：
//   主→worker:
//     {type:"parse",      id, bytes:Uint8Array, hint}   bytes 经 transfer 归 worker
//     {type:"nalSyntax",  id, codec, index}
//     {type:"yuvConvert", id, y,u,v, w,h, fmtIdx, matrix, fullRange}
//     {type:"reset"}
//   worker→主:
//     {type:"ready"}  /  {type:"initError", message}
//     {type:"parseDone",     id, codec, json} | {type:"parseDone",     id, error}
//     {type:"nalSyntaxDone", id, json}        | {type:"nalSyntaxDone", id, error}
//     {type:"yuvDone",       id, rgba}        | {type:"yuvDone",       id, rgba:null, error?}
//     {type:"resetDone"}
//
// 解析树常驻 worker 的 WASM 堆：主线程零占用，reset 消息整体释放。

importScripts("../hevc.js");

var Module = null;

function parseImpl(bytes, hint) {
  var ptr = Module._malloc(bytes.length);
  Module.HEAPU8.set(bytes, ptr);
  var codec = hint;
  if (!codec) {
    var codecPtr = Module._detect_codec(ptr, bytes.length);
    codec = Module.UTF8ToString(codecPtr);
    Module._hevc_free(codecPtr);
  }
  var outPtr;
  if (codec === "avc") outPtr = Module._avc_parse(ptr, bytes.length);
  else if (codec === "vvc") outPtr = Module._vvc_parse(ptr, bytes.length);
  else outPtr = Module._hevc_parse(ptr, bytes.length);
  Module._free(ptr);
  var json = Module.UTF8ToString(outPtr);
  Module._hevc_free(outPtr);
  return { codec: codec, json: json };
}

createHevcModule({ locateFile: function (f) { return "../" + f; } }).then(function (m) {
  Module = m;
  postMessage({ type: "ready" });
}).catch(function (e) {
  postMessage({ type: "initError", message: (e && e.message) ? e.message : String(e) });
});

self.onmessage = function (e) {
  var msg = e.data;
  try {
    switch (msg.type) {
      case "parse": {
        if (!Module) { postMessage({ type: "parseDone", id: msg.id, error: "worker module not ready" }); break; }
        var r = parseImpl(msg.bytes, msg.hint);
        postMessage({ type: "parseDone", id: msg.id, codec: r.codec, json: r.json });
        break;
      }
      case "nalSyntax": {
        if (!Module) { postMessage({ type: "nalSyntaxDone", id: msg.id, error: "worker module not ready" }); break; }
        var outPtr;
        if (msg.codec === "avc") outPtr = Module._avc_get_nal_syntax(msg.index);
        else if (msg.codec === "vvc") outPtr = Module._vvc_get_nal_syntax(msg.index);
        else outPtr = Module._hevc_get_nal_syntax(msg.index);
        var j = Module.UTF8ToString(outPtr);
        Module._hevc_free(outPtr);
        postMessage({ type: "nalSyntaxDone", id: msg.id, json: j });
        break;
      }
      case "yuvConvert": {
        if (!Module || !Module._yuv_convert_planes) { postMessage({ type: "yuvDone", id: msg.id, rgba: null }); break; }
        var yLen = msg.y.length, cLen = msg.u.length;
        var py = Module._malloc(yLen), pu = Module._malloc(cLen), pv = Module._malloc(msg.v.length);
        Module.HEAPU8.set(msg.y, py);
        Module.HEAPU8.set(msg.u, pu);
        Module.HEAPU8.set(msg.v, pv);
        var rgbaPtr = Module._yuv_convert_planes(py, yLen, pu, cLen, pv, cLen, msg.w, msg.h, msg.fmtIdx, msg.matrix, msg.fullRange);
        Module._free(py);
        Module._free(pu);
        Module._free(pv);
        if (rgbaPtr) {
          var out = new Uint8ClampedArray(Module.HEAPU8.subarray(rgbaPtr, rgbaPtr + yLen * 4));
          Module._hevc_free(rgbaPtr);
          postMessage({ type: "yuvDone", id: msg.id, rgba: out }, [out.buffer]);
        } else {
          postMessage({ type: "yuvDone", id: msg.id, rgba: null });
        }
        break;
      }
      case "reset": {
        if (Module) {
          try { Module._hevc_reset(); Module._avc_reset(); Module._vvc_reset(); } catch (eR) {}
        }
        postMessage({ type: "resetDone" });
        break;
      }
    }
  } catch (err) {
    var t = (msg.type === "parse") ? "parseDone" : (msg.type === "nalSyntax") ? "nalSyntaxDone" : "yuvDone";
    postMessage({ type: t, id: msg.id, error: (err && err.message) ? err.message : String(err) });
  }
};
