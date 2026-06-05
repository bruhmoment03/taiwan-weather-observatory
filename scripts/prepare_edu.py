# -*- coding: utf-8 -*-
"""教育大數據 2025 微學程開放資料 → Power BI 分析就緒表。

輸入：彰師bi/2025教育大數據微學程教學用開放資料/*.csv（tab 分隔，不入庫）
輸出：data/edu/{edu_activity,edu_users,edu_video,edu_difficulty}.csv（UTF-8 BOM）
（每個前處理步驟同時是期末報告「二、資料來源與前處理」一節的素材。）
"""
import re
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "彰師bi" / "2025教育大數據微學程教學用開放資料"
OUT = BASE / "data" / "edu"

SLOTS = [(0, 6, "凌晨"), (6, 12, "上午"), (12, 18, "下午"), (18, 24, "晚上")]
WEEKDAY = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"]

USER_RENAME = {
    "user_sn": "使用者編號", "organization_id": "學校代碼", "grade": "年級",
    "class": "班級", "chinese_score": "國語成績", "math_score": "數學成績",
    "english_score": "英語成績",
}


def read_tsv(name: str) -> pd.DataFrame:
    return pd.read_csv(SRC / f"{name}.csv", sep="\t", low_memory=False)


def parse_iso_duration(s):
    """ISO8601 時長（'PT2H1M35S'/'PT0M21S'/'PT5S'）→ 秒；無法解析 → None。"""
    if not isinstance(s, str):
        return None
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", s)
    if not m or not any(m.groups()):
        return None
    h, mi, sec = (float(g) if g else 0.0 for g in m.groups())
    return h * 3600 + mi * 60 + sec


def parse_binary_res(s):
    """'1@XX@0@XX@'（字面 @XX@ 分隔、尾隨分隔符）→ (題數, 答對數)。"""
    if not isinstance(s, str):
        return (0, 0)
    items = [x for x in s.split("@XX@") if x in ("0", "1")]
    return (len(items), sum(int(x) for x in items))


def time_cols(ts: pd.Series) -> pd.DataFrame:
    """datetime-like Series → DataFrame(時間, 年, 月, 週次, 星期, 時段)。"""
    ts = pd.to_datetime(ts, errors="coerce")
    iso = ts.dt.isocalendar()
    week = iso.year.astype("Int64").astype(str) + "-W" + iso.week.astype("Int64").astype(str).str.zfill(2)
    week = week.where(ts.notna())
    slot = ts.dt.hour.map(
        lambda h: next(lab for lo, hi, lab in SLOTS if lo <= h < hi) if pd.notna(h) else None
    )
    return pd.DataFrame({
        "時間": ts,
        "年": ts.dt.year,
        "月": ts.dt.month,
        "週次": week,
        "星期": ts.dt.weekday.map(lambda d: WEEKDAY[int(d)] if pd.notna(d) else None),
        "時段": slot,
    })


def to_naive_taipei(s: pd.Series) -> pd.Series:
    """含 +08:00 時區的 ISO 字串 → 台北時間 naive datetime。"""
    return pd.to_datetime(s, errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)


def ms_to_taipei(s: pd.Series) -> pd.Series:
    """Unix 毫秒（UTC）→ 台北時間 naive datetime。"""
    return pd.to_datetime(s, unit="ms", errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)
