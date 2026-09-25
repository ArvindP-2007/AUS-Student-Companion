import { describe, expect, it } from "vitest";
import { validateBackup } from "./backup";
import { makeDemoBackup } from "./demo";

const sid = "123e4567-e89b-42d3-a456-426614174000";
const cid = "123e4567-e89b-42d3-a456-426614174001";
const base = {
  version: 1,
  exportedAt: "2026-09-25T12:00:00.000Z",
  activeSemesterId: sid,
  data: {
    semesters: [
      {
        id: sid,
        name: "Fall 2026",
        academic_year: "2026–2027",
        start_date: "2026-08-20",
        end_date: "2026-12-20",
      },
    ],
    courses: [
      {
        id: cid,
        semester_id: sid,
        code: "CMP 220",
        name: "Programming II",
        credits: 3,
      },
    ],
    meetings: [],
    categories: [],
    items: [],
    notes: [],
    events: [],
    settings: null,
  },
};
describe("backup validation", () => {
  it("accepts a connected backup", () =>
    expect(validateBackup(base).data.courses).toHaveLength(1));
  it("rejects a missing parent before database changes", () =>
    expect(() =>
      validateBackup({ ...base, data: { ...base.data, semesters: [] } }),
    ).toThrow("missing semester"));
  it("rejects duplicate identifiers", () =>
    expect(() =>
      validateBackup({
        ...base,
        data: {
          ...base.data,
          courses: [base.data.courses[0], base.data.courses[0]],
        },
      }),
    ).toThrow("duplicate"));
  it("keeps optional sample data internally consistent", () =>
    expect(validateBackup(makeDemoBackup()).data.items).toHaveLength(10));
});
