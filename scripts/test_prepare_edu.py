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


if __name__ == "__main__":
    unittest.main(verbosity=2)
