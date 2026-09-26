# Node.js Runtime Error Service & Testing Lab ⚡

A dedicated Node.js / Express backend service designed for demonstrating, reproducing, inspecting, and testing different categories of **JavaScript, V8, Node.js Native, and Asynchronous runtime errors**.

---

## 🚀 Quick Start

### 1. Install & Run
```bash
# Navigate to the service folder
cd C:\Users\serajkhan_bamboobox\.gemini\antigravity-ide\scratch\runtime-error-service

# Install dependencies (if not already installed)
npm install

# Start the server
npm start
```

Server runs on: **`http://localhost:3000`**

---

## 🌐 Features
- **Interactive Web UI**: Open `http://localhost:3000` to trigger any runtime error, view formatted stack traces, examine HTTP status codes, and copy cURL commands.
- **Full Catalog API**: `GET /api/errors` exposes metadata, descriptions, and code snippets for all scenarios.
- **Process Event Monitoring**: Catches and logs `uncaughtException` and `unhandledRejection` without immediately dropping the server unless requested with `?crash=true`.
- **System Health & Metrics**: `GET /health` displays Node version, memory heap usage, process uptime, and PID.

---

## 🧪 Supported Runtime Error Categories & Endpoints

| Category | Error Type / Name | Endpoint | Description & Trigger Cause |
|---|---|---|---|
| **JavaScript Language** | `TypeError` | `GET /api/errors/type-error` | Accessing properties of `null`/`undefined`, or invoking non-function (`?mode=call`). |
| **JavaScript Language** | `ReferenceError` | `GET /api/errors/reference-error` | Referencing an undeclared/unscoped variable. |
| **JavaScript Language** | `RangeError` | `GET /api/errors/range-error` | Invalid array length (`new Array(-5)`) or precision (`?type=precision`). |
| **JavaScript / V8** | `Stack Overflow` | `GET /api/errors/stack-overflow` | Maximum call stack size exceeded via infinite recursion. |
| **JavaScript Language** | `URIError` | `GET /api/errors/uri-error` | Malformed URI component passed to `decodeURIComponent('%')`. |
| **JavaScript Language** | `SyntaxError (Runtime)` | `GET /api/errors/syntax-error-runtime` | Evaluating invalid syntax at runtime via `eval()`. |
| **Data Serialization** | `SyntaxError (JSON)` | `GET /api/errors/json-parse-error` | Malformed JSON text passed to `JSON.parse()`. |
| **Data Serialization** | `TypeError (Circular)` | `GET /api/errors/circular-reference-error` | Serializing circular object graph with `JSON.stringify()`. |
| **Node.js System** | `SystemError (ENOENT)` | `GET /api/errors/system-fs-enoent` | Synchronous (or async via `?async=true`) missing file read via `fs`. |
| **Node.js System** | `ERR_INVALID_ARG_TYPE` | `GET /api/errors/invalid-arg-type` | Passing invalid argument types to native Node APIs (`crypto.randomBytes`). |
| **Node.js Assert** | `AssertionError` | `GET /api/errors/assertion-error` | Failed assertion condition using Node's `assert` module. |
| **HTTP Protocol** | `ERR_HTTP_HEADERS_SENT` | `GET /api/errors/headers-already-sent` | Sending response headers after response has already finished. |
| **Asynchronous** | `Unhandled Rejection` | `GET /api/errors/unhandled-rejection` | Promise rejected without `.catch()`, captured by `unhandledRejection` listener. |
| **Asynchronous** | `Uncaught Exception` | `GET /api/errors/uncaught-exception` | Error thrown in async callback (`setTimeout`) outside Express try/catch. Add `?crash=true` to kill the process. |
| **Asynchronous** | `Async/Await Rejection` | `GET /api/errors/async-await-rejection` | Async route handler rejection caught by Express error middleware. |
| **Resource & Perf** | `Event Loop Block` | `GET /api/errors/event-loop-block` | Synchronous heavy loop starving event loop (`?duration=3000` ms). |
| **Resource & Perf** | `ERR_BUFFER_TOO_LARGE` | `GET /api/errors/buffer-too-large` | Allocating buffer exceeding `buffer.constants.MAX_LENGTH`. |
| **Resource & Perf** | `Heap OOM (Crash)` | `GET /api/errors/out-of-memory?crash=true` | Unbounded memory allocation until JavaScript heap runs out. |
| **HTTP Errors** | Custom HTTP Status | `GET /api/errors/custom-http-status?status=404` | Simulates 400, 401, 403, 404, 429, 500, 502, 503. |

---

## 📡 Example cURL Commands

```bash
# 1. TypeError (Cannot read properties of null)
curl -i http://localhost:3000/api/errors/type-error

# 2. ReferenceError (Undeclared variable)
curl -i http://localhost:3000/api/errors/reference-error

# 3. Stack Overflow
curl -i http://localhost:3000/api/errors/stack-overflow

# 4. JSON Parse Error
curl -i http://localhost:3000/api/errors/json-parse-error

# 5. File System ENOENT Error
curl -i http://localhost:3000/api/errors/system-fs-enoent

# 6. Unhandled Promise Rejection
curl -i http://localhost:3000/api/errors/unhandled-rejection

# 7. Check Process Captured Logs
curl -i http://localhost:3000/api/errors/logs
```

---

## 🛡️ Express Error Handler Output Format
When handled by the server, errors return standard structured JSON with HTTP 500 (or appropriate status):

```json
{
  "success": false,
  "error": {
    "type": "TypeError",
    "name": "TypeError",
    "code": null,
    "message": "Cannot read properties of null (reading 'triggerError')",
    "statusCode": 500,
    "path": "/api/errors/type-error",
    "method": "GET",
    "timestamp": "2026-09-26T08:50:00.000Z",
    "stack": [
      "TypeError: Cannot read properties of null (reading 'triggerError')",
      "    at C:\\...\\routes\\errors.js:154:16"
    ]
  }
}
```
