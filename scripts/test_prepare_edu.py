# -*- coding: utf-8 -*-
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from prepare_edu import parse_iso_duration, parse_binary_res, time_cols


class TestHelpers(unittest.TestCase):
    def test_iso_duration(self):
        self.assertEqual(parse_iso_duration("PT0M21S"), 21)
        self.assertEqual(parse_iso_duration("PT5S"), 5)
        self.assertEqual(parse_iso_duration("PT1M35S"), 95)
        self.assertEqual(parse_iso_duration("PT2H1M35S"), 7295)
        self.assertIsNone(parse_iso_duration("garbage"))
        self.assertIsNone(parse_iso_duration(None))
        self.assertIsNone(parse_iso_duration(float("nan")))

    def test_binary_res(self):
        self.assertEqual(parse_binary_res("1@XX@1@XX@"), (2, 2))
        self.assertEqual(parse_binary_res("0@XX@0@XX@"), (2, 0))
        self.assertEqual(parse_binary_res("0@XX@1@XX@"), (2, 1))
        self.assertEqual(parse_binary_res(""), (0, 0))
        self.assertEqual(parse_binary_res(None), (0, 0))

    def test_time_cols(self):
        s = pd.Series(["2024-09-02 13:49:10", "2025-01-27 05:07:23", None])
        t = time_cols(s)
        self.assertEqual(t.loc[0, "年"], 2024)
        self.assertEqual(t.loc[0, "月"], 9)
        self.assertEqual(t.loc[0, "星期"], "週一")   # 2024-09-02 是週一
        self.assertEqual(t.loc[0, "時段"], "下午")   # 13 時
        self.assertEqual(t.loc[1, "星期"], "週一")   # 2025-01-27 是週一
        self.assertEqual(t.loc[1, "時段"], "凌晨")   # 5 時
        self.assertEqual(t.loc[0, "週次"], "2024-W36")
        self.assertTrue(pd.isna(t.loc[2, "年"]))

    def test_to_naive_taipei(self):
        from prepare_edu import to_naive_taipei
        s = pd.Series(["2024-09-05T15:34:49.000+08:00", None])
        out = to_naive_taipei(s)
        self.assertEqual(out.iloc[0], pd.Timestamp("2024-09-05 15:34:49"))
        self.assertTrue(out.dt.tz is None)
        self.assertTrue(pd.isna(out.iloc[1]))

    def test_ms_to_taipei(self):
        from prepare_edu import ms_to_taipei
        s = pd.Series([1731849144077, "1731849144077", None])
        out = ms_to_taipei(s)
        self.assertEqual(out.iloc[0], pd.Timestamp("2024-11-17 21:12:24.077"))
        self.assertEqual(out.iloc[1], pd.Timestamp("2024-11-17 21:12:24.077"))
        self.assertTrue(pd.isna(out.iloc[2]))

    def test_time_cols_int_dtypes_and_tz(self):
        s = pd.Series(["2024-09-02 13:49:10"])
        t = time_cols(s)
        self.assertEqual(str(t["年"].dtype), "Int64")
        self.assertEqual(str(t["月"].dtype), "Int64")
        # tz-aware 輸入：轉台北、去時區、牆鐘時間不變
        s2 = pd.Series(pd.to_datetime(["2024-09-05T15:34:49.000+08:00"], utc=True))
        t2 = time_cols(s2)
        self.assertEqual(t2.loc[0, "時間"], pd.Timestamp("2024-09-05 15:34:49"))
        self.assertEqual(t2.loc[0, "時段"], "下午")

    def test_week_iso_year_boundary(self):
        # 2024-12-30 屬 ISO 2025-W01；年欄仍為 2024（已知且接受的差異）
        t = time_cols(pd.Series(["2024-12-30 10:00:00"]))
        self.assertEqual(t.loc[0, "週次"], "2025-W01")
        self.assertEqual(t.loc[0, "年"], 2024)


if __name__ == "__main__":
    unittest.main(verbosity=2)
