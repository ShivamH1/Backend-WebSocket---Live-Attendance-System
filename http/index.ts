import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import {
  addStudentToClassSchema,
  AttendanceStatus,
  createClassSchema,
  loginSchema,
  Role,
  signupSchema,
  startAttendanceSchema,
} from "./types";
import { AttendanceModel, ClassModel, UserModel } from "./model";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { authMiddleware, teacherRoleMiddleware } from "./middleware";
import mongoose from "mongoose";
import expressWs from "express-ws";

let activeSession: {
  classId: string;
  startedAt: string;
  attendance: Record<string, string>;
} | null = null;

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "";
const app = express();
const wsInstance = expressWs(app);
const wsApp = wsInstance.app;

app.use(express.json());
// Parses urlencoded bodies (from HTML forms)
app.use(express.urlencoded({ extended: true }));

let allWs: any[] = [];

// Helper functions for WebSocket
function broadcast(message: object) {
  const payload = JSON.stringify(message);
  allWs.forEach((w) => w.send(payload));
}

function sendError(ws: any, message: string) {
  ws.send(JSON.stringify({ event: "ERROR", data: { message } }));
}

wsApp.ws("/ws", function (ws: any, req: any) {
  try {
    const token = req.query.token;
    const { userId, role } = jwt.verify(token, JWT_SECRET) as JwtPayload;

    ws.user = {
      userId,
      role,
    };

    allWs.push(ws);

    ws.on("close", () => {
      allWs = allWs.filter((w) => w !== ws);
    });

    ws.on("message", async (msg: any) => {
      let message: any;
      try {
        message = JSON.parse(msg.toString());
      } catch (e) {
        sendError(ws, "Invalid message format");
        return;
      }

      switch (message.event) {
        case "ATTENDANCE_MARKED": {
          // Teacher only
          if (ws.user.role !== Role.TEACHER) {
            sendError(ws, "Forbidden, teacher event only");
            return;
          }

          // Check active session
          if (!activeSession) {
            sendError(ws, "No active attendance session");
            return;
          }

          // Update in-memory attendance
          const { studentId, status } = message.data;
          activeSession.attendance[studentId] = status;

          // Broadcast to all
          broadcast({
            event: "ATTENDANCE_MARKED",
            data: { studentId, status },
          });
          break;
        }

        case "TODAY_SUMMARY": {
          // Teacher only
          if (ws.user.role !== Role.TEACHER) {
            sendError(ws, "Forbidden, teacher event only");
            return;
          }

          // Check active session
          if (!activeSession) {
            sendError(ws, "No active attendance session");
            return;
          }

          // Calculate summary
          const attendanceValues = Object.values(activeSession.attendance);
          const present = attendanceValues.filter(
            (s) => s === "present"
          ).length;
          const absent = attendanceValues.filter((s) => s === "absent").length;
          const total = attendanceValues.length;

          // Broadcast to all
          broadcast({
            event: "TODAY_SUMMARY",
            data: { present, absent, total },
          });
          break;
        }

        case "MY_ATTENDANCE": {
          // Student only
          if (ws.user.role !== Role.STUDENT) {
            sendError(ws, "Forbidden, student event only");
            return;
          }

          // Check active session
          if (!activeSession) {
            sendError(ws, "No active attendance session");
            return;
          }

          // Get student's attendance status
          const studentStatus = activeSession.attendance[ws.user.userId];

          // Unicast response to requesting student only
          ws.send(
            JSON.stringify({
              event: "MY_ATTENDANCE",
              data: {
                status: studentStatus || "not yet updated",
              },
            })
          );
          break;
        }

        case "DONE": {
          // Teacher only
          if (ws.user.role !== Role.TEACHER) {
            sendError(ws, "Forbidden, teacher event only");
            return;
          }

          // Check active session
          if (!activeSession) {
            sendError(ws, "No active attendance session");
            return;
          }

          // Get all students in the active class
          const classRoom = await ClassModel.findById(activeSession.classId);
          if (classRoom) {
            // Mark absent students who weren't marked
            for (const studentId of classRoom.studentIds) {
              const studentIdStr = studentId.toString();
              if (!activeSession.attendance[studentIdStr]) {
                activeSession.attendance[studentIdStr] = "absent";
              }
            }
          }

          // Persist to MongoDB
          const attendanceRecords = Object.entries(
            activeSession.attendance
          ).map(([studentId, status]) => ({
            classId: activeSession!.classId,
            studentId,
            status,
          }));

          if (attendanceRecords.length > 0) {
            await AttendanceModel.insertMany(attendanceRecords);
          }

          // Calculate final summary
          const finalValues = Object.values(activeSession.attendance);
          const finalPresent = finalValues.filter(
            (s) => s === "present"
          ).length;
          const finalAbsent = finalValues.filter((s) => s === "absent").length;
          const finalTotal = finalValues.length;

          // Clear active session
          activeSession = null;

          // Broadcast to all
          broadcast({
            event: "DONE",
            data: {
              message: "Attendance persisted",
              present: finalPresent,
              absent: finalAbsent,
              total: finalTotal,
            },
          });
          break;
        }

        default: {
          sendError(ws, "Unknown event");
          break;
        }
      }
    });
  } catch (error) {
    ws.send(
      JSON.stringify({
        event: "ERROR",
        data: {
          message: "Unauthorized or invalid token",
        },
      })
    );
    ws.close();
  }
});

app.post("/auth/signup", async (req: Request, res: Response) => {
  const { success, data } = signupSchema.safeParse(req.body);
  if (!success) {
    res.status(400).json({
      success: false,
      error: "Invalid request schema",
    });
    return;
  }

  const checkEmail = await UserModel.findOne({ email: data.email });
  if (checkEmail) {
    res.status(400).json({
      success: false,
      error: "Email already exists",
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await UserModel.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: data.role,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id.toString(),
      name: data.name,
      email: data.email,
      role: data.role,
    },
  });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const { success, data } = loginSchema.safeParse(req.body);
  if (!success) {
    res.status(400).json({
      success: false,
      error: "Invalid request schema",
    });
    return;
  }

  const user = await UserModel.findOne({ email: data.email });

  if (
    !user ||
    !(await bcrypt.compare(data.password, user.password as string))
  ) {
    res.status(400).json({
      success: false,
      error: "Invalid email or password",
    });
    return;
  }

  const token = jwt.sign(
    { role: user.role as Role, userId: user._id.toString() },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  res.status(200).json({
    success: true,
    data: {
      token,
    },
  });
});

app.get("/auth/me", authMiddleware, async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: "User not found",
    });
    return;
  }
  res.status(200).json({
    success: true,
    data: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role as Role,
    },
  });
});

app.post(
  "/class",
  authMiddleware,
  teacherRoleMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = createClassSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
      return;
    }

    const newClass = await ClassModel.create({
      className: data.className,
      teacherId: req.userId,
      studentIds: [],
    });

    res.status(201).json({
      success: true,
      data: {
        _id: newClass._id.toString(),
        className: data.className,
        teacherId: newClass.teacherId?.toString() || "",
        studentIds: [],
      },
    });
  }
);

app.post(
  "/class/:id/add-student",
  authMiddleware,
  teacherRoleMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = addStudentToClassSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
      return;
    }

    const studentId = data.studentId;
    const classId = req.params.id;

    const classRoom = await ClassModel.findById(classId);

    if (!classRoom) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return;
    }

    if (classRoom.teacherId?.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden, not class teacher",
      });
      return;
    }

    const checkStudent = await UserModel.findById(studentId);
    if (!checkStudent) {
      res.status(404).json({
        success: false,
        error: "Student not found",
      });
      return;
    }

    // Prevent duplicate students
    const studentIdAlreadyExists = classRoom.studentIds.some((id) => id.toString() === studentId);
    if (!studentIdAlreadyExists) {
      classRoom.studentIds.push(new mongoose.Types.ObjectId(studentId));
      await classRoom.save();
    }

    // Re-fetch to get updated document
    const updatedClassRoom = await ClassModel.findById(classId);

    res.status(200).json({
      success: true,
      data: {
        _id: updatedClassRoom!._id.toString(),
        className: updatedClassRoom!.className,
        teacherId: updatedClassRoom!.teacherId?.toString() || "",
        studentIds: updatedClassRoom!.studentIds.map((id) => id.toString()),
      },
    });
  }
);

app.get("/class/:id", authMiddleware, async (req: Request, res: Response) => {
  const classId = req.params.id;

  const classRoom = await ClassModel.findById(classId);

  if (!classRoom) {
    res.status(404).json({
      success: false,
      error: "Class not found",
    });
    return;
  }

  if (
    classRoom.teacherId?.toString() === req.userId ||
    classRoom.studentIds.some((id) => id.toString() === req.userId)
  ) {
    res.status(200).json({
      success: true,
      data: {
        _id: classRoom._id.toString(),
        className: classRoom.className,
        teacherId: classRoom.teacherId?.toString() || "",
        students: await Promise.all(
          classRoom.studentIds.map(async (id) => {
            const student = await UserModel.findById(id).lean();
            if (student) {
              return {
                _id: student._id.toString(),
                name: student.name || "",
                email: student.email || "",
              };
            }
            return { _id: id.toString() }; // fallback if not found
          })
        ),
      },
    });
  } else {
    res.status(403).json({
      success: false,
      error: "Forbidden, not class teacher",
    });
    return;
  }
});

app.get(
  "/students",
  authMiddleware,
  teacherRoleMiddleware,
  async (req: Request, res: Response) => {
    const users = await UserModel.find({ role: Role.STUDENT }).lean();
    res.status(200).json({
      success: true,
      data: users.map((user) => ({
        _id: user._id.toString(),
        name: user.name || "",
        email: user.email || "",
      })),
    });
  }
);

app.get(
  "/class/:id/my-attendance",
  authMiddleware,
  async (req: Request, res: Response) => {
    const classId = req.params.id;
    const userId = req.userId;

    // Check if student is enrolled in the class
    const classRoom = await ClassModel.findById(classId);
    if (!classRoom) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return;
    }

    if (!classRoom.studentIds.some((id) => id.toString() === userId)) {
      res.status(403).json({
        success: false,
        error: "Forbidden, not enrolled in class",
      });
      return;
    }

    const attendance = await AttendanceModel.findOne({
      classId,
      studentId: userId,
    }).lean();

    res.status(200).json({
      success: true,
      data: {
        classId: classId,
        status: attendance ? attendance.status : null,
      },
    });
  }
);

app.post(
  "/attendance/start",
  authMiddleware,
  teacherRoleMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = startAttendanceSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
      return;
    }
    const classRoom = await ClassModel.findById(data.classId);

    if (!classRoom) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return;
    }

    if (classRoom.teacherId?.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden, not class teacher",
      });
      return;
    }

    const startedAt = new Date().toISOString();
    activeSession = {
      classId: classRoom._id.toString(),
      startedAt,
      attendance: {},
    };

    res.status(200).json({
      success: true,
      data: {
        classId: classRoom._id.toString(),
        startedAt,
      },
    });
  }
);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
