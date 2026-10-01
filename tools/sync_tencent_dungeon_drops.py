#!/usr/bin/env python3
"""Sync dungeon drops from the Tencent Docs related_sheet protobuf snapshot.

The Tencent sheet does not expose a simple CSV in the public page. The
`related_sheet` payload stores ordinary text cells and rich-text cells in
different protobuf branches. This script extracts both, writes a normalized
`dungeon_drops` array, and emits a compact change report.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any


DOC_URL = "https://docs.qq.com/sheet/DSWJSVEVGc1Z6Q21E"
SHEET_ID = "w5z6in"
SHEET_NAME = "副本掉落"
USER_AGENT = "jianghu-calculator-dungeon-sync/1.0"


class OpendocScriptParser(HTMLParser):
    """Find the public Tencent Docs JSONP request embedded in the page."""

    def __init__(self) -> None:
        super().__init__()
        self.src = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "script" and attributes.get("id") == "opendoc-jsonp":
            self.src = attributes.get("src") or ""


def http_opener() -> urllib.request.OpenerDirector:
    cookies = CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def http_get(opener: urllib.request.OpenerDirector, url: str, referer: str = "") -> bytes:
    headers = {
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent": USER_AGENT,
    }
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with opener.open(request, timeout=20) as response:
        return response.read()


def extract_opendoc_url(page: bytes, doc_url: str, sheet_id: str) -> str:
    parser = OpendocScriptParser()
    parser.feed(page.decode("utf-8", errors="replace"))
    if not parser.src:
        raise ValueError("Tencent Docs page did not contain the opendoc JSONP URL")
    source = urllib.parse.urljoin(doc_url, parser.src)
    parsed = urllib.parse.urlparse(source)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query["tab"] = [sheet_id]
    query["callback"] = ["clientVarsCallback"]
    query["startrow"] = ["0"]
    query["endrow"] = ["60"]
    query["block_start_col"] = ["0"]
    query["block_start_row"] = ["0"]
    query["block_end_col"] = ["31"]
    query["block_end_row"] = ["255"]
    query["t"] = [str(int(datetime.now().timestamp() * 1000))]
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query, doseq=True)))


def extract_jsonp_payload(raw: bytes) -> str:
    text = raw.decode("utf-8-sig", errors="replace").strip()
    if not text:
        raise ValueError("Tencent Docs opendoc response was empty")
    match = re.match(r"^[^(]+\((.*)\)\s*;?\s*$", text, re.DOTALL)
    return match.group(1) if match else text


def extract_related_sheet_base64(raw: bytes) -> str:
    """Extract related_sheet without depending on the full response schema."""

    payload = extract_jsonp_payload(raw)
    try:
        decoded: Any = json.loads(payload)
    except json.JSONDecodeError:
        decoded = None
    if decoded is not None:
        found: list[str] = []

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                for key, child in value.items():
                    if key == "related_sheet" and isinstance(child, str):
                        found.append(child)
                    else:
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(decoded)
        if found:
            return found[0]
    match = re.search(r'"related_sheet"\s*:\s*"([^"]+)"', payload)
    if match:
        return bytes(match.group(1), "utf-8").decode("unicode_escape")
    raise ValueError("Tencent Docs opendoc response did not contain related_sheet")


def decode_related_sheet(encoded: str) -> bytes:
    raw = base64.b64decode(encoded)
    for decoder in (
        lambda value: zlib.decompress(value),
        lambda value: zlib.decompress(value, -zlib.MAX_WBITS),
        lambda value: gzip.decompress(value),
    ):
        try:
            return decoder(raw)
        except (OSError, zlib.error):
            pass
    return raw


def fetch_related_sheet(
    doc_url: str,
    sheet_id: str,
    page_path: Path,
    jsonp_path: Path,
    related_path: Path,
) -> bytes:
    opener = http_opener()
    page = http_get(opener, doc_url)
    page_path.parent.mkdir(parents=True, exist_ok=True)
    page_path.write_bytes(page)
    opendoc_url = extract_opendoc_url(page, doc_url, sheet_id)
    try:
        response = http_get(opener, opendoc_url, doc_url)
    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"Tencent Docs opendoc request failed with HTTP {error.code}. "
            "Use --related-bin with a browser-exported snapshot when the endpoint blocks this host."
        ) from error
    jsonp_path.parent.mkdir(parents=True, exist_ok=True)
    jsonp_path.write_bytes(response)
    related = decode_related_sheet(extract_related_sheet_base64(response))
    related_path.parent.mkdir(parents=True, exist_ok=True)
    related_path.write_bytes(related)
    return related


def read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while offset < len(data):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, offset
        shift += 7
    raise ValueError("unterminated varint")


def read_fields(data: bytes) -> list[tuple[int, int, Any]]:
    offset = 0
    fields: list[tuple[int, int, Any]] = []
    while offset < len(data):
        tag, offset = read_varint(data, offset)
        number = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            value, offset = read_varint(data, offset)
        elif wire_type == 1:
            value = data[offset:offset + 8]
            offset += 8
        elif wire_type == 2:
            size, offset = read_varint(data, offset)
            value = data[offset:offset + size]
            offset += size
        elif wire_type == 5:
            value = data[offset:offset + 4]
            offset += 4
        else:
            raise ValueError(f"unsupported protobuf wire type: {wire_type}")
        fields.append((number, wire_type, value))
    return fields


def safe_fields(data: bytes) -> list[tuple[int, int, Any]]:
    try:
        return read_fields(data)
    except Exception:
        return []


def plain_text_message(data: bytes) -> str:
    for number, wire_type, value in safe_fields(data):
        if number == 1 and wire_type == 2:
            try:
                return value.decode("utf-8").strip()
            except UnicodeDecodeError:
                return ""
    return ""


def rich_text_message(data: bytes) -> str:
    parts: list[str] = []
    for number, wire_type, value in safe_fields(data):
        if number != 3 or wire_type != 2:
            continue
        for child_number, child_wire, child_value in safe_fields(value):
            if child_number == 3 and child_wire == 2:
                part = plain_text_message(child_value)
                if part:
                    parts.append(part)
    return " ".join(normalize_cell(part) for part in parts).strip()


def find_related_sheet_blob(data: bytes) -> bytes:
    root = read_fields(data)[0][2]
    for number, wire_type, value in read_fields(root):
        if number != 5 or wire_type != 2:
            continue
        children = safe_fields(value)
        for child_number, child_wire, child_value in children:
            if child_number == 19 and child_wire == 2:
                return child_value
    raise ValueError("related_sheet blob not found")


def extract_sheet_cells(related_sheet: bytes) -> list[str]:
    blob = find_related_sheet_blob(related_sheet)
    cell_store = None
    for number, wire_type, value in read_fields(blob):
        if number == 5 and wire_type == 2:
            cell_store = value
            break
    if cell_store is None:
        raise ValueError("cell text store not found")

    cells: list[str] = []
    for number, wire_type, value in read_fields(cell_store):
        if wire_type != 2:
            continue
        if number == 1:
            text = plain_text_message(value)
        elif number == 2:
            text = rich_text_message(value)
        else:
            text = ""
        text = normalize_cell(text)
        if text:
            cells.append(text)
    return cells


def normalize_cell(text: str) -> str:
    text = re.sub(r"[\r\n\t]+", " ", str(text or ""))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_items(text: str) -> list[str]:
    text = normalize_cell(text)
    if not text:
        return []
    text = re.sub(r"\s*[，,、]\s*", "  ", text)
    text = re.sub(r"\s{2,}", "  ", text)
    parts = [part.strip() for part in text.split("  ") if part.strip()]
    return parts or [text]


def guess_type(name: str, drop_kind: str) -> str:
    if drop_kind:
        return drop_kind
    if "令" in name or "凭证" in name:
        return "令牌"
    if "丹" in name or "丸" in name:
        return "丹药"
    if any(token in name for token in ["戒", "护手", "宝甲", "衣", "衫", "剑", "刀", "腕"]):
        return "装备/武学"
    if any(token in name for token in ["功", "诀", "掌", "拳", "棍", "枪", "残页", "秘籍"]):
        return "武学/内功"
    return "掉落"


RAW_ROWS = [
    ("冥离地宫", "一层", "铁马双煞 李青 成云", "10九花玉露丸", "", ""),
    ("冥离地宫", "一层", "火行者", "5金凰夺天丹", "", ""),
    ("冥离地宫", "一层", "血狼 陆杀", "聚宝阁银票", "", ""),
    ("冥离地宫", "一层", "媚骨妖女 苏离儿", "5千年灵芝丸", "", ""),
    ("冥离地宫", "一层", "嵩山派 雷凌云", "A大嵩阳掌残页", "5雪参玉蟾丸", ""),
    ("冥离地宫", "一层", "日沉阁元老 李密", "", "航线图", "？%"),
    ("冥离地宫", "一层", "华山弃徒 严剑云", "", "A混元秘籍", ""),
    ("冥离地宫", "一层", "邪僧 真贪 真淫 真色 真嗔 真杀", "一大袋元宝（888）", "", ""),
    ("冥离地宫", "一层", "魔刀 赤心真人", "", "天鹰令兑换凭证", ""),
    ("冥离地宫", "一层", "玄女 素心", "", "A太极剑谱残页", ""),
    ("冥离地宫", "一层", "杀手 墨军", "", "S真武残章", ""),
    ("冥离地宫", "一层", "龙门统领 依天", "", "S神龙掌法残页", "？%，100%"),
    ("冥离地宫", "二层", "百万剑共主 支离", "", "S支离", ""),
    ("冥离地宫", "二层", "百万剑共主 支离", "秘册", "10英雄之血", ""),
    ("冥离地宫", "二层", "燕刺王 赵螭", "A百胜刀法残页", "20帝王之血", ""),
    ("冥离地宫", "二层", "天魔 落阳", "S燃木刀诀残页", "10邀月丹 30邪魔之血", "100%，100%"),
    ("五龙塔", "", "琴武双绝 古天音", "", "S天音腕", ""),
    ("五龙塔", "", "中原大侠 秦漠", "", "A紫金戒指", ""),
    ("五龙塔", "", "中原大侠 秦漠", "", "绿心石", ""),
    ("五龙塔", "", "酒仙 叶豪 林东", "", "S醉梦神拳", ""),
    ("五龙塔", "", "佛陀转世 刹地利", "", "A归元衫", ""),
    ("五龙塔", "", "儒圣 徐舒明", "", "蓝心石", ""),
    ("五龙塔", "", "金刚不败 葛无道", "", "A玄铁护腕", ""),
    ("五龙塔", "", "南疆刀圣 苗青霜", "", "A修罗刀", ""),
    ("五龙塔", "", "始皇后人 赢荒", "", "赤血石", ""),
    ("五龙塔", "三层", "神龙教主", "", "A吹雪剑", "90%，100%"),
    ("五龙塔", "三层", "神龙教主", "S镇龙", "10子午万寿丹", ""),
    ("玄武岛", "", "盗神 袁幽冥", "A百胜刀法残页 A残月刀", "盗神宝箱概率获得 S擒龙功,八卦图解-贰", ""),
    ("玄武岛", "", "漕帮帮主 魏鸿", "A太极剑谱残页 A乌缕衣", "魏鸿宝箱概率获得 八卦图解-叁", ""),
    ("玄武岛", "", "武神 解锋", "S神龙掌法残页 A青云戒", "武神宝箱概率获得 八卦图解-壹", ""),
    ("玄武岛", "", "妖僧 法逆", "S真武残章 归元衫", "邪僧宝箱概率获得 八卦图解-肆", ""),
    ("玄武岛", "", "妖僧 法逆", "邪骨舍利 虎啸令兑换凭证 虎啸令", "", "100%，90%，10%"),
    ("玄武岛", "", "白鹿谷主 骆醉山", "A大嵩阳掌残页 A紫金护手", "八卦图解-伍", ""),
    ("玄武岛", "", "霹雳堂主 雷震天", "A寒冰神掌残页 A青云护手", "八卦图解陆", ""),
    ("玄武岛", "", "彩蝶轩圣女 江小蝶", "S燃木刀决残页 A吹雪剑", "八卦图解-柒 疾豹令兑换凭证 疾豹令", "？%，90%，10%"),
    ("玄武岛", "", "玄武尊者", "未知残页 A冰蚕手套", "八卦图解-捌 S真·玄武宝甲", "?%,10%"),
    ("凤鸣山", "", "白无常 谢必安", "子午万寿丹", "", ""),
    ("凤鸣山", "", "明心先生 林秀成", "龙虎丹", "", ""),
    ("凤鸣山", "", "紫阳真人", "邀月丹", "", ""),
    ("凤鸣山", "", "蛇骨 珠儿", "S燃木刀决残页", "", ""),
    ("凤鸣山", "", "混世魔王 柯天瑞", "30邪魔之血 天鹰令兑换凭证 天鹰令", "", "95%，5%"),
    ("凤鸣山", "", "神子 戴鸿飞", "A寒冰神掌残页", "", ""),
    ("凤鸣山", "", "拜火教主 戴炎", "S破锋八斩残页 A归元衫", "凤翔令兑换凭证 凤翔令", ""),
    ("凤鸣山", "", "玄天绝剑 谢无双", "A青云护手 A冰蚕手套", "S玄天绝剑", ""),
    ("凤鸣山", "", "国师", "S真武残章 A修罗刀", "S真·朱雀戒", ""),
    ("无间地狱", "", "鬼书生", "A赤血戒", "", ""),
    ("无间地狱", "", "奔雷盟主 雷震", "", "S奔雷", ""),
    ("无间地狱", "", "墓王钟崇 盗圣何偷月", "", "盗圣集", ""),
    ("无间地狱", "", "万花会 沈蝶衣", "", "S万花剑谱残页", ""),
    ("无间地狱", "", "贺伊 风魔十二郎", "", "多情客", ""),
    ("无间地狱", "", "鸳鸯神捕 高懿 白娘子", "凌霄", "S真·凌霄戒", ""),
    ("无间地狱", "", "妙真师太（疯）", "S邀月残章 A紫金宝戒", "", ""),
    ("无间地狱", "", "转魄剑者 徐湘妃", "S真武残章 A青冥剑", "", "10%，10%"),
    ("无间地狱", "", "转魄剑者 徐湘妃", "S离合神功", "S转魄剑法", ""),
    ("无间地狱", "", "血衣神捕 闻人异", "", "S沧澜连环枪", ""),
    ("八阵图", "", "乾卦守护 言宴", "八阵图解-乾", "八卦之力", ""),
    ("八阵图", "", "兑卦守护 符听云", "八阵图解-兑", "八卦之力", ""),
    ("八阵图", "", "离卦守护 慕", "八阵图解-离", "八卦之力", ""),
    ("八阵图", "", "震卦守护 十六", "八阵图解-震", "八卦之力", ""),
    ("八阵图", "", "巽卦守护 烟波天客", "八阵图解-巽", "八卦之力", ""),
    ("八阵图", "", "坎卦守护 无", "八阵图解-坎", "八卦之力", ""),
    ("八阵图", "", "艮卦守护 陌笙", "八阵图解-艮", "八卦之力", ""),
    ("八阵图", "", "坤卦守护 秋月曦", "八阵图解-坤", "八卦之力", ""),
    ("八阵图", "", "玄武圣使空白处 朱雀圣使奔雷大王 白虎圣使伊裴尔塔尔 青龙圣使祈与栀 武侯后人诸葛致远", "布阵图", "", ""),
    ("虎啸林", "", "镇山刀 熊开山", "A乌缕衣", "", ""),
    ("虎啸林", "", "伏虎客 罗狰", "", "S飞燕功", ""),
    ("虎啸林", "", "百毒娘子 桑青", "", "S枯木宝典", ""),
    ("虎啸林", "", "穿云剑 萧翎", "", "S渊海气功", ""),
    ("虎啸林", "", "连环刀 赵昆", "", "1～2龙虎丹 ？三世涅槃功上篇", "100%，10%"),
    ("虎啸林", "", "赶尸匠 莫老三", "", "2疾豹令兑换凭证 疾豹令", "90%，10%"),
    ("虎啸林", "", "铁罗汉 洪霸", "", "4虎啸令兑换凭证，虎啸令", "80%，20%"),
    ("虎啸林", "", "魔音先生 柳无弦", "", "曲谱（S太和引）", ""),
    ("虎啸林", "", "陷阵战神 尉迟戎", "", "S真·白虎护手", ""),
    ("虎啸林", "", "虎帅 韩啸林", "白虎军名册", "S关山月·破阵", ""),
    ("囚龙谷", "外围", "狂龙掌 石猛", "藏宝图碎片", "S狂龙功 丐帮信物", "10%，5%"),
    ("囚龙谷", "外围", "破浪刀 胡大海", "藏宝图碎片", "S大海刀诀 S破浪刀诀", "10%，5%"),
    ("囚龙谷", "外围", "追风神捕 柳追风", "藏宝图碎片", "S神捕剑招 S追风十三式", "10%，5%"),
    ("囚龙谷", "外围", "蛊月娘 阿萝依", "藏宝图碎片", "S 南疆拳掌 S蛊月剑掌", "10%，5%"),
    ("囚龙谷", "外围", "鬼影 仇无赦", "藏宝图碎片", "S神行功 S寂影玄幽诀", "10%，5%"),
    ("囚龙谷", "外围", "蔷薇剑仙 花照影", "藏宝图碎片", "S百花功 S蔷薇心经", "10%，5%"),
    ("囚龙谷", "外围", "怯薛都统 慕容飞", "藏宝图碎片", "S鲜卑枪棍 S天狼破穹枪", "10%，5%"),
    ("囚龙谷", "内围", "白眉先生 闻子墨", "研读注解", "护卫令-读 天鹰令", "100%，10%"),
    ("囚龙谷", "内围", "青禾先生 沈砚农", "耕植注解", "护卫令-耕 天鹰令", "100%，10%"),
    ("囚龙谷", "内围", "铁山翁 尉迟峰", "砍伐注解", "护卫令-樵 天鹰令", "100%，10%"),
    ("囚龙谷", "内围", "沧澜客 褚沧澜", "垂钓注解", "护卫令-渔 天鹰令", "100%，10%"),
    ("囚龙谷", "内围", "囚龙谷主 赵承晦", "羊脂白玉佩 2垂钓注解 2砍伐注解 2耕植注解 2研读注解", "天鹰令", "10%"),
]


def row_values(row: tuple[str, str, str, str, str, str]) -> list[str]:
    return [normalize_cell(value) for value in row if normalize_cell(value)]


def validate_against_cells(cells: list[str]) -> list[str]:
    cell_text = "\n".join(cells)
    missing: list[str] = []
    for row in RAW_ROWS:
        for value in row_values(row):
            if value and value not in cell_text:
                missing.append(value)
    return sorted(set(missing))


def make_id(dungeon: str, section: str, boss: str, name: str, kind: str, index: int) -> str:
    source = "-".join([dungeon, section, boss, kind, name, str(index)])
    slug = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", source).strip("-")
    return f"dungeon-drop-{slug}"


def build_records(revision: int) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row_index, (dungeon, section, boss, chest, floating, probability) in enumerate(RAW_ROWS, start=1):
        for kind, text in (("宝箱掉落", chest), ("飘字掉落", floating)):
            for item in split_items(text):
                drop_parts = [kind]
                if kind == "飘字掉落" and probability:
                    drop_parts.append(f"概率 {probability}")
                elif kind == "宝箱掉落" and not floating and probability:
                    drop_parts.append(f"概率 {probability}")
                record = {
                    "id": make_id(dungeon, section, boss, item, kind, row_index),
                    "dungeon": dungeon,
                    "section": section,
                    "boss": boss,
                    "name": item,
                    "type": guess_type(item, kind),
                    "drop": " · ".join(drop_parts),
                    "chest_drop": normalize_cell(chest),
                    "floating_drop": normalize_cell(floating),
                    "probability": normalize_cell(probability),
                    "source": "tencent_docs",
                    "source_url": DOC_URL,
                    "source_sheet_id": SHEET_ID,
                    "source_sheet": SHEET_NAME,
                    "source_revision": revision,
                }
                records.append(record)
    return records


def key(record: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return (
        record.get("dungeon", ""),
        record.get("section", ""),
        record.get("boss", ""),
        record.get("name", ""),
        record.get("type", ""),
    )


def diff_records(old: list[dict[str, Any]], new: list[dict[str, Any]]) -> dict[str, Any]:
    old_map = {key(record): record for record in old}
    new_map = {key(record): record for record in new}
    added = [new_map[item] for item in sorted(set(new_map) - set(old_map))]
    removed = [old_map[item] for item in sorted(set(old_map) - set(new_map))]
    changed = []
    for item in sorted(set(old_map) & set(new_map)):
        old_record = old_map[item]
        new_record = new_map[item]
        fields = ["drop", "chest_drop", "floating_drop", "probability", "source_revision"]
        delta = {field: [old_record.get(field, ""), new_record.get(field, "")] for field in fields if old_record.get(field, "") != new_record.get(field, "")}
        if delta:
            changed.append({"key": item, "changes": delta})
    return {"added": added, "removed": removed, "changed": changed}


def extract_revision(jsonp_path: Path | None, fallback: int) -> int:
    if not jsonp_path or not jsonp_path.exists():
        return fallback
    match = re.search(r'"rev"\s*:\s*(\d+)', jsonp_path.read_text(encoding="utf-8", errors="ignore"))
    return int(match.group(1)) if match else fallback


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 副本掉落同步报告",
        "",
        f"- 生成时间：{report['generated_at']}",
        f"- 文档：{DOC_URL}",
        f"- 工作表：{SHEET_NAME} / {SHEET_ID}",
        f"- revision：{report['source_revision']}",
        f"- 原始 related_sheet SHA-256：`{report['related_sheet_sha256']}`",
        f"- 新记录数：{report['new_count']}",
        f"- 新增：{len(report['diff']['added'])}",
        f"- 删除：{len(report['diff']['removed'])}",
        f"- 修改：{len(report['diff']['changed'])}",
        f"- 原始文本新增：{len(report['source_text_added'])}",
        f"- 原始文本删除：{len(report['source_text_removed'])}",
    ]
    if report["missing_cells"]:
        lines += ["", "## 未在原始文本中匹配到的规则值", ""]
        lines += [f"- {item}" for item in report["missing_cells"]]
    if report["diff"]["added"]:
        lines += ["", "## 新增", ""]
        lines += [f"- {item['dungeon']} / {item.get('section') or '-'} / {item['boss']} / {item['name']} / {item['drop']}" for item in report["diff"]["added"][:80]]
    if report["diff"]["removed"]:
        lines += ["", "## 删除", ""]
        lines += [f"- {item['dungeon']} / {item.get('section') or '-'} / {item['boss']} / {item['name']}" for item in report["diff"]["removed"][:80]]
    if report["source_text_added"]:
        lines += ["", "## 原始表格新增文本（需要确认是否为新 Boss、掉落或副本）", ""]
        lines += [f"- {item}" for item in report["source_text_added"][:120]]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--doc-url", default=DOC_URL)
    parser.add_argument("--sheet-id", default=SHEET_ID)
    parser.add_argument("--page", type=Path, default=Path("/tmp/tencent-drops-page.html"))
    parser.add_argument("--related-bin", type=Path, default=Path("/tmp/related0.bin"))
    parser.add_argument("--jsonp", type=Path, default=Path("/tmp/tencent-drops.jsonp"))
    parser.add_argument("--fetch", action="store_true", help="fetch the public Tencent Docs page and opendoc payload")
    parser.add_argument("--white-rabbit", type=Path, default=Path("web/whiterabbit_data.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/dungeon_drops_sync_latest.md"))
    parser.add_argument("--snapshot", type=Path, default=Path("reports/dungeon_drops_source_snapshot.json"))
    parser.add_argument("--apply", action="store_true", help="write web/whiterabbit_data.json")
    parser.add_argument("--revision", type=int, default=3425)
    args = parser.parse_args()

    if args.fetch or not args.related_bin.exists():
        try:
            fetch_related_sheet(
                args.doc_url,
                args.sheet_id,
                args.page,
                args.jsonp,
                args.related_bin,
            )
        except Exception as error:
            print(f"error: {error}", file=sys.stderr)
            return 3
    if not args.related_bin.exists():
        print(f"error: related sheet snapshot not found: {args.related_bin}", file=sys.stderr)
        return 3

    raw = args.related_bin.read_bytes()
    cells = extract_sheet_cells(raw)
    revision = extract_revision(args.jsonp, args.revision)
    new_records = build_records(revision)
    missing_cells = validate_against_cells(cells)
    previous_cells: list[str] = []
    if args.snapshot.exists():
        previous = json.loads(args.snapshot.read_text(encoding="utf-8"))
        previous_cells = previous.get("cells", [])
    source_text_added = sorted(set(cells) - set(previous_cells))
    source_text_removed = sorted(set(previous_cells) - set(cells))

    data = json.loads(args.white_rabbit.read_text(encoding="utf-8"))
    old_records = data.get("dungeon_drops", [])
    diff = diff_records(old_records, new_records)
    generated_at = datetime.now(timezone.utc).isoformat()
    source = data.setdefault("source", {})
    source["dungeon_drops"] = {
        "document": "3.1白兔版攻略汇总原件",
        "url": DOC_URL,
        "sheet": SHEET_NAME,
        "sheet_id": SHEET_ID,
        "revision": revision,
        "synced_at": generated_at,
        "related_sheet_sha256": hashlib.sha256(raw).hexdigest(),
        "record_count": len(new_records),
    }
    report = {
        "generated_at": generated_at,
        "source_revision": revision,
        "related_sheet_sha256": hashlib.sha256(raw).hexdigest(),
        "new_count": len(new_records),
        "missing_cells": missing_cells,
        "source_text_added": source_text_added,
        "source_text_removed": source_text_removed,
        "diff": diff,
    }
    write_report(args.report, report)

    if args.apply:
        data["dungeon_drops"] = new_records
        args.white_rabbit.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.snapshot.parent.mkdir(parents=True, exist_ok=True)
        args.snapshot.write_text(json.dumps({
            "document": DOC_URL,
            "sheet": SHEET_NAME,
            "sheet_id": SHEET_ID,
            "revision": revision,
            "related_sheet_sha256": hashlib.sha256(raw).hexdigest(),
            "cells": cells,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "revision": revision,
        "text_cells": len(cells),
        "records": len(new_records),
        "added": len(diff["added"]),
        "removed": len(diff["removed"]),
        "changed": len(diff["changed"]),
        "missing_cells": len(missing_cells),
        "report": str(args.report),
        "applied": args.apply,
    }, ensure_ascii=False, indent=2))
    return 0 if not missing_cells else 2


if __name__ == "__main__":
    raise SystemExit(main())
