const express = require("express");
const { z } = require("zod");
const prisma = require("../../config/db");
const { authenticate, authorize } = require("../../middleware/auth");
const { asyncHandler, createError } = require("../../middleware/errorHandler");
const { parsePagination, buildPaginationMeta } = require("../../utils/pagination");

const router = express.Router();

router.use(authenticate);

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createRecordSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Category is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  notes: z.string().max(500).optional(),
});

const updateRecordSchema = createRecordSchema.partial();

const filterSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  category: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /records:
 *   get:
 *     summary: List financial records (Viewer, Analyst, Admin)
 *     tags: [Records]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated financial records
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filters = filterSchema.parse(req.query);
    const { page, limit, skip } = parsePagination(req.query);

    const where = { isDeleted: false };

    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [records, total] = await Promise.all([
      prisma.financialRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.financialRecord.count({ where }),
    ]);

    res.json({
      success: true,
      data: { records, pagination: buildPaginationMeta(total, page, limit) },
    });
  })
);

/**
 * @swagger
 * /records/{id}:
 *   get:
 *     summary: Get a single financial record
 *     tags: [Records]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Financial record
 *       404:
 *         description: Not found
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const record = await prisma.financialRecord.findFirst({
      where: { id: req.params.id, isDeleted: false },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!record) throw createError(404, "Record not found.");

    res.json({ success: true, data: { record } });
  })
);

/**
 * @swagger
 * /records:
 *   post:
 *     summary: Create a financial record (Analyst, Admin)
 *     tags: [Records]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount: { type: number, example: 1500.00 }
 *               type: { type: string, enum: [INCOME, EXPENSE] }
 *               category: { type: string, example: "Salary" }
 *               date: { type: string, example: "2024-03-15" }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Record created
 *       403:
 *         description: Forbidden
 */
router.post(
  "/",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const data = createRecordSchema.parse(req.body);

    const record = await prisma.financialRecord.create({
      data: {
        ...data,
        amount: data.amount,
        date: new Date(data.date),
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json({ success: true, message: "Record created.", data: { record } });
  })
);

/**
 * @swagger
 * /records/{id}:
 *   patch:
 *     summary: Update a financial record (Analyst can edit own, Admin can edit all)
 *     tags: [Records]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               type: { type: string, enum: [INCOME, EXPENSE] }
 *               category: { type: string }
 *               date: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Record updated
 */
router.patch(
  "/:id",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const data = updateRecordSchema.parse(req.body);

    const existing = await prisma.financialRecord.findFirst({
      where: { id: req.params.id, isDeleted: false },
    });

    if (!existing) throw createError(404, "Record not found.");

    // Analysts can only edit their own records; Admins can edit any
    if (req.user.role === "ANALYST" && existing.createdById !== req.user.id) {
      throw createError(403, "Analysts can only edit their own records.");
    }

    const record = await prisma.financialRecord.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.date ? { date: new Date(data.date) } : {}),
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    res.json({ success: true, message: "Record updated.", data: { record } });
  })
);

/**
 * @swagger
 * /records/{id}:
 *   delete:
 *     summary: Soft-delete a financial record (Analyst own records, Admin all)
 *     tags: [Records]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Record deleted
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  authorize("ANALYST"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.financialRecord.findFirst({
      where: { id: req.params.id, isDeleted: false },
    });

    if (!existing) throw createError(404, "Record not found.");

    if (req.user.role === "ANALYST" && existing.createdById !== req.user.id) {
      throw createError(403, "Analysts can only delete their own records.");
    }

    await prisma.financialRecord.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: "Record deleted." });
  })
);

module.exports = router;
