import jwt from "jsonwebtoken";
import {
  app, request, connect, resetDb, disconnect,
  makeUser, auth, makePublishedCourse,
} from "./helpers.js";
import User from "../src/models/User.js";

beforeAll(connect);
beforeEach(resetDb);
afterAll(disconnect);

// register route admin nahi banane deta, to seedha DB me banate hain
async function makeAdmin() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "123456",
    role: "admin",
  });
  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET);
  return { id: admin._id.toString(), token };
}

describe("admin", () => {
  test("student cannot open admin stats", async () => {
    const s = await makeUser("student");
    const res = await request(app).get("/api/admin/stats").set(auth(s.token));
    expect(res.status).toBe(403);
  });

  test("admin sees platform stats", async () => {
    const a = await makeAdmin();
    await makeUser("student");
    const res = await request(app).get("/api/admin/stats").set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toBe(2);
  });

  test("user list never includes passwords", async () => {
    const a = await makeAdmin();
    const res = await request(app).get("/api/admin/users").set(auth(a.token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  test("admin cannot promote someone to admin", async () => {
    const a = await makeAdmin();
    const s = await makeUser("student");
    const res = await request(app)
      .patch(`/api/admin/users/${s.id}/role`)
      .set(auth(a.token))
      .send({ role: "admin" });
    expect(res.status).toBe(400);
  });

  test("admin cannot delete themselves", async () => {
    const a = await makeAdmin();
    const res = await request(app).delete(`/api/admin/users/${a.id}`).set(auth(a.token));
    expect(res.status).toBe(400);
  });

  test("instructor who owns courses cannot be deleted", async () => {
    const a = await makeAdmin();
    const t = await makeUser("instructor");
    await makePublishedCourse(t.token);
    const res = await request(app).delete(`/api/admin/users/${t.id}`).set(auth(a.token));
    expect(res.status).toBe(400);
  });
});