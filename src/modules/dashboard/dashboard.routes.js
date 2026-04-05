const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/db");
const { authenticate, authorize } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/errorHandler");

const router = express.Router();

// Dashboard routes require at minimum VIEWER access (all authenticated users)
router.use(authenticate);

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Get overall financial summary (total income, expenses, net balance)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Financial summary
 */
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);

    const dateFilter = buildDateFilter(startDate, endDate);
    const where = { isDeleted: false, ...dateFilter };

    const [incomeResult, expenseResult, recordCount] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { ...where, type: "INCOME" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.financialRecord.aggregate({
        where: { ...where, type: "EXPENSE" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.financialRecord.count({ where }),
    ]);

    const totalIncome = Number(incomeResult._sum.amount || 0);
    const totalExpenses = Number(expenseResult._sum.amount || 0);

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpenses,
          netBalance: totalIncome - totalExpenses,
          totalRecords: recordCount,
          incomeCount: incomeResult._count,
          expenseCount: expenseResult._count,
        },
        period: { startDate: startDate || null, endDate: endDate || null },
      },
    });
  })
);

/**
 * @swagger
 * /dashboard/by-category:
 *   get:
 *     summary: Get totals broken down by category (Analyst, Admin)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Category-wise breakdown
 */
router.get(
  "/by-category",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const dateFilter = buildDateFilter(startDate, endDate);
    const where = { isDeleted: false, ...dateFilter };

    const records = await prisma.financialRecord.groupBy({
      by: ["category", "type"],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // Reshape into { category: { income, expense, net } }
    const byCategory = {};
    for (const row of records) {
      if (!byCategory[row.category]) {
        byCategory[row.category] = { category: row.category, income: 0, expense: 0, net: 0, count: 0 };
      }
      const amount = Number(row._sum.amount || 0);
      if (row.type === "INCOME") byCategory[row.category].income += amount;
      else byCategory[row.category].expense += amount;
      byCategory[row.category].net = byCategory[row.category].income - byCategory[row.category].expense;
      byCategory[row.category].count += row._count;
    }

    res.json({
      success: true,
      data: {
        categories: Object.values(byCategory).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
      },
    });
  })
);

/**
 * @swagger
 * /dashboard/monthly-trends:
 *   get:
 *     summary: Get monthly income vs expense trends (Analyst, Admin)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2024 }
 *     responses:
 *       200:
 *         description: Monthly trend data
 */
router.get(
  "/monthly-trends",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const records = await prisma.financialRecord.findMany({
      where: { isDeleted: false, date: { gte: startDate, lte: endDate } },
      select: { amount: true, type: true, date: true },
    });

    // Aggregate by month
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const label = new Date(year, m - 1).toLocaleString("default", { month: "short" });
      months[m] = { month: m, label, income: 0, expense: 0, net: 0 };
    }

    for (const record of records) {
      const month = new Date(record.date).getMonth() + 1;
      const amount = Number(record.amount);
      if (record.type === "INCOME") months[month].income += amount;
      else months[month].expense += amount;
      months[month].net = months[month].income - months[month].expense;
    }

    res.json({
      success: true,
      data: { year, trends: Object.values(months) },
    });
  })
);

/**
 * @swagger
 * /dashboard/recent:
 *   get:
 *     summary: Get recent financial activity
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Recent records
 */
router.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const records = await prisma.financialRecord.findMany({
      where: { isDeleted: false },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: { records } });
  })
);

/**
 * @swagger
 * /dashboard/weekly-trends:
 *   get:
 *     summary: Get last 12 weeks of income vs expense (Analyst, Admin)
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Weekly trend data
 */
router.get(
  "/weekly-trends",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const weeksBack = 12;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);

    const records = await prisma.financialRecord.findMany({
      where: { isDeleted: false, date: { gte: startDate } },
      select: { amount: true, type: true, date: true },
    });

    // Group by ISO week number
    const weeks = {};
    for (const record of records) {
      const d = new Date(record.date);
      const weekKey = getISOWeekKey(d);
      if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, income: 0, expense: 0, net: 0 };
      const amount = Number(record.amount);
      if (record.type === "INCOME") weeks[weekKey].income += amount;
      else weeks[weekKey].expense += amount;
      weeks[weekKey].net = weeks[weekKey].income - weeks[weekKey].expense;
    }

    const sorted = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));

    res.json({ success: true, data: { weeks: sorted } });
  })
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const date = {};
  if (startDate) date.gte = new Date(startDate);
  if (endDate) date.lte = new Date(endDate);
  return { date };
}

function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

module.exports = router;
