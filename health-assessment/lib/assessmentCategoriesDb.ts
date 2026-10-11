import pool from "@/lib/db";
import { listGenericTypes } from "@/lib/customAssessments";
import {
  categoryHref,
  type AssessmentCategory,
  type CategoryAssessment,
  type CategoryTheme,
} from "@/lib/assessmentCategories";

/* =========================================================
   อ่านหมวดหมู่แบบประเมินจากฐานข้อมูล (ฝั่งเซิร์ฟเวอร์เท่านั้น)
   - เรียงหมวดเดิมก่อน (ตาม display_order) แล้วตามด้วยหมวดที่ staff สร้าง (ตามลำดับที่สร้าง)
========================================================= */

type Queryable = Pick<typeof pool, "query">;

export type CategoryRow = {
  id: number;
  name: string;
  subtitle: string | null;
  theme: CategoryTheme;
  routePath: string | null;
  builtIn: boolean;
};

export async function listCategories(db: Queryable = pool): Promise<CategoryRow[]> {
  const { rows } = await db.query(
    `SELECT category_id, name, subtitle, theme, route_path, is_builtin
       FROM assessment_categories
      ORDER BY is_builtin DESC, display_order, category_id`
  );
  return rows.map((r) => ({
    id: r.category_id,
    name: r.name,
    subtitle: r.subtitle,
    theme: r.theme,
    routePath: r.route_path,
    builtIn: r.is_builtin,
  }));
}

/* ===== หมวดหมู่ + แบบประเมินที่สร้างเพิ่มและเปิดใช้งาน (สำหรับหน้าผู้ใช้) =====
   - หมวดเดิมแสดงเสมอ หมวดที่ staff สร้างแสดงเมื่อมีแบบประเมินที่เปิดใช้งานอย่างน้อย 1 แบบ
   - uncategorized = แบบประเมินที่ยังไม่มีหมวด */
export async function listPublicCategories(): Promise<{ categories: AssessmentCategory[]; uncategorized: CategoryAssessment[] }> {
  const [cats, types] = await Promise.all([listCategories(), listGenericTypes(true)]);
  const strip = ({ id, name, description, questions }: (typeof types)[number]): CategoryAssessment => ({ id, name, description, questions });

  const categories = cats
    .map((c) => ({
      ...c,
      href: categoryHref(c),
      assessments: types.filter((t) => t.categoryId === c.id).map(strip),
    }))
    .filter((c) => c.builtIn || c.assessments.length > 0);
  const known = new Set(cats.map((c) => c.id));
  const uncategorized = types.filter((t) => t.categoryId === null || !known.has(t.categoryId)).map(strip);
  return { categories, uncategorized };
}
