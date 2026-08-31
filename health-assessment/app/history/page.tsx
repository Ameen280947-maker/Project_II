"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  Activity,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  History,
} from "lucide-react";

import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

/* =====================================================
   TYPES
===================================================== */

type HistoryItem = {
  assessment_id: number;
  user_id: number;

  total_score:
    | string
    | number
    | null;

  risk_level:
    | string
    | null;

  assessed_at: string;

  assessment_type_id: number;
  assessment_name: string;

  recommendation_id:
    | number
    | null;

  recommendation_text:
    | string
    | null;
};

type HistoryResponse = {
  success: boolean;
  total?: number;
  history?: HistoryItem[];
  message?: string;
};

/* =====================================================
   PAGE
===================================================== */

export default function HistoryPage() {
  const router = useRouter();

  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [filter, setFilter] =
    useState("ทั้งหมด");

  /* =====================================================
     LOAD HISTORY
  ===================================================== */

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const storedUserId =
          localStorage.getItem("userId");

        if (!storedUserId) {
          router.push("/login");
          return;
        }

        const userId =
          Number(storedUserId);

        if (
          !Number.isInteger(userId) ||
          userId <= 0
        ) {
          localStorage.removeItem("userId");
          router.push("/login");
          return;
        }

        const response =
          await fetch(
            `/api/history?userId=${userId}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as HistoryResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถโหลดประวัติการประเมินได้",
          );
        }

        setHistory(
          data.history ?? [],
        );
      } catch (loadError) {
        console.error(
          "LOAD HISTORY ERROR:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "ไม่สามารถโหลดประวัติการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, [router]);

  /* =====================================================
     ASSESSMENT TYPES
  ===================================================== */

  const assessmentNames =
    useMemo(() => {
      return [
        "ทั้งหมด",
        ...Array.from(
          new Set(
            history.map(
              (item) =>
                item.assessment_name,
            ),
          ),
        ),
      ];
    }, [history]);

  /* =====================================================
     FILTER
  ===================================================== */

  const filteredHistory =
    useMemo(() => {
      if (
        filter === "ทั้งหมด"
      ) {
        return history;
      }

      return history.filter(
        (item) =>
          item.assessment_name ===
          filter,
      );
    }, [history, filter]);

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        {/* =================================================
            SIDEBAR
        ================================================== */}

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================== */}

          <header>

            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Assessment History
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              ประวัติ
              <span className="text-[#ef4962]">
                การประเมิน
              </span>
            </h1>

            <p className="mt-3 text-lg text-[#85858d]">
              ดูผลการประเมินสุขภาพย้อนหลังของคุณ
            </p>

          </header>

          {/* =================================================
              SUMMARY
          ================================================== */}

          <section className="mt-8 grid gap-4 md:grid-cols-3">

            <SummaryCard
              icon={
                <ClipboardList size={25} />
              }
              title="การประเมินทั้งหมด"
              value={`${history.length}`}
              suffix="ครั้ง"
            />

            <SummaryCard
              icon={
                <Activity size={25} />
              }
              title="ประเภทที่เคยประเมิน"
              value={`${Math.max(
                assessmentNames.length - 1,
                0,
              )}`}
              suffix="ประเภท"
            />

            <SummaryCard
              icon={
                <CalendarDays size={25} />
              }
              title="ประเมินล่าสุด"
              value={
                history.length > 0
                  ? formatDateShort(
                      history[0]
                        .assessed_at,
                    )
                  : "-"
              }
            />

          </section>

          {/* =================================================
              FILTER
          ================================================== */}

          <section className="mt-7 rounded-[24px] border border-[#eee5e6] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)]">

            <p className="text-sm font-bold">
              เลือกประเภทแบบประเมิน
            </p>

            <div className="mt-4 flex flex-wrap gap-3">

              {assessmentNames.map(
                (name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setFilter(name)
                    }
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                      filter === name
                        ? "bg-[#b91c2b] text-white shadow-[0_8px_20px_rgba(185,28,43,0.2)]"
                        : "bg-[#faf7f7] text-[#74757d] hover:bg-[#fff0f2] hover:text-[#b91c2b]"
                    }`}
                  >
                    {getAssessmentDisplayName(
                      name,
                    )}
                  </button>
                ),
              )}

            </div>

          </section>

          {/* =================================================
              LOADING
          ================================================== */}

          {loading && (
            <div className="mt-7 rounded-[26px] border border-[#eee5e6] bg-white p-10 text-center">

              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#f0dadd] border-t-[#b91c2b]" />

              <p className="mt-5 font-semibold text-[#797a82]">
                กำลังโหลดประวัติการประเมิน...
              </p>

            </div>
          )}

          {/* =================================================
              ERROR
          ================================================== */}

          {error && !loading && (
            <div className="mt-7 rounded-[24px] border border-[#f2d3d7] bg-[#fff0f2] p-6 text-[#b91c2b]">

              <p className="font-bold">
                ไม่สามารถโหลดข้อมูลได้
              </p>

              <p className="mt-2 text-sm">
                {error}
              </p>

            </div>
          )}

          {/* =================================================
              EMPTY
          ================================================== */}

          {!loading &&
            !error &&
            filteredHistory.length === 0 && (
              <section className="mt-7 rounded-[28px] border border-[#eee5e6] bg-white p-12 text-center shadow-[0_14px_40px_rgba(35,25,30,0.04)]">

                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">

                  <History size={38} />

                </div>

                <h2 className="mt-5 text-2xl font-bold">
                  ยังไม่มีประวัติการประเมิน
                </h2>

                <p className="mt-3 text-[#898a92]">
                  เมื่อทำแบบประเมินแล้ว
                  ประวัติจะถูกแสดงที่หน้านี้
                </p>

                <Link
                  href="/assessment-type"
                  className="mx-auto mt-7 flex h-13 w-fit items-center justify-center rounded-2xl bg-[#b91c2b] px-7 font-bold text-white"
                >
                  เริ่มทำแบบประเมิน
                </Link>

              </section>
            )}

          {/* =================================================
              HISTORY LIST
          ================================================== */}

          {!loading &&
            !error &&
            filteredHistory.length > 0 && (
              <section className="mt-7">

                <div className="mb-4">

                  <h2 className="text-2xl font-bold">
                    รายการประเมินย้อนหลัง
                  </h2>

                  <p className="mt-1 text-sm text-[#8c8d95]">
                    พบ{" "}
                    {filteredHistory.length}{" "}
                    รายการ
                  </p>

                </div>

                <div className="space-y-4">

                  {filteredHistory.map(
                    (item) => (
                      <HistoryCard
                        key={
                          item.assessment_id
                        }
                        item={item}
                      />
                    ),
                  )}

                </div>

              </section>
            )}

        </section>
      </div>
    </main>
  );
}

/* =====================================================
   HISTORY CARD
===================================================== */

function HistoryCard({
  item,
}: {
  item: HistoryItem;
}) {
  const detailHref =
    getDetailHref(item);

  const resultStyle =
    getResultStyle(item);

  return (
    <article className="group rounded-[26px] border border-[#eee5e6] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(35,25,30,0.07)] sm:p-6">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        {/* =================================================
            LEFT
        ================================================== */}

        <div className="flex min-w-0 gap-4">

          <div
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${resultStyle.icon}`}
          >
            <ClipboardList size={26} />
          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-3">

              <h3 className="text-lg font-bold">
                {getAssessmentDisplayName(
                  item.assessment_name,
                )}
              </h3>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${resultStyle.badge}`}
              >
                {getRiskDisplayName(
                  item.risk_level,
                  item.assessment_name,
                )}
              </span>

            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#898a92]">

              <span className="flex items-center gap-2">
                <CalendarDays size={16} />

                {formatDateTime(
                  item.assessed_at,
                )}
              </span>

              <span>
                Assessment ID:{" "}
                {item.assessment_id}
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            RIGHT
        ================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

          <div
            className={`min-w-[160px] rounded-2xl px-5 py-4 ${resultStyle.box}`}
          >

            <p className="text-xs font-semibold text-[#999aa1]">
              ผลการประเมิน
            </p>

            <p
              className={`mt-1 text-xl font-black ${resultStyle.text}`}
            >
              {formatScore(item)}
            </p>

          </div>

          {/* =================================================
              DETAIL BUTTON
          ================================================== */}

          {detailHref ? (
            <Link
              href={detailHref}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-bold transition ${resultStyle.button}`}
            >
              ดูรายละเอียด

              <ChevronRight size={19} />
            </Link>
          ) : (
            <div className="flex h-12 items-center justify-center rounded-2xl bg-[#f7f5f5] px-5 text-sm font-semibold text-[#999aa1]">
              ไม่มีหน้ารายละเอียด
            </div>
          )}

        </div>

      </div>

      {/* =================================================
          RECOMMENDATION
      ================================================== */}

      {item.recommendation_text && (
        <div className="mt-5 border-t border-[#f0eaeb] pt-4">

          <p className="line-clamp-2 text-sm leading-7 text-[#797a82]">
            {item.recommendation_text}
          </p>

        </div>
      )}

    </article>
  );
}

/* =====================================================
   RESULT STYLE
===================================================== */

function getResultStyle(
  item: HistoryItem,
) {
  const risk =
    String(
      item.risk_level ?? "",
    ).toLowerCase();

  const name =
    item.assessment_name;

  /* =====================================================
     BLOOD PRESSURE
  ===================================================== */

  if (
    name === "Blood Pressure"
  ) {
    if (
      risk.includes("สูง") ||
      risk.includes("high") ||
      risk.includes("severe") ||
      risk.includes("รุนแรง")
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#b91c2b]",
        button:
          "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
      };
    }

    if (
      risk.includes("ปานกลาง") ||
      risk.includes("moderate") ||
      risk.includes("เริ่มสูง") ||
      risk.includes("elevated")
    ) {
      return {
        icon:
          "bg-[#fff8e8] text-[#a77723]",
        badge:
          "bg-[#fff8e8] text-[#a77723]",
        box:
          "bg-[#fff8e8]",
        text:
          "text-[#a77723]",
        button:
          "bg-[#fff8e8] text-[#a77723] hover:bg-[#fff1cf]",
      };
    }

    return {
      icon:
        "bg-[#eef8e9] text-[#57965c]",
      badge:
        "bg-[#eef8e9] text-[#57965c]",
      box:
        "bg-[#eef8e9]",
      text:
        "text-[#57965c]",
      button:
        "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
    };
  }

  /* =====================================================
     DIABETES
  ===================================================== */

  if (
    name === "Diabetes TDS" ||
    name === "Diabetes Risk"
  ) {
    if (
      risk.includes("very_high") ||
      risk.includes("very high") ||
      risk.includes("สูงมาก") ||
      risk.includes("รุนแรง")
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#b91c2b]",
        button:
          "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
      };
    }

    if (
      risk.includes("high") ||
      risk.includes("สูง")
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#d64b37]",
        badge:
          "bg-[#fff0f2] text-[#d64b37]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#d64b37]",
        button:
          "bg-[#fff0f2] text-[#d64b37] hover:bg-[#ffe4e8]",
      };
    }

    if (
      risk.includes("moderate") ||
      risk.includes("ปานกลาง")
    ) {
      return {
        icon:
          "bg-[#fff8e8] text-[#a77723]",
        badge:
          "bg-[#fff8e8] text-[#a77723]",
        box:
          "bg-[#fff8e8]",
        text:
          "text-[#a77723]",
        button:
          "bg-[#fff8e8] text-[#a77723] hover:bg-[#fff1cf]",
      };
    }

    return {
      icon:
        "bg-[#eef8e9] text-[#57965c]",
      badge:
        "bg-[#eef8e9] text-[#57965c]",
      box:
        "bg-[#eef8e9]",
      text:
        "text-[#57965c]",
      button:
        "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
    };
  }

  /* =====================================================
     CVD
  ===================================================== */

  if (
    name === "Thai CVD"
  ) {
    if (
      risk.includes("สูง") ||
      risk.includes("high") ||
      risk.includes("มาก")
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#b91c2b]",
        button:
          "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
      };
    }

    if (
      risk.includes("ปานกลาง") ||
      risk.includes("moderate")
    ) {
      return {
        icon:
          "bg-[#fff8e8] text-[#a77723]",
        badge:
          "bg-[#fff8e8] text-[#a77723]",
        box:
          "bg-[#fff8e8]",
        text:
          "text-[#a77723]",
        button:
          "bg-[#fff8e8] text-[#a77723] hover:bg-[#fff1cf]",
      };
    }

    return {
      icon:
        "bg-[#eef8e9] text-[#57965c]",
      badge:
        "bg-[#eef8e9] text-[#57965c]",
      box:
        "bg-[#eef8e9]",
      text:
        "text-[#57965c]",
      button:
        "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
    };
  }

  /* =====================================================
     BMI
  ===================================================== */

  if (
    name === "BMI"
  ) {
    const score =
      Number(item.total_score);

    if (
      Number.isFinite(score) &&
      score >= 25
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#b91c2b]",
        button:
          "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
      };
    }

    return {
      icon:
        "bg-[#eef8e9] text-[#57965c]",
      badge:
        "bg-[#eef8e9] text-[#57965c]",
      box:
        "bg-[#eef8e9]",
      text:
        "text-[#57965c]",
      button:
        "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
    };
  }

  /* =====================================================
     SMOKING
  ===================================================== */

  if (
    name === "Smoking"
  ) {
    if (
      risk.includes("สูง") ||
      risk.includes("high") ||
      risk.includes("มาก") ||
      risk.includes("รุนแรง")
    ) {
      return {
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        box:
          "bg-[#fff0f2]",
        text:
          "text-[#b91c2b]",
        button:
          "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
      };
    }

    if (
      risk.includes("ปานกลาง") ||
      risk.includes("moderate")
    ) {
      return {
        icon:
          "bg-[#fff8e8] text-[#a77723]",
        badge:
          "bg-[#fff8e8] text-[#a77723]",
        box:
          "bg-[#fff8e8]",
        text:
          "text-[#a77723]",
        button:
          "bg-[#fff8e8] text-[#a77723] hover:bg-[#fff1cf]",
      };
    }

    return {
      icon:
        "bg-[#eef8e9] text-[#57965c]",
      badge:
        "bg-[#eef8e9] text-[#57965c]",
      box:
        "bg-[#eef8e9]",
      text:
        "text-[#57965c]",
      button:
        "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
    };
  }

  /* =====================================================
     DEFAULT
  ===================================================== */

  const dangerous =
    risk.includes("สูง") ||
    risk.includes("high") ||
    risk.includes("อันตราย") ||
    risk.includes("รุนแรง");

  const warning =
    risk.includes("ปานกลาง") ||
    risk.includes("moderate") ||
    risk.includes("เริ่มสูง") ||
    risk.includes("elevated");

  if (dangerous) {
    return {
      icon:
        "bg-[#fff0f2] text-[#b91c2b]",
      badge:
        "bg-[#fff0f2] text-[#b91c2b]",
      box:
        "bg-[#fff0f2]",
      text:
        "text-[#b91c2b]",
      button:
        "bg-[#fff0f2] text-[#b91c2b] hover:bg-[#ffe4e8]",
    };
  }

  if (warning) {
    return {
      icon:
        "bg-[#fff8e8] text-[#a77723]",
      badge:
        "bg-[#fff8e8] text-[#a77723]",
      box:
        "bg-[#fff8e8]",
      text:
        "text-[#a77723]",
      button:
        "bg-[#fff8e8] text-[#a77723] hover:bg-[#fff1cf]",
    };
  }

  return {
    icon:
      "bg-[#eef8e9] text-[#57965c]",
    badge:
      "bg-[#eef8e9] text-[#57965c]",
    box:
      "bg-[#eef8e9]",
    text:
      "text-[#57965c]",
    button:
      "bg-[#eef8e9] text-[#57965c] hover:bg-[#e0f2dc]",
  };
}

/* =====================================================
   RISK DISPLAY NAME
===================================================== */

function getRiskDisplayName(
  riskLevel:
    | string
    | null,
  assessmentName: string,
) {
  if (!riskLevel) {
    return "ไม่ระบุ";
  }

  const risk =
    riskLevel.toLowerCase();

  /* =====================================================
     DIABETES
  ===================================================== */

  if (
    assessmentName ===
      "Diabetes TDS" ||
    assessmentName ===
      "Diabetes Risk"
  ) {
    if (
      risk === "very_high" ||
      risk.includes("very high") ||
      risk.includes("สูงมาก")
    ) {
      return "ความเสี่ยงสูงมาก";
    }

    if (
      risk === "high" ||
      risk.includes("high") ||
      risk.includes("สูง")
    ) {
      return "ความเสี่ยงสูง";
    }

    if (
      risk === "moderate" ||
      risk.includes("moderate") ||
      risk.includes("ปานกลาง")
    ) {
      return "ความเสี่ยงปานกลาง";
    }

    if (
      risk === "low" ||
      risk.includes("low") ||
      risk.includes("ต่ำ")
    ) {
      return "ความเสี่ยงต่ำ";
    }
  }

  /* =====================================================
     SMOKING
  ===================================================== */

  if (
    assessmentName ===
    "Smoking"
  ) {
    if (
      risk.includes("high") ||
      risk.includes("สูง")
    ) {
      return "ติดนิโคตินระดับสูง";
    }

    if (
      risk.includes("moderate") ||
      risk.includes("ปานกลาง")
    ) {
      return "ติดนิโคตินระดับปานกลาง";
    }

    if (
      risk.includes("low") ||
      risk.includes("ต่ำ")
    ) {
      return "ติดนิโคตินระดับต่ำ";
    }
  }

  return riskLevel;
}

/* =====================================================
   SUMMARY CARD
===================================================== */

function SummaryCard({
  icon,
  title,
  value,
  suffix,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  suffix?: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#eee5e6] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)]">

      <div className="flex items-center gap-4">

        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
          {icon}
        </div>

        <div>

          <p className="text-sm text-[#898a92]">
            {title}
          </p>

          <div className="mt-1 flex items-baseline gap-2">

            <span className="text-2xl font-black">
              {value}
            </span>

            {suffix && (
              <span className="text-sm text-[#898a92]">
                {suffix}
              </span>
            )}

          </div>

        </div>

      </div>

    </article>
  );
}

/* =====================================================
   ASSESSMENT NAME
===================================================== */

function getAssessmentDisplayName(
  assessmentName: string,
) {
  const names: Record<
    string,
    string
  > = {
    "Thai CVD":
      "โรคหัวใจและหลอดเลือด",

    "Blood Pressure":
      "ความดันโลหิต",

    BMI:
      "ภาวะน้ำหนักเกิน",

    "Diabetes TDS":
      "ความเสี่ยงโรคเบาหวาน",

    "Diabetes Risk":
      "ปัจจัยเสี่ยงโรคเบาหวาน",

    Smoking:
      "การสูบบุหรี่",

    Alcohol:
      "การดื่มแอลกอฮอล์",

    "Physical Activity":
      "กิจกรรมทางกาย",

    Sleep:
      "การนอนหลับ",

    Diet:
      "พฤติกรรมการรับประทานอาหาร",

    Stress:
      "ความเครียด",

    "PHQ-2":
      "คัดกรองภาวะซึมเศร้า 2Q",

    "9Q":
      "แบบประเมินโรคซึมเศร้า 9Q",
  };

  return (
    names[assessmentName] ??
    assessmentName
  );
}

/* =====================================================
   FORMAT SCORE
===================================================== */

function formatScore(
  item: HistoryItem,
) {
  if (
    item.total_score === null ||
    item.total_score === undefined
  ) {
    return (
      item.risk_level ??
      "-"
    );
  }

  const score =
    Number(item.total_score);

  if (
    Number.isNaN(score)
  ) {
    return String(
      item.total_score,
    );
  }

  /* =====================================================
     CVD
  ===================================================== */

  if (
    item.assessment_name ===
    "Thai CVD"
  ) {
    return `${score.toFixed(2)}%`;
  }

  /* =====================================================
     DIABETES
  ===================================================== */

  if (
    item.assessment_name ===
      "Diabetes TDS" ||
    item.assessment_name ===
      "Diabetes Risk"
  ) {
    return `${score.toFixed(2)}%`;
  }

  /* =====================================================
     BMI
  ===================================================== */

  if (
    item.assessment_name ===
    "BMI"
  ) {
    return `BMI ${score.toFixed(2)}`;
  }

  /* =====================================================
     BLOOD PRESSURE
  ===================================================== */

  if (
    item.assessment_name ===
    "Blood Pressure"
  ) {
    return getBloodPressureScoreText(
      item,
    );
  }

  /* =====================================================
     SMOKING
  ===================================================== */

  if (
    item.assessment_name ===
    "Smoking"
  ) {
    return `${score}`;
  }

  return `${score}`;
}

/* =====================================================
   BLOOD PRESSURE SCORE
===================================================== */

function getBloodPressureScoreText(
  item: HistoryItem,
) {
  const risk =
    item.risk_level ??
    "";

  return risk || "-";
}

/* =====================================================
   DATE TIME
===================================================== */

function formatDateTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

/* =====================================================
   DATE SHORT
===================================================== */

function formatDateShort(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      day: "numeric",
      month: "short",
      year: "2-digit",
    },
  ).format(date);
}

/* =====================================================
   DETAIL URL
===================================================== */

function getDetailHref(
  item: HistoryItem,
) {
  if (item.assessment_type_id === 7) {
    return `/recommendation_alcohol?assessmentId=${item.assessment_id}`;
  }

  if (item.assessment_type_id === 8) {
    return `/recommendation_physical_activity?assessmentId=${item.assessment_id}`;
  }

  if (item.assessment_type_id === 10) {
    return `/recommendation_diet?assessmentId=${item.assessment_id}`;
  }

  switch (
    item.assessment_name
  ) {

    /* =================================================
       CVD
    ================================================== */

    case "Thai CVD":
      return `/recommendation-health?assessmentId=${item.assessment_id}`;

    /* =================================================
       BLOOD PRESSURE
    ================================================== */

    case "Blood Pressure":
      return `/recommendation_DB?assessmentId=${item.assessment_id}`;

    /* =================================================
       DIABETES
       
       ใช้ recommendation_diabetes
       ไม่ใช้ assessment_diabetes/result
    ================================================== */

    case "Diabetes TDS":
      return `/recommendation_diabetes?assessmentId=${item.assessment_id}`;

    case "Diabetes Risk":
      return `/recommendation_diabetes?assessmentId=${item.assessment_id}`;

    /* =================================================
       BMI
    ================================================== */

    case "BMI":
      return `/recommendation-bmi?assessmentId=${item.assessment_id}`;

    /* =================================================
       SMOKING
    ================================================== */

    case "Smoking":
      return `/recommendation_smoking?assessmentId=${item.assessment_id}`;

    /* =================================================
       ALCOHOL
    ================================================== */

    case "Alcohol":
    case "การดื่มเครื่องดื่มแอลกอฮอล์":
    case "การดื่มแอลกอฮอล์":
      return `/recommendation_alcohol?assessmentId=${item.assessment_id}`;

    /* =================================================
       PHYSICAL ACTIVITY
    ================================================== */

    case "Physical Activity":
    case "กิจกรรมทางกาย":
    case "แบบประเมินกิจกรรมทางกาย":
    case "แบบประเมินกิจกรรมทางกายและการนอนหลับ":
      return `/recommendation_physical_activity?assessmentId=${item.assessment_id}`;

    /* =================================================
       DIET
    ================================================== */

    case "Diet":
    case "พฤติกรรมการรับประทานอาหาร":
    case "แบบประเมินพฤติกรรมการรับประทานอาหาร":
      return `/recommendation_diet?assessmentId=${item.assessment_id}`;

    /* =================================================
       OTHER
    ================================================== */

    default:
      return null;
  }
}