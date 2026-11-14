# Test results

Run on: 14 November 2026, local laptop (Windows, dev mode, single Node process), MongoDB and Redis in Docker.

## Automated tests (Jest + Supertest)

Command: `cd server && npm test`

```
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
Time:        49.139 s
```

![Test run](screenshots/13-tests.png)

| Suite | Tests | Covers |
|---|---|---|
| auth | 6 | register, admin role blocked at signup, duplicate email, wrong password, token check |
| courses | 6 | role guard, ownership, hidden drafts, publish rule, malformed id |
| quiz | 8 | hidden correct answers, grading (full, partial, skipped), bad input, role |
| payments | 7 | paid course cannot use free enroll, bad signature, valid signature, idempotent verify, order ownership, earnings split |
| admin | 6 | role guard, stats, no passwords in user list, cannot create admin, cannot self-delete, instructor with courses protected |

Tests run against a separate `lms_test` database. The test helper refuses to run if the database name does not end in `_test`.

## Manual tests

| Feature | Test | Result |
|---|---|---|
| Video upload | mp4 uploaded, status goes Queued, Converting, Ready, plays in browser | Pass |
| Protected stream | not enrolled gives 403, no token gives 401 | Pass |
| Live class | instructor and student join, student has no camera or mic button, chat works both ways | Pass |
| Certificate | PDF downloads, QR opens verify page, fake ID shows not valid | Pass |
| Razorpay | card success, cancelled popup, failed UPI | Pass |
| Admin | role change, course unpublish, self-delete blocked | Pass |

## Performance

### FFmpeg conversion (HLS, 360p and 720p)

Measured with `node scripts/bench-ffmpeg.js <file>`, which runs the same conversion function the worker uses.

| Clip | Resolution | Length | Raw size | HLS size | Conversion time | Speed (length / time) |
|---|---|---|---|---|---|---|
| clip1.mp4 | <res> | 74 s | 5.0 MB | 5.6 MB | 21.4 s | 3.45x |
| clip2.mp4 | <res> | 20 s | 0.9 MB | 1.1 MB | 4.6 s | 4.36x |
| clip3.mp4 | <res> | 45 s | 7.1 MB | 4.7 MB | 12.5 s | 3.59x |

Conversion runs about 3.5x to 4.4x faster than playback on this machine. The HLS folder holds both quality levels, so its size is close to the original even though it contains two encodes.

### API load test (autocannon, 20 connections, 10 seconds)

| Endpoint | Requests | Avg req/sec | Latency p50 | Latency p99 | Errors |
|---|---|---|---|---|---|
| GET /api/health | 21k | 2,112 | 6 ms | 62 ms | 0 |
| GET /api/courses | 1k | 117 | 97 ms | 897 ms | 0 |

`/api/health` does no database work, so it shows the raw server speed. `/api/courses` runs a filtered query with populate and a count on every request, and the run was in dev mode with request logging, so it is much slower. Improving it (an index on `status` and `createdAt`, caching the first page) is listed as a next step. These numbers are from one laptop and only show relative behaviour.

## Known limitations

See the README.