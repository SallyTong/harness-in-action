import { http, HttpResponse } from "msw";

const API = "http://localhost:8000";

interface Child {
  id: number;
  name: string;
  submission_count: number;
  created_at: string;
}

let nextId = 3;
let children: Child[] = [
  { id: 1, name: "小朋友1", submission_count: 0, created_at: "2026-07-01T00:00:00Z" },
  { id: 2, name: "小朋友2", submission_count: 0, created_at: "2026-07-01T00:00:00Z" },
];

function resetChildren() {
  nextId = 3;
  children = [
    { id: 1, name: "小朋友1", submission_count: 0, created_at: "2026-07-01T00:00:00Z" },
    { id: 2, name: "小朋友2", submission_count: 0, created_at: "2026-07-01T00:00:00Z" },
  ];
}

export const handlers = [
  http.get(`${API}/api/health`, () => {
    return HttpResponse.json({
      status: "ok",
      service: "ai-homework-grader",
      version: "0.1.0",
    });
  }),

  http.get(`${API}/api/children`, () => {
    return HttpResponse.json(children);
  }),

  http.post(`${API}/api/children`, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    if (!body.name || body.name.trim() === "") {
      return HttpResponse.json({ detail: "name is required" }, { status: 422 });
    }
    if (children.some((c) => c.name === body.name)) {
      return HttpResponse.json(
        { detail: "Child with this name already exists" },
        { status: 409 },
      );
    }
    const child: Child = {
      id: nextId++,
      name: body.name,
      submission_count: 0,
      created_at: new Date().toISOString(),
    };
    children.push(child);
    return HttpResponse.json(child, { status: 201 });
  }),

  http.put(`${API}/api/children/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { name: string };
    const child = children.find((c) => c.id === id);
    if (!child) {
      return HttpResponse.json({ detail: "Child not found" }, { status: 404 });
    }
    if (children.some((c) => c.name === body.name && c.id !== id)) {
      return HttpResponse.json(
        { detail: "Child with this name already exists" },
        { status: 409 },
      );
    }
    child.name = body.name;
    return HttpResponse.json(child);
  }),

  http.delete(`${API}/api/children/:id`, ({ params }) => {
    const id = Number(params.id);
    const idx = children.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json({ detail: "Child not found" }, { status: 404 });
    }
    children.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

export { resetChildren };
