# Reflection: Akash Sharma

## What I owned
I took complete ownership of this project from end to end—from ideation, wireframing, and database design to writing the backend API, setting up asynchronous workers, and crafting the frontend user experience. 

Specifically, I owned:
- **Full-Stack Implementation:** Built the client using React (Vite), Redux Toolkit, and Tailwind CSS, and developed the backend services using Express 5, MongoDB (Mongoose), and Redis with BullMQ.
- **System Architecture & Security:** Designed the three-tier role-based access control (Student, Instructor, Admin), route guards, server-side grading integrity, and protected video streaming endpoints.
- **External Integrations:** Integrated LiveKit for real-time WebRTC live classes, Razorpay for payment checkouts with cryptographic verification, and PDFKit for dynamic, QR-verifiable certificate generation.

There were three parts of the build that were especially satisfying and fun to see working:
1. **The Video Transcoding Flow:** Uploading a raw MP4 file as an instructor, watching BullMQ and FFmpeg pick up the job and transcode it into 360p and 720p HLS ladders in the background, and then immediately logging in with a student account to watch it play seamlessly with adaptive bitrate streaming.
2. **Live Classroom Experience:** Starting a live class session as an instructor and joining from another incognito window as a student, seeing real-time low-latency video and audio connect via LiveKit, and having two-way chat work with strict publisher controls.
3. **Razorpay Checkout & Earnings:** Purchasing a paid course in test mode, watching the server securely verify the HMAC-SHA256 signature, instantly enrolling the student, and watching the instructor's earnings and platform fees update accurately on the dashboard.

## The hardest problem and how I solved it
The most frustrating issue I ran into occurred when local environment variables started colliding with production settings, which caused worker queues and automated test cases to behave unpredictably. 

At one point, my local background worker was picking up jobs tied to different configurations, and test suites would pass when run individually but fail or corrupt data when run together because Redis connection strings and database instances were bleeding into each other. It created a confusing loop of phantom bugs.

To solve this, I stepped back and restructured the configuration layer:
- **Strict Environment Isolation:** I updated the test harness so that tests exclusively connect to a dedicated `lms_test` database, adding a hard safeguard in the test runner that refuses to execute unless the database name ends with `_test`.
- **Dedicated Queue Namespaces:** I separated queue naming conventions between development, testing, and production so workers would never ingest jobs outside their intended scope.
- **Clean Configuration Hierarchy:** Audited all environment variables, standardized `.env.example`, and ensured secrets and paths were cleanly scoped.

Another challenging area was **Schema Design & Data Consistency in MongoDB**. Designing relationships between Courses, Lessons, Quizzes, Attempts, and Enrollments required careful thinking. For example, calculating a student's course progress accurately without doing expensive real-time queries across multiple collections every time was tricky. I solved this by tracking completed lesson references atomically using `$addToSet` in the `Enrollment` model and ensuring quiz completions updated progress idempotently, preventing duplicate attempts from inflating completion percentages.

## What I learned
- **Asynchronous Architecture is Essential:** Heavy tasks like media transcoding cannot live inside the standard HTTP request-response cycle. Learning how to decouple workloads using Redis queues and BullMQ workers showed me how real production backends maintain responsiveness under heavy tasks.
- **Zero Trust on the Client:** Prior to this project, it was tempting to rely on frontend state for checks. Building this LMS reinforced that every critical business rule—quiz answer evaluation, payment verification, course ownership, and video segment delivery—must be strictly enforced on the server.
- **Handling Real-Time Protocols:** Integrating WebRTC through LiveKit gave me a deep appreciation for how audio/video rooms work, how token permissions control publishing rights, and how to manage connection states cleanly in React.

## Where I used AI tools and where I worked it out myself
I used AI as an engineering collaborator and sounding board rather than a copy-paste generator:

- **Where I worked it out myself:**
  - **Core Vision & User Flows:** I defined how the platform should feel—the instructor's course creation flow, how a draft becomes published, how quizzes gate certificates, and how the earnings dashboard calculates platform fees.
  - **System Logic & Architecture Decisions:** Deciding how roles interact, structuring MongoDB schemas, writing route middleware, and connecting client-side actions to Redux slices were all thought out and implemented by me.
  - **Debugging & Final Decision-Making:** Whenever an implementation trade-off came up, I made the final architectural calls based on the project's actual requirements.

- **Where I used AI tools:**
  - **Feature Discovery & Requirements Gathering:** Early on, I used AI to brainstorm what a complete, modern LMS needs, helping me map out requirements like adaptive HLS streaming, verifiable certificates, and token-based WebRTC rooms.
  - **Implementation Approaches:** When deciding how to implement specific features (for example, how to pass authentication headers to video streams using `hls.js` or structuring BullMQ retry options), I asked AI for pattern suggestions, evaluated the pros and cons, and then wrote the tailored solution myself.
  - **Comprehensive Test Case Generation:** Writing repetitive test assertions manually is time-consuming. I used AI to help bootstrap edge-case test suites for Jest and Supertest across authentication, route permissions, and quiz grading, which allowed me to achieve full coverage (33 out of 33 passing tests) much faster.

## What I would do differently
If I were starting this project from scratch today, there are three key things I would do differently:
1. **Adopt TypeScript from Day 1:** As the project grew across 8 Mongoose models, multiple Redux state slices, and custom API payloads, tracking types manually became prone to small runtime typos. Having strict interfaces would have caught issues at compile time.
2. **Design for Cloud Storage (S3 / CloudFront) Early:** Because I didn't have an AWS account, I built the pipeline around local file storage and an authenticated API stream route. While it works reliably, deploying to Render's ephemeral free-tier disk demonstrated why cloud object storage with pre-signed URLs should be designed into the architecture from the very first commit.
3. **Use httpOnly Cookies for Authentication:** Storing JWTs in `localStorage` was quick to get up and running, but using secure, `httpOnly`, `SameSite` cookies from the start would provide better defense-in-depth against XSS vulnerabilities.
