import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import pg from "pg";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
const route =
  (f: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(f(req, res)).catch(next);
  };
const idSchema = z.string().uuid();
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};

const leadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(2).max(80),
  people: z.number().int().min(1).max(50),
  budget_minor: z.number().int().min(0).max(100000000),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "Date",
    ),
  email: z.string().email().max(160),
});
const leadStatus = z.object({
  status: z.enum(["new", "discuss", "booked", "complete"]),
});
async function init() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS leads(id uuid PRIMARY KEY,name text NOT NULL,destination text NOT NULL,people integer NOT NULL,budget_minor bigint NOT NULL,date date NOT NULL,email text NOT NULL,status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());CREATE TABLE IF NOT EXISTS trips(id uuid PRIMARY KEY,title text NOT NULL,date date NOT NULL,guide text NOT NULL,capacity integer NOT NULL,route jsonb NOT NULL);CREATE TABLE IF NOT EXISTS guests(id uuid PRIMARY KEY,trip_id uuid NOT NULL REFERENCES trips(id),name text NOT NULL,checked boolean NOT NULL DEFAULT false)`,
  );
  const leads = [
    [
      "Елена Соколова",
      "Стамбул",
      2,
      16800000,
      "2026-10-18",
      "elena@example.com",
      "new",
    ],
    [
      "Андрей Лебедев",
      "Алтай",
      4,
      24600000,
      "2026-10-22",
      "andrey@example.com",
      "new",
    ],
    [
      "Мария Волкова",
      "Карелия",
      2,
      9200000,
      "2026-10-15",
      "maria@example.com",
      "discuss",
    ],
    [
      "Денис Крылов",
      "Дагестан",
      3,
      18400000,
      "2026-10-20",
      "denis@example.com",
      "discuss",
    ],
    [
      "Ольга Белова",
      "Казань",
      2,
      7800000,
      "2026-10-12",
      "olga@example.com",
      "booked",
    ],
    [
      "Ирина Морозова",
      "Карелия",
      1,
      4600000,
      "2026-10-15",
      "irina@example.com",
      "booked",
    ],
    [
      "Павел Орлов",
      "Санкт-Петербург",
      2,
      6800000,
      "2026-10-01",
      "pavel@example.com",
      "complete",
    ],
  ];
  for (const [i, row] of leads.entries())
    await pool.query(
      `INSERT INTO leads(id,name,destination,people,budget_minor,date,email,status)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(id)DO NOTHING`,
      [`20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, ...row],
    );
  const trip = "30000000-0000-4000-8000-000000000001";
  await pool.query(
    `INSERT INTO trips(id,title,date,guide,capacity,route)VALUES($1,$2,$3,$4,$5,$6)ON CONFLICT(id)DO NOTHING`,
    [
      trip,
      "Выходные в Карелии",
      "2026-10-15",
      "Алексей Миронов",
      12,
      JSON.stringify([
        {
          time: "09:00",
          title: "Встреча у вокзала",
          note: "Сбор группы и знакомство",
        },
        { time: "11:30", title: "Горный парк", note: "Прогулка по маршруту" },
        {
          time: "14:00",
          title: "Обед у озера",
          note: "Остановка и свободное время",
        },
        {
          time: "17:30",
          title: "Возвращение в город",
          note: "Завершение первого дня",
        },
      ]),
    ],
  );
  for (const [i, name] of [
    "Мария Волкова",
    "Ирина Морозова",
    "Антон Сергеев",
    "Вера Лазарева",
    "Максим Громов",
    "Нина Климова",
    "Олег Комаров",
    "Софья Романова",
  ].entries())
    await pool.query(
      `INSERT INTO guests(id,trip_id,name,checked)VALUES($1,$2,$3,$4)ON CONFLICT(id)DO NOTHING`,
      [
        `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        trip,
        name,
        i < 3,
      ],
    );
}
const normalizeLead = (r: Record<string, unknown>) => ({
  ...r,
  budget_minor: Number(r.budget_minor),
});
app.get(
  "/api/leads",
  route(async (_req, res) => {
    res.json(
      (
        await pool.query(
          `SELECT *,to_char(date,'YYYY-MM-DD')AS date FROM leads ORDER BY updated_at DESC,id`,
        )
      ).rows.map(normalizeLead),
    );
  }),
);
app.post(
  "/api/leads",
  route(async (req, res) => {
    const l = leadSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO leads(id,name,destination,people,budget_minor,date,email,status)VALUES($1,$2,$3,$4,$5,$6,$7,'new')RETURNING *,to_char(date,'YYYY-MM-DD')AS date`,
      [
        randomUUID(),
        l.name,
        l.destination,
        l.people,
        l.budget_minor,
        l.date,
        l.email,
      ],
    );
    res.status(201).json(normalizeLead(result.rows[0]));
  }),
);
app.patch(
  "/api/leads/:id",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const { status } = leadStatus.parse(req.body);
    const result = await pool.query(
      `UPDATE leads SET status=$1,updated_at=now()WHERE id=$2 RETURNING *,to_char(date,'YYYY-MM-DD')AS date`,
      [status, id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Заявка не найдена" });
      return;
    }
    res.json(normalizeLead(result.rows[0]));
  }),
);
app.get(
  "/api/trips",
  route(async (_req, res) => {
    const trips = (
      await pool.query(
        `SELECT *,to_char(date,'YYYY-MM-DD')AS date FROM trips ORDER BY trips.date`,
      )
    ).rows;
    for (const t of trips)
      t.guests = (
        await pool.query(
          `SELECT id,name,checked FROM guests WHERE trip_id=$1 ORDER BY id`,
          [t.id],
        )
      ).rows;
    res.json(trips);
  }),
);
app.patch(
  "/api/guests/:id",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const { checked } = z.object({ checked: z.boolean() }).parse(req.body);
    const result = await pool.query(
      `UPDATE guests SET checked=$1 WHERE id=$2 RETURNING id,name,checked`,
      [checked, id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Участник не найден" });
      return;
    }
    res.json(result.rows[0]);
  }),
);

app.get(
  "/api/health",
  route(async (_req, res) => {
    await pool.query(`SELECT 1`);
    res.json({ status: "ok" });
  }),
);
app.use(express.static(resolve("dist")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  res.sendFile(resolve("dist/index.html"));
});
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Некорректный JSON" });
    return;
  }
  if (error instanceof z.ZodError) {
    res
      .status(400)
      .json({
        error: "Проверьте заполнение полей",
        fields: error.issues.map((i) => i.path.join(".")),
      });
    return;
  }
  console.error(error instanceof Error ? error.message : "Request failed");
  res.status(500).json({ error: "Не удалось выполнить операцию" });
});
await init();
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("roam-crm ready"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
