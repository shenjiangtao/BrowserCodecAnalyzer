#!/usr/bin/env python3
"""Golden 基线语义对比：解析输出与入库 golden 做 JSON 语义级 diff。

用法: verify.py GOLDEN.json OUTPUT.json
退出码 0 = 一致；1 = 有差异（打印前 20 条差异路径）。
"""
import json
import sys


def diff(a, b, path="$"):
    out = []
    if type(a) is not type(b):
        return [f"{path}: type {type(a).__name__} != {type(b).__name__}"]
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                out.append(f"{path}.{k}: missing in golden (output-only)")
            elif k not in b:
                out.append(f"{path}.{k}: missing in output")
            else:
                out.extend(diff(a[k], b[k], f"{path}.{k}"))
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{path}: length {len(a)} != {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            out.extend(diff(x, y, f"{path}[{i}]"))
    elif a != b:
        out.append(f"{path}: golden={a!r} output={b!r}")
    return out


def main():
    if len(sys.argv) != 3:
        print("usage: verify.py GOLDEN.json OUTPUT.json", file=sys.stderr)
        return 2
    golden = json.load(open(sys.argv[1], encoding="utf-8"))
    output = json.load(open(sys.argv[2], encoding="utf-8"))
    diffs = diff(golden, output)
    if diffs:
        print(f"FAIL {sys.argv[1]}")
        for d in diffs[:20]:
            print("  " + d)
        if len(diffs) > 20:
            print(f"  ... and {len(diffs) - 20} more")
        return 1
    print(f"PASS {sys.argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
