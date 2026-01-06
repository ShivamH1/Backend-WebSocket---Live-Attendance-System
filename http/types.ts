import { z } from "zod";

export enum Role {
  TEACHER = "teacher",
  STUDENT = "student",
}

export enum AttendanceStatus {
  PRESENT = "present",
  ABSENT = "absent",
}

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export interface TokenPayload {
  role: Role;
  userId: string;
}

export const createClassSchema = z.object({
  className: z.string().min(1),
});

export const addStudentToClassSchema = z.object({
  studentId: z.string(),
});

export const startAttendanceSchema = z.object({
  classId: z.string(),
});
