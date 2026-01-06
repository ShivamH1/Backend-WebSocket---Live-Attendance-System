import mongoose from "mongoose";
import { Role, AttendanceStatus } from "./types";

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/classRoom")
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error(err);
  });

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  role: {
    type: String,
    enum: Object.values(Role),
  },
});

const classSchema = new mongoose.Schema({
  className: String,
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  studentIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
  ],
});

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classes",
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  status: {
    type: String,
    enum: Object.values(AttendanceStatus),
  },
});

export const UserModel = mongoose.model("Users", userSchema);
export const ClassModel = mongoose.model("Classes", classSchema);
export const AttendanceModel = mongoose.model("Attendances", attendanceSchema);
