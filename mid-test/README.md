# Live Attendance System - Test Suite

This test suite validates any server implementation against the Live Attendance System specification.

## Prerequisites

- Node.js 18+ 
- Your server must be running on `http://localhost:3000` (or configure via environment variables)
- MongoDB must be connected to your server

## Installation

```bash
npm install
```

## Running Tests

1. **Start your server** on port 3000 (default)
2. **Run the tests:**

```bash
npm test
```

### Watch Mode (for development)

```bash
npm run test:watch
```

## Configuration

By default, tests connect to:
- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

To test against a different server, set environment variables:

```bash
SERVER_URL=http://localhost:4000 WS_URL=ws://localhost:4000/ws npm test
```

## Test Coverage

The test suite covers:

### Authentication (9 tests)
- POST /auth/signup - validation, duplicate email, success
- POST /auth/login - validation, wrong credentials, success
- GET /auth/me - unauthorized, success

### Class Management (14 tests)
- POST /class - teacher only, validation, success
- POST /class/:id/add-student - ownership, validation, not found, success
- GET /class/:id - access control, not found, success

### Students (3 tests)
- GET /students - teacher only, success

### Attendance HTTP (6 tests)
- POST /attendance/start - ownership, validation, success
- GET /class/:id/my-attendance - enrollment check, success

### WebSocket (25+ tests)
- Connection - valid/invalid tokens
- ATTENDANCE_MARKED - teacher only, broadcast, no session error
- TODAY_SUMMARY - teacher only, broadcast, correct counts
- MY_ATTENDANCE - student only, unicast, status check
- DONE - persist to DB, mark absent, clear session
- Error handling - unknown events, invalid format

### End-to-End (1 test)
- Complete workflow from signup to attendance persistence

## Expected Behavior

Tests verify that your server follows the exact response format specified:

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
  "error": "Error message",
}
```

### WebSocket Message Format
```json
{
  "event": "EVENT_NAME",
  "data": { ... }
}
```

## Notes

- Tests use unique emails for each test run to avoid conflicts
- WebSocket tests may timeout if your server is slow - increase timeout in `vitest.config.js` if needed
- The test suite assumes only ONE active attendance session at a time (as per spec)

