# -*- coding: utf-8 -*-
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from prepare_sales import quarter, age_band, build_flat


class TestHelpers(unittest.TestCase):
    def test_quarter(self):
        self.assertEqual([quarter(m) for m in (1, 3, 4, 6, 7, 9, 10, 12)],
                         [1, 1, 2, 2, 3, 3, 4, 4])

    def test_age_band(self):
        self.assertEqual([age_band(a) for a in (20, 29, 30, 76)], [20, 20, 30, 70])

    def test_build_flat_adds_stub_rows(self):
        cust = pd.DataFrame({
            "顧客編號": ["A", "B", "C"], "姓名": ["甲", "乙", "丙"],
            "性別": ["Male", "Female", "Female"], "年齡": [25, 34, 41],
            "居住地區": ["臺北市"] * 3, "職業類別": ["金融業"] * 3,
        })
        orders = pd.DataFrame({
            "訂單編號": ["O1", "O2"], "顧客編號": ["A", "A"],
            "產品編號": ["P1", "P2"], "產品名稱": ["x", "y"], "產品類別": ["童裝", "配件"],
            "單價": [100, 200], "數量": [1, 2],
            "下單日期": pd.to_datetime(["2016-01-02", "2016-05-09"]),
            "小計": [100, 400], "利潤": [10, 40], "成本": [90, 360], "明年度預期目標值": [110, 440],
        })
        flat = build_flat(orders, cust)
        self.assertEqual(len(flat), 2 + 2)                      # 2 訂單列 + 2 無訂單顧客 stub
        self.assertEqual(flat["顧客編號"].nunique(), 3)
        stub = flat[flat["訂單編號"].isna()]
        self.assertEqual(sorted(stub["顧客編號"]), ["B", "C"])
        self.assertTrue(stub["小計"].isna().all())
        a_rows = flat[flat["顧客編號"] == "A"]
        self.assertEqual(set(a_rows["性別"]), {"Male"})          # 顧客屬性已併入訂單列
        self.assertEqual(list(a_rows["季"]), [1, 2])             # 1月→Q1、5月→Q2
        self.assertEqual(set(flat["年齡層"]), {20, 30, 40})


if __name__ == "__main__":
    unittest.main(verbosity=2)
