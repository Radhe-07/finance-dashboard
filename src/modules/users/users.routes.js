const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const prisma = require("../../config/db");
const { authenticate, authorize } = require("../../middleware/auth");
const { asyncHandler, createError } = require("../../middleware/errorHandler");
const { parsePagination, buildPaginationMeta } = require("../../utils/pagination");

const router = express.Router();

// All user management routes require authentication
router.use(authenticate);

// ─── Validation Schemas ────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["VIEWER", "ANALYST", "ADMIN"]).default("VIEWER"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["VIEWER", "ANALYST", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Paginated list of users
 *       403:
 *         description: Forbidden
 */
router.get(
  "/",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.status) where.status = req.query.status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: { users, pagination: buildPaginationMeta(total, page, limit) },
    });
  })
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *     responses:
 *       201:
 *         description: User created
 */
router.post(
  "/",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: data.role },
      select: USER_SELECT,
    });

    res.status(201).json({ success: true, message: "User created.", data: { user } });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: Not found
 */
router.get(
  "/:id",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: USER_SELECT,
    });

    if (!user) throw createError(404, "User not found.");

    res.json({ success: true, data: { user } });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update a user (Admin only)
 *     tags: [Users]
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
 *               name: { type: string }
 *               email: { type: string }
 *               role: { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch(
  "/:id",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);

    // Prevent admins from deactivating themselves
    if (req.params.id === req.user.id && data.status === "INACTIVE") {
      throw createError(400, "You cannot deactivate your own account.");
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: USER_SELECT,
    });

    res.json({ success: true, message: "User updated.", data: { user } });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Deactivate a user (Admin only, soft delete via status)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deactivated
 */
router.delete(
  "/:id",
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      throw createError(400, "You cannot deactivate your own account.");
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "INACTIVE" },
    });

    res.json({ success: true, message: "User deactivated." });
  })
);

module.exports = router;
