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


def parse_iso_duration(s) -> float | None:
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
    """datetime-like Series → DataFrame(時間, 年, 月, 週次, 星期, 時段)。naive 輸入視為台北牆鐘時間；tz-aware 輸入轉台北後去時區。週次採 ISO 週（跨年週以 ISO 年標記，可能與「年」欄不同）。"""
    ts = pd.to_datetime(ts, errors="coerce")
    if isinstance(ts.dtype, pd.DatetimeTZDtype):
        ts = ts.dt.tz_convert("Asia/Taipei").dt.tz_localize(None)
    iso = ts.dt.isocalendar()
    week = iso.year.astype("Int64").astype(str) + "-W" + iso.week.astype("Int64").astype(str).str.zfill(2)
    week = week.where(ts.notna())
    slot = ts.dt.hour.map(
        lambda h: next(lab for lo, hi, lab in SLOTS if lo <= h < hi) if pd.notna(h) else None
    )
    return pd.DataFrame({
        "時間": ts,
        "年": ts.dt.year.astype("Int64"),
        "月": ts.dt.month.astype("Int64"),
        "週次": week,
        "星期": ts.dt.weekday.map(lambda d: WEEKDAY[int(d)] if pd.notna(d) else None),
        "時段": slot,
    })


def to_naive_taipei(s: pd.Series) -> pd.Series:
    """含 +08:00 時區的 ISO 字串 → 台北時間 naive datetime。"""
    return pd.to_datetime(s, errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)


def ms_to_taipei(s: pd.Series) -> pd.Series:
    """Unix 毫秒（UTC）→ 台北時間 naive datetime。"""
    ms = pd.to_numeric(s, errors="coerce")
    return pd.to_datetime(ms, unit="ms", errors="coerce", utc=True).dt.tz_convert("Asia/Taipei").dt.tz_localize(None)


PLATFORM_EVENTS = [
    # (來源檔, 平臺, 行為類型, 時間欄, 時間轉換)
    ("dp001_prac", "dp001 影音學習", "練習作答", "date", None),
    ("dp001_review", "dp001 影音學習", "影片瀏覽", "start_time", None),
    ("dp002_exam", "dp002 測驗平臺", "測驗作答", "action_time", "iso"),
    ("dp003_word", "dp003 遊戲學習", "單字遊戲", "start_timestamp", None),
    # dp003_math 無動作時間欄；以 last_modified（伺服器寫入時間, Unix ms）作代理時間戳
    ("dp003_math", "dp003 遊戲學習", "數學遊戲", "last_modified", "ms"),
    ("dp004_interaction", "dp004 綜合學習", "回答問題", "timestamp", "iso"),
    ("dp004_video", "dp004 綜合學習", "觀看影片", "timestamp", "iso"),
    ("dp004_webpage", "dp004 綜合學習", "瀏覽資源", "timestamp", "iso"),
]


def build_activity(users: pd.DataFrame) -> pd.DataFrame:
    parts = []
    for name, platform, action, tcol, conv in PLATFORM_EVENTS:
        df = read_tsv(name)
        t = df[tcol]
        if conv == "iso":
            t = to_naive_taipei(t)
        elif conv == "ms":
            t = ms_to_taipei(t)
        part = pd.DataFrame({"使用者編號": df["user_sn"], "平臺": platform, "行為類型": action})
        part = pd.concat([part.reset_index(drop=True), time_cols(t).reset_index(drop=True)], axis=1)
        parts.append(part)
    act = pd.concat(parts, ignore_index=True)
    return act.merge(users[["使用者編號", "學校代碼", "年級", "班級"]], on="使用者編號", how="left")


def build_users(users: pd.DataFrame) -> pd.DataFrame:
    prac = read_tsv("dp001_prac")
    review = read_tsv("dp001_review")
    plus = read_tsv("dp001_review_plus")

    prac_g = prac.groupby("user_sn").agg(
        練習次數=("prac_sn", "count"),
        練習平均正確率=("score_rate", "mean"),
        練習總秒數=("during_time", "sum"),
    )
    review = review.assign(covered=(review["end_timestamp"] - review["start_timestamp"]).clip(lower=0))
    rev_g = review.groupby("user_sn").agg(
        影片瀏覽次數=("review_sn", "count"),
        影片觀看總秒數=("covered", "sum"),
        影片平均完成率=("finish_rate", "mean"),
    )
    # review_plus 沒有 user_sn → 經 review_sn 接回使用者
    plus_u = plus.merge(review[["review_sn", "user_sn"]], on="review_sn", how="inner")
    # 使用者層只彙總 4 種閱聽行為；build_video 另有含 play/chkptstart 的版本（刻意分開）
    ACTION_LABEL = {"dragleft": "倒轉次數", "dragright": "快轉次數", "paused": "暫停次數", "note": "筆記次數"}
    plus_g = (
        plus_u[plus_u["view_action"].isin(ACTION_LABEL)]
        .groupby(["user_sn", "view_action"]).size().unstack(fill_value=0)
        .rename(columns=ACTION_LABEL)
    )
    exam2 = read_tsv("dp002_exam")
    exam2_sec = exam2.assign(sec=exam2["result_duration"].map(parse_iso_duration))
    counts = {
        "單字遊戲次數": read_tsv("dp003_word").groupby("user_sn").size(),
        "數學遊戲次數": read_tsv("dp003_math").groupby("user_sn").size(),
        "測驗作答次數": exam2.groupby("user_sn").size(),
        "測驗總秒數": exam2_sec.groupby("user_sn")["sec"].sum(),
        "綜合平臺活動數": pd.concat([
            read_tsv("dp004_interaction")["user_sn"],
            read_tsv("dp004_video")["user_sn"],
            read_tsv("dp004_webpage")["user_sn"],
        ]).value_counts(),
    }
    out = users.set_index("使用者編號")
    for g in (prac_g, rev_g, plus_g):
        out = out.join(g.rename_axis("使用者編號"))
    for col, s in counts.items():
        out[col] = s.rename_axis("使用者編號")

    count_cols = ["練習次數", "練習總秒數", "影片瀏覽次數", "影片觀看總秒數", "倒轉次數",
                  "快轉次數", "暫停次數", "筆記次數", "單字遊戲次數", "數學遊戲次數",
                  "測驗作答次數", "測驗總秒數", "綜合平臺活動數"]
    for c in count_cols:
        if c not in out.columns:
            out[c] = 0
        out[c] = out[c].fillna(0).astype(int)
    out["練習平均正確率"] = out["練習平均正確率"].round(1)
    out["影片平均完成率"] = out["影片平均完成率"].round(1)
    for c in ["國語成績", "數學成績", "英語成績"]:
        out[c] = out[c].astype("Int64")
    out["總活動量"] = (out["練習次數"] + out["影片瀏覽次數"] + out["單字遊戲次數"]
                      + out["數學遊戲次數"] + out["測驗作答次數"] + out["綜合平臺活動數"])
    out["參與度分組"] = pd.qcut(out["總活動量"].rank(method="first"), 4,
                              labels=["Q1 低", "Q2 中低", "Q3 中高", "Q4 高"])
    return out.reset_index()


def build_video(users: pd.DataFrame) -> pd.DataFrame:
    review = read_tsv("dp001_review")
    plus = read_tsv("dp001_review_plus")
    ACTION_LABEL = {"play": "播放次數", "paused": "暫停次數", "dragleft": "倒轉次數",
                    "dragright": "快轉次數", "note": "筆記次數", "chkptstart": "檢核點作答次數"}
    acts = (
        plus[plus["view_action"].isin(ACTION_LABEL)]
        .groupby(["review_sn", "view_action"]).size().unstack(fill_value=0)
        .rename(columns=ACTION_LABEL)
    )
    v = review.rename(columns={
        "review_sn": "影片瀏覽編號", "user_sn": "使用者編號", "subject_name": "科目",
        "video_name": "影片名稱", "video_len": "影片長度秒", "finish_rate": "完成率",
    })
    v = pd.concat([v.reset_index(drop=True), time_cols(review["start_time"]).reset_index(drop=True)], axis=1)
    v = v.merge(acts.rename_axis("影片瀏覽編號"), left_on="影片瀏覽編號", right_index=True, how="left")
    for c in ACTION_LABEL.values():
        if c not in v.columns:
            v[c] = 0
        v[c] = v[c].fillna(0).astype(int)
    v = v.merge(users[["使用者編號", "學校代碼", "年級"]], on="使用者編號", how="left")
    keep = ["影片瀏覽編號", "使用者編號", "學校代碼", "年級", "科目", "影片名稱", "影片長度秒",
            "完成率", "時間", "年", "月", "週次", "星期", "時段", *ACTION_LABEL.values()]
    return v[keep]


def build_difficulty() -> pd.DataFrame:
    prac = read_tsv("dp001_prac")
    nb = prac["binary_res"].map(parse_binary_res)
    prac = prac.assign(題數=nb.map(lambda t: t[0]), 答對數=nb.map(lambda t: t[1]))
    ind = prac.groupby(["indicator_name", "subject_name"], as_index=False).agg(
        嘗試次數=("題數", "sum"), 答對數=("答對數", "sum"))
    ind = ind[ind["嘗試次數"] > 0].assign(
        類型="能力指標",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"indicator_name": "名稱", "subject_name": "科目"})

    word = read_tsv("dp003_word")
    wg = word.groupby("target_vocabulary", as_index=False).agg(
        嘗試次數=("is_correct", "count"), 答對數=("is_correct", "sum"))
    wg = wg.assign(
        類型="英文單字", 科目="英語",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"target_vocabulary": "名稱"})

    math = read_tsv("dp003_math")
    mg = math.groupby("unit_name", as_index=False).agg(
        嘗試次數=("is_correct", "count"), 答對數=("is_correct", "sum"))
    mg = mg.assign(
        類型="數學單元", 科目="數學",
        錯誤次數=lambda d: d["嘗試次數"] - d["答對數"],
        正確率=lambda d: (d["答對數"] / d["嘗試次數"] * 100).round(1),
    ).rename(columns={"unit_name": "名稱"})

    cols = ["類型", "名稱", "科目", "嘗試次數", "錯誤次數", "正確率"]
    return pd.concat([ind[cols], wg[cols], mg[cols]], ignore_index=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    users = read_tsv("user_data").rename(columns=USER_RENAME)

    activity = build_activity(users)
    users_out = build_users(users)
    video = build_video(users)
    difficulty = build_difficulty()

    # --- 驗證 ---
    expected_rows = 6624 + 4567 + 41864 + 2140 + 1365 + 15392 + 6086 + 23642
    assert len(activity) == expected_rows, f"activity rows {len(activity)} != {expected_rows}"
    assert len(users_out) == 313 and users_out["使用者編號"].is_unique, \
        f"users rows={len(users_out)}, unique={users_out['使用者編號'].is_unique}"
    assert users_out[["國語成績", "數學成績", "英語成績"]].isna().sum().tolist() == [120, 45, 112], \
        f"missing={users_out[['國語成績','數學成績','英語成績']].isna().sum().tolist()}"
    assert (users_out["總活動量"] >= 0).all() and (users_out["練習總秒數"] >= 0).all()
    assert users_out["參與度分組"].value_counts().min() >= 78  # 四分位每組約 78
    assert len(video) == 4567 and (video["完成率"].dropna() >= 0).all(), f"video rows={len(video)}"
    assert (difficulty["正確率"].between(0, 100)).all(), "正確率 out of [0,100]"
    assert set(activity["平臺"].unique()) == {"dp001 影音學習", "dp002 測驗平臺", "dp003 遊戲學習", "dp004 綜合學習"}, \
        f"platforms={sorted(activity['平臺'].unique())}"

    for name, df in [("edu_activity", activity), ("edu_users", users_out),
                     ("edu_video", video), ("edu_difficulty", difficulty)]:
        df.to_csv(OUT / f"{name}.csv", index=False, encoding="utf-8-sig")
        print(f"{name}.csv: {len(df)} rows, {len(df.columns)} cols")


if __name__ == "__main__":
    main()
