import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { TokenPayload } from "./types";
import { Role } from "./types";

// This declaration is necessary to extend the built-in Express Request interface with custom properties.
// In our application, after verifying a JWT, we want to attach the authenticated user's ID (`userId`) and role (`role`) to the request object so that subsequent middleware and route handlers can access them safely and with TypeScript type support.
// By declaring this global augmentation, TypeScript recognizes our custom `userId` and `role` fields on the `Request` type throughout the project.

declare global {
  namespace Express {
    interface Request {
      userId?: string; // Custom property to store the authenticated user's ID
      role?: Role; // Custom property to store the authenticated user's role
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  // Support both "Bearer <token>" and "<token>" formats
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  if (!token) {
    res.status(401).json({
      success: false,
      error: "Unauthorized, token missing or invalid",
    });
    return;
  }

  const secret = process.env.JWT_SECRET || "";

  try {
    const { userId, role } = jwt.verify(token, secret) as TokenPayload;
    req.userId = userId;
    req.role = role;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Unauthorized, token missing or invalid",
    });
    return;
  }
};

export const teacherRoleMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.role || req.role !== Role.TEACHER) {
    res.status(403).json({
      success: false,
      error: "Forbidden, teacher access required",
    });
    return;
  }
  next();
};
