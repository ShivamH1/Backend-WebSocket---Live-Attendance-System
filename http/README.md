# Attendance Management API

A REST API for managing classroom attendance built with Bun, Express, and MongoDB.

## Getting Started

### Install dependencies

```bash
bun install
```

### Environment Variables

Create a `.env` file:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/attendance
JWT_SECRET=your-secret-key
```

### Run the server

```bash
bun run index.ts
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## JWT Authentication

### JWT Payload Structure

```json
{
  "userId": "MONGODB_OBJECT_ID",
  "role": "teacher" | "student"
}
```

### HTTP Requests

Send token via header (no Bearer prefix):

```
Authorization: <JWT_TOKEN>
```

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | ❌ | Register a new user |
| POST | `/auth/login` | ❌ | Login and get token |
| GET | `/auth/me` | ✅ | Get current user info |

### Classes

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/class` | ✅ | Teacher | Create a new class |
| GET | `/class/:id` | ✅ | Any | Get class details |
| POST | `/class/:id/add-student` | ✅ | Teacher | Add student to class |

### Students

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/students` | ✅ | Teacher | List all students |

### Attendance

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/attendance/start` | ✅ | Teacher | Start attendance session |
| GET | `/class/:id/my-attendance` | ✅ | Student | Get own attendance status |

---

## Request & Response Examples

### POST `/auth/signup`

Register a new user (teacher or student).

**Request:**
```json
{
  "name": "Rahul",
  "email": "rahul@example.com",
  "password": "password123",
  "role": "student"
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "_id": "u123",
    "name": "Rahul",
    "email": "rahul@example.com",
    "role": "student"
  }
}
```

**Duplicate Email (400):**
```json
{
  "success": false,
  "error": "Email already exists"
}
```

---

### POST `/auth/login`

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "rahul@example.com",
  "password": "password123"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "token": "JWT_TOKEN_HERE"
  }
}
```

**Invalid Credentials (400):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

### GET `/auth/me`

Get the authenticated user's profile.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "_id": "u123",
    "name": "Rahul",
    "email": "rahul@example.com",
    "role": "student"
  }
}
```

---

### POST `/class`

Create a new class (teacher only).

**Request:**
```json
{
  "className": "Maths 101"
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "_id": "c101",
    "className": "Maths 101",
    "teacherId": "t11",
    "studentIds": []
  }
}
```

---

### POST `/class/:id/add-student`

Add a student to a class (teacher only, must own the class).

**Request:**
```json
{
  "studentId": "s100"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "_id": "c101",
    "className": "Maths 101",
    "teacherId": "t11",
    "studentIds": ["s100"]
  }
}
```

---

### GET `/class/:id`

Get class details (must be teacher or enrolled student).

**Success (200):**
```json
{
  "success": true,
  "data": {
    "_id": "c101",
    "className": "Maths 101",
    "teacherId": "t11",
    "students": [
      {
        "_id": "s100",
        "name": "Rahul",
        "email": "rahul@test.com"
      }
    ]
  }
}
```

---

### GET `/students`

List all students (teacher only).

**Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "s100",
      "name": "Rahul",
      "email": "rahul@test.com"
    }
  ]
}
```

---

### POST `/attendance/start`

Start an attendance session for a class (teacher only, must own the class).

**Request:**
```json
{
  "classId": "c101"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "classId": "c101",
    "startedAt": "2025-03-11T10:00:00.000Z"
  }
}
```

---

### GET `/class/:id/my-attendance`

Get the authenticated student's attendance status for a class (must be enrolled).

**Success (200) - Attendance Persisted:**
```json
{
  "success": true,
  "data": {
    "classId": "c101",
    "status": "present"
  }
}
```

**Success (200) - Not Persisted Yet:**
```json
{
  "success": true,
  "data": {
    "classId": "c101",
    "status": null
  }
}
```

---

## Error Responses

| Status | Error Message | Description |
|--------|---------------|-------------|
| 400 | `Invalid request schema` | Zod validation failed |
| 400 | `Email already exists` | Duplicate email on signup |
| 400 | `Invalid email or password` | Login failed |
| 401 | `Unauthorized, token missing or invalid` | No token provided |
| 401 | `Unauthorized, invalid token` | Token verification failed |
| 403 | `Forbidden, teacher access required` | Role check failed |
| 403 | `Forbidden, not class teacher` | Ownership check failed |
| 403 | `Forbidden, not enrolled in class` | Student not in class |
| 404 | `Class not found` | Class doesn't exist |
| 404 | `User not found` | User doesn't exist |
| 404 | `Student not found` | Student doesn't exist |

---

## In-Memory Attendance State

The server maintains a single global state for the active session:

```javascript
const activeSession = {
  classId: "c101",
  startedAt: "2025-03-11T10:00:00.000Z", // ISO string
  attendance: {
    "s100": "present",
    "s101": "absent"
  }
};
```

- Only ONE session active at a time
- `startedAt` is an ISO string

---

## WebSocket Server

### Connection URL

```
ws://localhost:3000/ws?token=<JWT_TOKEN>
```

### Connection Flow

1. Client connects with JWT token in query parameter
2. Server verifies JWT - if invalid, sends ERROR and closes connection
3. Server attaches user info (`userId`, `role`) to the WebSocket
4. Connection ready to send/receive messages

### Message Format

All WebSocket messages use this format:

```json
{
  "event": "EVENT_NAME",
  "data": { ... }
}
```

---

## WebSocket Events

### ATTENDANCE_MARKED

**Direction:** Teacher → Server → Broadcast to ALL

Mark a student's attendance.

**Send:**
```json
{
  "event": "ATTENDANCE_MARKED",
  "data": {
    "studentId": "s100",
    "status": "present"
  }
}
```

**Broadcast:**
```json
{
  "event": "ATTENDANCE_MARKED",
  "data": {
    "studentId": "s100",
    "status": "present"
  }
}
```

---

### TODAY_SUMMARY

**Direction:** Teacher → Server → Broadcast to ALL

Request today's attendance summary.

**Send:**
```json
{
  "event": "TODAY_SUMMARY"
}
```

**Broadcast:**
```json
{
  "event": "TODAY_SUMMARY",
  "data": {
    "present": 18,
    "absent": 4,
    "total": 22
  }
}
```

---

### MY_ATTENDANCE

**Direction:** Student → Server → Response to THAT student only (unicast)

Student checks their own attendance status.

**Send:**
```json
{
  "event": "MY_ATTENDANCE"
}
```

**Response:**
```json
{
  "event": "MY_ATTENDANCE",
  "data": {
    "status": "present"
  }
}
```

**If not marked yet:**
```json
{
  "event": "MY_ATTENDANCE",
  "data": {
    "status": "not yet updated"
  }
}
```

---

### DONE

**Direction:** Teacher → Server → Persist to DB → Broadcast to ALL

End attendance session. Persists all records to MongoDB and marks unmarked students as absent.

**Send:**
```json
{
  "event": "DONE"
}
```

**Broadcast:**
```json
{
  "event": "DONE",
  "data": {
    "message": "Attendance persisted",
    "present": 18,
    "absent": 4,
    "total": 22
  }
}
```

---

## WebSocket Errors

**Error Message Format:**
```json
{
  "event": "ERROR",
  "data": {
    "message": "Error description"
  }
}
```

| Error Message | Description |
|---------------|-------------|
| `Unauthorized or invalid token` | Invalid JWT on connection |
| `Forbidden, teacher event only` | Non-teacher sent teacher event |
| `Forbidden, student event only` | Non-student sent student event |
| `No active attendance session` | No session started via `/attendance/start` |

---

## Roles

| Role | Value |
|------|-------|
| Teacher | `teacher` |
| Student | `student` |

---

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** Express.js + express-ws
- **Database:** MongoDB (Mongoose)
- **Auth:** JWT (jsonwebtoken)
- **Validation:** Zod
- **Password Hashing:** bcrypt
- **WebSocket:** express-ws
