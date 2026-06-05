# -*- coding: utf-8 -*-
"""銷售業績.xlsx → data/sales.csv（練習三用，扁平表＋無訂單顧客 stub 列）。

教學檔的環圈圖以「全部 4,005 位顧客」計性別比例；純訂單扁平表只剩 2,943 位
有訂單的顧客，比例會失真。因此補上 1,062 位無訂單顧客的 stub 列（訂單欄空白），
報表一律以 DISTINCTCOUNT(顧客編號) 計顧客數即可逐數字重現教學檔（男 45.3%）。
另預先衍生教學檔 Power Query／「新增群組」步驟的產物：年、月、日、季、年齡層。
"""
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
XLSX = BASE / "彰師bi" / "銷售業績.xlsx"
OUT = BASE / "data" / "sales.csv"


def quarter(month: int) -> int:
    """月份 → 年中的季度（1–4）。"""
    return (month - 1) // 3 + 1


def age_band(age) -> int:
    """年齡 → 十歲一組的年齡層下限（教學檔「新增群組」bin=10 的等價結果）。"""
    return int(age) // 10 * 10


def build_flat(orders: pd.DataFrame, cust: pd.DataFrame) -> pd.DataFrame:
    flat = orders.merge(cust, on="顧客編號", how="left", validate="m:1")
    d = pd.to_datetime(flat["下單日期"])
    flat["年"], flat["月"], flat["日"] = d.dt.year, d.dt.month, d.dt.day
    flat["季"] = d.dt.month.map(quarter)

    stubs = cust[~cust["顧客編號"].isin(orders["顧客編號"])].copy()
    out = pd.concat([flat, stubs], ignore_index=True)
    out["年齡層"] = out["年齡"].map(age_band)
    # stub 列使日期衍生欄出現 NaN → 轉 nullable Int64，避免 CSV 出現 1.0 式浮點殘影
    for c in ["年", "月", "日", "季", "年齡", "年齡層", "單價", "數量"]:
        out[c] = out[c].astype("Int64")
    return out


def main():
    cust = pd.read_excel(XLSX, sheet_name="顧客資料")
    orders = pd.read_excel(XLSX, sheet_name="訂單明細")
    flat = build_flat(orders, cust)

    # --- 驗證 ---
    assert len(flat) == 5626 + 1062, len(flat)
    assert flat["顧客編號"].nunique() == 4005
    g = flat.drop_duplicates("顧客編號")["性別"].value_counts()
    assert g["Male"] == 1816 and g["Female"] == 2189, g.to_dict()
    assert abs(flat["小計"].sum() - orders["小計"].sum()) < 1e-6
    assert flat["年齡層"].between(20, 70).all()
    assert flat[flat["訂單編號"].notna()]["性別"].notna().all()

    flat.to_csv(OUT, index=False, encoding="utf-8-sig")
    print(f"sales.csv: {len(flat)} rows, {len(flat.columns)} cols")


if __name__ == "__main__":
    main()
