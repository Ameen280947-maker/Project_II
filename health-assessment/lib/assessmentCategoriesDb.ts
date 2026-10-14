import pool from "@/lib/db";
import { listGenericTypes } from "@/lib/customAssessments";
import {
  categoryHref,
  type AssessmentCategory,
  type CategoryAssessment,
  type CategoryTheme,
} from "@/lib/assessmentCategories";

// อะไรก็ได้ที่มีเมธอด query (pool หรือ client ใน transaction)
type Queryable = Pick<typeof pool, "query">;

// แถวหมวดหมู่จากตาราง assessment_categories
export type CategoryRow = {
  id: number;
  name: string;
  subtitle: string | null;
  theme: CategoryTheme;
  routePath: string | null;
  builtIn: boolean;
};

// ดึงหมวดหมู่แบบประเมินทั้งหมดจากตาราง assessment_categories (หมวดหลักขึ้นก่อน)
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

// รวมหมวดหมู่กับแบบประเมินที่เปิดใช้งานสำหรับผู้ใช้ แยกแบบประเมินที่ไม่มีหมวดออกมาต่างหาก
export async function listPublicCategories(): Promise<{ categories: AssessmentCategory[]; uncategorized: CategoryAssessment[] }> {
  const [cats, types] = await Promise.all([listCategories(), listGenericTypes(true)]);
  // ตัดเหลือเฉพาะฟิลด์ที่หน้าผู้ใช้ต้องใช้ของแบบประเมิน
  const strip = ({ id, name, description, questions }: (typeof types)[number]): CategoryAssessment => ({ id, name, description, questions });

  // ผูกแบบประเมินเข้ากับหมวด ซ่อนหมวดที่สร้างเองแต่ไม่มีแบบประเมิน
  const categories = cats
    .map((c) => ({
      ...c,
      href: categoryHref(c),
      assessments: types.filter((t) => t.categoryId === c.id).map(strip),
    }))
    .filter((c) => c.builtIn || c.assessments.length > 0);
  // แบบประเมินที่ไม่มีหมวด หรือหมวดไม่มีอยู่แล้ว
  const known = new Set(cats.map((c) => c.id));
  const uncategorized = types.filter((t) => t.categoryId === null || !known.has(t.categoryId)).map(strip);
  return { categories, uncategorized };
}
