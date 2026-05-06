import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { getClientIp } from "../middleware/requireActive";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TTL = "1h";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signAccess(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, JWT_SECRET, { expiresIn: "30d" });
}

async function createSession(userId: string) {
  const accessToken = signAccess(userId);
  const refreshToken = signRefresh(userId);
  await prisma.userSession.create({
    data: { userId, refreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { accessToken, refreshToken };
}

async function checkBlocks(req: Request, email: string): Promise<string | null> {
  const emailBlocked = await prisma.blockedEntity.findUnique({
    where: { type_value: { type: "EMAIL", value: email } },
  });
  if (emailBlocked) return "Acceso restringido";

  const ip = getClientIp(req);
  if (ip !== "unknown") {
    const ipBlocked = await prisma.blockedEntity.findUnique({
      where: { type_value: { type: "IP", value: ip } },
    });
    if (ipBlocked) return "Acceso restringido";
  }
  return null;
}

// ── Register ──────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1).optional(),
});

router.post("/register", async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten().fieldErrors });
  }
  const { email, password, name } = parse.data;

  const blocked = await checkBlocks(req, email);
  if (blocked) return res.status(403).json({ error: blocked });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Este email ya está registrado" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });
  const { accessToken, refreshToken } = await createSession(user.id);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Credenciales inválidas" });
  }
  const { email, password } = parse.data;

  const blocked = await checkBlocks(req, email);
  if (blocked) return res.status(403).json({ error: blocked });

  const user = await prisma.user.findUnique({ where: { email } });
  const hash = user?.passwordHash ?? "$2a$12$invalidhashpadding000000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });
  if (!user.isActive) return res.status(403).json({ error: "Cuenta desactivada" });

  const { accessToken, refreshToken } = await createSession(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token provided" });

  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as { sub: string };
  } catch {
    return res.status(401).json({ error: "Refresh token inválido o expirado" });
  }

  const session = await prisma.userSession.findUnique({ where: { refreshToken } });
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: "Sesión expirada" });
  }

  const accessToken = signAccess(payload.sub);
  res.json({ accessToken });
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

// ── Biometric token ───────────────────────────────────────────────────────────
router.post("/biometric-token", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const refreshToken = signRefresh(userId);
  await prisma.userSession.create({
    data: { userId, refreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  res.json({ refreshToken });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.userSession.deleteMany({ where: { refreshToken } }).catch(() => {});
  }
  res.json({ ok: true });
});

export default router;
