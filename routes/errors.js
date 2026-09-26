const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

// In-memory log of captured process-level events
const processErrorLogs = [];

function logProcessError(type, error, origin) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    type,
    name: error?.name || 'UnknownError',
    message: error?.message || String(error),
    stack: error?.stack || null,
    origin: origin || null,
  };
  processErrorLogs.unshift(entry);
  if (processErrorLogs.length > 50) processErrorLogs.pop();
  return entry;
}

// Global process listeners for uncaught errors
process.on('uncaughtException', (err, origin) => {
  console.error('[Process uncaughtException]:', err.message);
  logProcessError('uncaughtException', err, origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process unhandledRejection]:', reason?.message || reason);
  logProcessError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

// Error Catalog Metadata
const ERROR_CATALOG = [
  {
    id: 'type-error',
    name: 'TypeError',
    category: 'JavaScript Language',
    description: 'Occurs when an operation cannot be performed, e.g. reading property of null/undefined or calling a non-function.',
    snippet: 'const obj = null;\nreturn obj.nonExistentMethod();',
    endpoint: '/api/errors/type-error',
    supportedParams: ['mode (call|property)'],
  },
  {
    id: 'reference-error',
    name: 'ReferenceError',
    category: 'JavaScript Language',
    description: 'Occurs when referencing an undeclared variable or accessing a variable before its declaration (TDZ).',
    snippet: 'return undeclaredGlobalVariable.someField;',
    endpoint: '/api/errors/reference-error',
    supportedParams: [],
  },
  {
    id: 'range-error',
    name: 'RangeError',
    category: 'JavaScript Language',
    description: 'Occurs when a value is not in the set or range of allowed values (e.g. invalid array length, number precision out of bounds).',
    snippet: 'const arr = new Array(-1);',
    endpoint: '/api/errors/range-error',
    supportedParams: ['type (negative-array|precision)'],
  },
  {
    id: 'stack-overflow',
    name: 'RangeError (Stack Overflow)',
    category: 'JavaScript Language / V8',
    description: 'Occurs when the call stack exceeds its maximum limit due to deep or infinite recursion.',
    snippet: 'function recursiveCall() {\n  return recursiveCall();\n}\nrecursiveCall();',
    endpoint: '/api/errors/stack-overflow',
    supportedParams: [],
  },
  {
    id: 'uri-error',
    name: 'URIError',
    category: 'JavaScript Language',
    description: 'Occurs when global URI handling functions (such as decodeURI or decodeURIComponent) receive a malformed URI component.',
    snippet: "decodeURIComponent('%E0%A4%A'); // Incomplete UTF-8 sequence\n// or decodeURIComponent('%');",
    endpoint: '/api/errors/uri-error',
    supportedParams: [],
  },
  {
    id: 'syntax-error-runtime',
    name: 'SyntaxError (Runtime Eval)',
    category: 'JavaScript Language',
    description: 'Occurs when evaluating code with invalid syntax at runtime using eval() or Function constructor.',
    snippet: "eval('const x = = = ;');",
    endpoint: '/api/errors/syntax-error-runtime',
    supportedParams: [],
  },
  {
    id: 'json-parse-error',
    name: 'SyntaxError (JSON Parse)',
    category: 'Data & Serialization',
    description: 'Occurs when parsing malformed JSON text using JSON.parse().',
    snippet: "JSON.parse('{\"badJson\": [1, 2, }');",
    endpoint: '/api/errors/json-parse-error',
    supportedParams: [],
  },
  {
    id: 'circular-reference-error',
    name: 'TypeError (Circular JSON)',
    category: 'Data & Serialization',
    description: 'Occurs when serializing an object structure with circular references to JSON.',
    snippet: 'const circularObj = {};\ncircularObj.self = circularObj;\nJSON.stringify(circularObj);',
    endpoint: '/api/errors/circular-reference-error',
    supportedParams: [],
  },
  {
    id: 'system-fs-enoent',
    name: 'SystemError (ENOENT - File Not Found)',
    category: 'Node.js Native / System',
    description: 'Occurs when attempting an I/O operation on a non-existent file or path in the file system.',
    snippet: "fs.readFileSync(path.join(__dirname, 'imaginary-file-404.txt'), 'utf8');",
    endpoint: '/api/errors/system-fs-enoent',
    supportedParams: ['async (true|false)'],
  },
  {
    id: 'invalid-arg-type',
    name: 'TypeError [ERR_INVALID_ARG_TYPE]',
    category: 'Node.js Native / System',
    description: 'Occurs when a Node.js API function receives an argument of the wrong data type.',
    snippet: "crypto.randomBytes('not-a-number-size');",
    endpoint: '/api/errors/invalid-arg-type',
    supportedParams: [],
  },
  {
    id: 'assertion-error',
    name: 'AssertionError',
    category: 'Node.js Native / Assert',
    description: 'Occurs when an assertion condition in the node:assert module evaluates to false.',
    snippet: "assert.strictEqual({ role: 'admin' }, { role: 'guest' }, 'Permission check failed');",
    endpoint: '/api/errors/assertion-error',
    supportedParams: [],
  },
  {
    id: 'headers-already-sent',
    name: 'Error [ERR_HTTP_HEADERS_SENT]',
    category: 'HTTP & Networking',
    description: 'Occurs when an Express or Node.js HTTP handler attempts to send headers or a body after the response has already finished.',
    snippet: "res.send('Done');\nres.status(500).json({ error: 'Secondary write' });",
    endpoint: '/api/errors/headers-already-sent',
    supportedParams: [],
  },
  {
    id: 'unhandled-rejection',
    name: 'Unhandled Promise Rejection',
    category: 'Asynchronous & Promises',
    description: 'Triggered when a Promise is rejected without an attached .catch() error handler. Captured by process unhandledRejection event.',
    snippet: "new Promise((_, reject) => {\n  reject(new Error('Async job failed without a catch handler!'));\n});",
    endpoint: '/api/errors/unhandled-rejection',
    supportedParams: [],
  },
  {
    id: 'uncaught-exception',
    name: 'Uncaught Exception (Async Callback)',
    category: 'Asynchronous & Concurrency',
    description: 'Occurs when an error is thrown inside an asynchronous callback (e.g. setTimeout) outside the synchronous Express error pipeline.',
    snippet: "setTimeout(() => {\n  throw new Error('Fatal unhandled error inside setTimeout callback');\n}, 20);",
    endpoint: '/api/errors/uncaught-exception',
    supportedParams: ['crash (true|false)'],
  },
  {
    id: 'async-await-rejection',
    name: 'Async/Await Rejection',
    category: 'Asynchronous & Promises',
    description: 'An asynchronous route handler rejects with an error. In Express 5, this is routed to the error middleware automatically.',
    snippet: 'await new Promise((_, reject) => {\n  setTimeout(() => reject(new Error("Async DB query timeout")), 50);\n});',
    endpoint: '/api/errors/async-await-rejection',
    supportedParams: [],
  },
  {
    id: 'event-loop-block',
    name: 'Event Loop Block (CPU Starvation)',
    category: 'Performance & Resource Exhaustion',
    description: 'Executes a heavy synchronous computation that blocks the Node.js single-threaded event loop for a specified duration.',
    snippet: 'const end = Date.now() + 2000;\nwhile (Date.now() < end) { /* CPU burn */ }',
    endpoint: '/api/errors/event-loop-block',
    supportedParams: ['duration (ms, default 2000)'],
  },
  {
    id: 'buffer-too-large',
    name: 'RangeError [ERR_BUFFER_TOO_LARGE]',
    category: 'Performance & Resource Exhaustion',
    description: 'Occurs when attempting to allocate a Buffer larger than buffer.constants.MAX_LENGTH.',
    snippet: 'const { constants } = require("buffer");\nBuffer.alloc(constants.MAX_LENGTH + 1);',
    endpoint: '/api/errors/buffer-too-large',
    supportedParams: [],
  },
  {
    id: 'out-of-memory',
    name: 'Heap Out Of Memory (OOM)',
    category: 'Performance & Resource Exhaustion',
    description: 'Dangerous! Continuously allocates chunks of memory into an array until heap memory exhausts or process exits. Requires crash=true to run.',
    snippet: 'const leaks = [];\nwhile (true) {\n  leaks.push(Buffer.alloc(10 * 1024 * 1024));\n}',
    endpoint: '/api/errors/out-of-memory',
    supportedParams: ['crash=true (required confirmation)'],
  },
  {
    id: 'custom-http-status',
    name: 'Custom HTTP Error Status',
    category: 'HTTP & Networking',
    description: 'Simulates common HTTP error codes (400, 401, 403, 404, 429, 500, 502, 503).',
    snippet: 'const err = new Error("Resource not found");\nerr.statusCode = 404;\nthrow err;',
    endpoint: '/api/errors/custom-http-status',
    supportedParams: ['status (400|401|403|404|429|500|502|503)'],
  },
];

// Catalog endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'Node.js Runtime Error Service',
    totalErrors: ERROR_CATALOG.length,
    categories: [...new Set(ERROR_CATALOG.map((e) => e.category))],
    catalog: ERROR_CATALOG,
  });
});

// Logs of captured unhandledRejection / uncaughtException
router.get('/logs', (req, res) => {
  res.json({
    totalLogs: processErrorLogs.length,
    logs: processErrorLogs,
  });
});

router.delete('/logs', (req, res) => {
  processErrorLogs.length = 0;
  res.json({ message: 'Process error logs cleared successfully.' });
});

// 1. TypeError
router.get('/type-error', (req, res) => {
  const mode = req.query.mode || 'property';
  if (mode === 'call') {
    const notAFunction = 42;
    notAFunction(); // TypeError: notAFunction is not a function
  } else {
    const nullObject = null;
    nullObject.triggerError(); // TypeError: Cannot read properties of null (reading 'triggerError')
  }
});

// 2. ReferenceError
router.get('/reference-error', (req, res) => {
  // eslint-disable-next-line no-undef
  const result = nonExistentVariableTrigger + 10;
  res.json({ result });
});

// 3. RangeError
router.get('/range-error', (req, res) => {
  const type = req.query.type || 'negative-array';
  if (type === 'precision') {
    const num = 123.456;
    num.toFixed(200); // RangeError: toFixed() digits argument must be between 0 and 100
  } else {
    const invalidArray = new Array(-5); // RangeError: Invalid array length
    res.json({ len: invalidArray.length });
  }
});

// 4. RangeError (Stack Overflow)
router.get('/stack-overflow', (req, res) => {
  function infiniteRecursion(depth = 0) {
    return infiniteRecursion(depth + 1);
  }
  infiniteRecursion();
});

// 5. URIError
router.get('/uri-error', (req, res) => {
  // Incomplete percent-encoded sequence
    let decoded;
  try {
    decoded = decodeURIComponent('%');
  } catch (e) {
    if (e instanceof URIError) {
      decoded = 'Invalid URI component';
    } else {
      throw e;
    }
  }
  res.json({ decoded });
});

// 6. SyntaxError at Runtime
router.get('/syntax-error-runtime', (req, res) => {
  // Syntax error thrown inside runtime eval()
  // eslint-disable-next-line no-eval
  eval('const invalid = = = 123;');
});

// 7. JSON Parse SyntaxError
router.get('/json-parse-error', (req, res) => {
  const malformedJson = '{"title": "Missing closing bracket", "numbers": [1, 2, 3';
  const parsed = JSON.parse(malformedJson);
  res.json({ parsed });
});

// 8. Circular Reference TypeError
router.get('/circular-reference-error', (req, res) => {
  const nodeA = { name: 'Node A' };
  const nodeB = { name: 'Node B' };
  nodeA.neighbor = nodeB;
  nodeB.neighbor = nodeA; // Circular reference
  const serialized = JSON.stringify(nodeA);
  res.json({ serialized });
});

// 9. SystemError (ENOENT)
router.get('/system-fs-enoent', (req, res, next) => {
  const isAsync = req.query.async === 'true';
  const bogusPath = path.join(__dirname, 'non_existent_folder', 'ghost_file_' + Date.now() + '.txt');

  if (isAsync) {
    fs.readFile(bogusPath, 'utf8', (err, data) => {
      if (err) return next(err);
      res.json({ data });
    });
  } else {
    const content = fs.readFileSync(bogusPath, 'utf8');
    res.json({ content });
  }
});

// 10. Node.js Invalid Argument Type
router.get('/invalid-arg-type', (req, res) => {
  crypto.randomBytes('invalid-non-number-arg');
});

// 11. AssertionError
router.get('/assertion-error', (req, res) => {
  assert.strictEqual(
    { user: 'alice', permissions: ['read'] },
    { user: 'alice', permissions: ['read', 'write', 'admin'] },
    'User permissions assertion failed: expected admin privileges'
  );
});

// 12. HTTP Headers Already Sent
router.get('/headers-already-sent', (req, res) => {
  // Send first response
  res.status(200).send('Initial HTTP response sent successfully.');

  // Attempt to send a secondary response or header modification
  setTimeout(() => {
    try {
      res.setHeader('X-Secondary-Header', 'Forbidden');
      res.status(500).json({ error: 'Secondary response attempt' });
    } catch (err) {
      console.error('[Caught Headers Already Sent]:', err.message);
      logProcessError('ERR_HTTP_HEADERS_SENT', err);
    }
  }, 10);
});

// 13. Unhandled Promise Rejection
router.get('/unhandled-rejection', (req, res) => {
  // Create an unhandled promise rejection in the background
  const simulatedAsyncWork = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Simulated unhandled background promise rejection: Payment gateway unreachable.'));
      }, 50);
    });
  };

  simulatedAsyncWork(); // Notice: no .catch() attached!

  res.json({
    status: 'triggered',
    message: 'Unhandled promise rejection triggered in background. Captured by process.on("unhandledRejection"). Check /api/errors/logs.',
  });
});

// 14. Uncaught Exception in Async Callback
router.get('/uncaught-exception', (req, res) => {
  const crashProcess = req.query.crash === 'true';

  res.json({
    status: 'triggered',
    mode: crashProcess ? 'FATAL_CRASH (Process will exit)' : 'CAPTURED_BY_LISTENER',
    message: crashProcess
      ? 'Process-crashing exception scheduled in 100ms...'
      : 'Asynchronous uncaughtException scheduled. Captured by process.on("uncaughtException"). Check /api/errors/logs.',
  });

  setTimeout(() => {
    if (crashProcess) {
      // Remove process listener to allow default Node crash
      process.removeAllListeners('uncaughtException');
    }
    throw new Error('Asynchronous fatal callback error outside Express try/catch scope!');
  }, 100);
});

// 15. Async/Await Rejection
router.get('/async-await-rejection', async (req, res) => {
  await new Promise((_, reject) => {
    setTimeout(() => {
      const err = new Error('Database transaction timeout during async execution');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, 50);
  });
});

// 16. Event Loop Block
router.get('/event-loop-block', (req, res) => {
  const duration = Math.min(parseInt(req.query.duration, 10) || 2000, 10000); // cap at 10s
  const start = Date.now();
  let iterations = 0;

  // Synchronously lock the CPU thread
  while (Date.now() - start < duration) {
    iterations++;
    Math.sqrt(iterations);
  }

  res.json({
    status: 'completed',
    message: `Event loop was blocked for ${Date.now() - start} ms`,
    iterations,
  });
});

// 17. RangeError [ERR_BUFFER_TOO_LARGE]
router.get('/buffer-too-large', (req, res) => {
  const { constants } = require('buffer');
  Buffer.alloc(constants.MAX_LENGTH + 1000);
});

// 18. Out of Memory (Heap Exhaustion)
router.get('/out-of-memory', (req, res) => {
  const crash = req.query.crash === 'true';
  if (!crash) {
    return res.status(400).json({
      error: 'Safety Guard',
      message: 'Heap Out of Memory can crash the Node.js process. Add "?crash=true" to force execution.',
    });
  }

  res.json({
    status: 'triggered',
    message: 'Consuming heap memory until OOM occurs...',
  });

  // Allocate large chunks rapidly
  const leakBucket = [];
  while (true) {
    leakBucket.push(Buffer.alloc(20 * 1024 * 1024)); // 20MB chunks
  }
});

// 19. Custom HTTP Error Status
router.get('/custom-http-status', (req, res, next) => {
  const code = parseInt(req.query.status, 10) || 404;
  const messages = {
    400: 'Bad Request: Missing or invalid parameters in request',
    401: 'Unauthorized: Authentication token is missing or expired',
    403: 'Forbidden: Insufficient permissions to access this resource',
    404: 'Not Found: The requested entity does not exist',
    429: 'Too Many Requests: Rate limit exceeded, please retry later',
    500: 'Internal Server Error: Unexpected condition encountered',
    502: 'Bad Gateway: Upstream dependency returned an invalid response',
    503: 'Service Unavailable: Server is temporarily overloaded or undergoing maintenance',
  };

  const err = new Error(messages[code] || `Simulated HTTP Error (${code})`);
  err.statusCode = code;
  err.errorCode = 'ERR_HTTP_' + code;
  next(err);
});

module.exports = router;
