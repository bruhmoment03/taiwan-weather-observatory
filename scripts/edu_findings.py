# -*- coding: utf-8 -*-
"""從 data/edu/*.csv 計算期末報告引用的關鍵統計，輸出 report/findings_stats.txt。"""
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
EDU = BASE / "data" / "edu"
OUTDIR = BASE / "report"


def main():
    OUTDIR.mkdir(exist_ok=True)
    users = pd.read_csv(EDU / "edu_users.csv")
    act = pd.read_csv(EDU / "edu_activity.csv")
    video = pd.read_csv(EDU / "edu_video.csv")
    diff = pd.read_csv(EDU / "edu_difficulty.csv")
    lines = []
    w = lines.append

    w("== 主題1 使用概況 ==")
    w(f"使用者 {users['使用者編號'].nunique()} 人、學校 {users['學校代碼'].nunique()} 所，年級分布:")
    w(users.groupby('年級')['使用者編號'].count().to_string())
    w("各平臺活動量:"); w(act['平臺'].value_counts().to_string())
    w("各行為類型活動量:"); w(act['行為類型'].value_counts().to_string())
    w("星期分布:"); w(act['星期'].value_counts().to_string())
    w("時段分布:"); w(act['時段'].value_counts().to_string())
    w("活動量前 5 週:"); w(act['週次'].value_counts().head(5).to_string())
    w("活動量後 3 週(非零):"); w(act['週次'].value_counts().tail(3).to_string())

    w("\n== 主題2 行為×成績（皮爾森相關，成績缺漏列排除）==")
    for b in ["練習次數", "練習平均正確率", "影片瀏覽次數", "影片平均完成率", "總活動量"]:
        for s in ["國文成績", "數學成績", "英語成績"]:
            sub = users[[b, s]].dropna()
            w(f"corr({b},{s}) = {sub[b].corr(sub[s]):.3f}  (n={len(sub)})")
    w("參與度分組平均成績:")
    w(users.groupby("參與度分組", observed=True)[["國文成績", "數學成績", "英語成績"]].mean().round(1).to_string())
    w("參與度分組人數與成績樣本數:")
    w(users.groupby("參與度分組", observed=True)
      .agg(人數=("使用者編號", "count"), 國文n=("國文成績", "count"),
           數學n=("數學成績", "count"), 英語n=("英語成績", "count")).to_string())

    w("\n== 主題3 影片行為 ==")
    w(f"影片瀏覽 {len(video)} 次、平均完成率 {video['完成率'].mean():.1f}%、>=90% 比率 {(video['完成率']>=90).mean()*100:.1f}%、<10% 比率 {(video['完成率']<10).mean()*100:.1f}%")
    w("各科平均完成率與瀏覽數:")
    w(video.groupby("科目").agg(瀏覽數=("影片瀏覽編號", "count"), 平均完成率=("完成率", "mean")).round(1).to_string())
    w("最常被倒轉影片 Top10:")
    w(video.groupby("影片名稱")["倒轉次數"].sum().sort_values(ascending=False).head(10).to_string())
    w("筆記次數最多影片 Top5:")
    w(video.groupby("影片名稱")["筆記次數"].sum().sort_values(ascending=False).head(5).to_string())
    w("行為事件總量: " + ", ".join(f"{c}={int(video[c].sum())}" for c in
      ["播放次數", "暫停次數", "倒轉次數", "快轉次數", "筆記次數", "檢核點作答次數"]))

    w("\n== 主題4 難點 ==")
    ind = diff[(diff["類型"] == "能力指標") & (diff["嘗試次數"] >= 30)]
    w(f"能力指標共 {len(diff[diff['類型']=='能力指標'])} 項（嘗試>=30 者 {len(ind)} 項）")
    w("最弱能力指標 Top10（嘗試>=30，正確率遞增）:")
    w(ind.nsmallest(10, "正確率")[["名稱", "科目", "嘗試次數", "正確率"]].to_string(index=False))
    w("各科正確率（能力指標加權平均）:")
    sub = diff[diff["類型"] == "能力指標"].groupby("科目").apply(
        lambda d: round((d["嘗試次數"] - d["錯誤次數"]).sum() / d["嘗試次數"].sum() * 100, 1),
        include_groups=False)
    w(sub.to_string())
    w("最難英文單字 Top10（依錯誤次數）:")
    w(diff[diff["類型"] == "英文單字"].nlargest(10, "錯誤次數")[["名稱", "嘗試次數", "錯誤次數", "正確率"]].to_string(index=False))
    w("數學單元正確率（遞增）:")
    w(diff[diff["類型"] == "數學單元"].sort_values("正確率")[["名稱", "嘗試次數", "正確率"]].to_string(index=False))

    text = "\n".join(lines)
    (OUTDIR / "findings_stats.txt").write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
