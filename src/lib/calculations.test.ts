import { describe, expect, it } from "vitest";
import {
  AUS_SCALE,
  calculateGpa,
  calculateWeightedGrade,
  deadlineState,
} from "./calculations";

describe("AUS GPA", () => {
  it("weights letter points by credits and excludes non-GPA grades", () => {
    const result = calculateGpa(
      [
        { credits: 3, final_grade: "A" },
        { credits: 4, final_grade: "B+" },
        { credits: 3, final_grade: "P" },
        { credits: 2, final_grade: null },
      ],
      AUS_SCALE,
    );
    expect(result.credits).toBe(7);
    expect(result.qualityPoints).toBeCloseTo(25.2);
    expect(result.gpa).toBeCloseTo(3.6);
  });
  it("shows no GPA until a course has a final grade", () =>
    expect(calculateGpa([{ credits: 3, final_grade: null }]).gpa).toBeNull());
});
describe("weighted grades", () => {
  it("excludes ungraded items and identifies an incomplete syllabus", () => {
    const result = calculateWeightedGrade(
      [
        { id: "a", name: "Quizzes", weight: 20 },
        { id: "b", name: "Final", weight: 40 },
      ],
      [
        { category_id: "a", score: 18, max_score: 20 },
        { category_id: "a", score: null, max_score: 20 },
        { category_id: "b", score: null, max_score: 100 },
      ],
    );
    expect(result.percent).toBe(90);
    expect(result.countedWeight).toBe(20);
    expect(result.configuredWeight).toBe(60);
    expect(result.provisional).toBe(true);
  });
  it("normalizes the currently graded categories", () => {
    const result = calculateWeightedGrade(
      [
        { id: "a", name: "Quizzes", weight: 20 },
        { id: "b", name: "Final", weight: 80 },
      ],
      [
        { category_id: "a", score: 8, max_score: 10 },
        { category_id: "b", score: 90, max_score: 100 },
      ],
    );
    expect(result.percent).toBe(88);
    expect(result.provisional).toBe(false);
  });
});
describe("deadlines", () => {
  it("recognizes completion and overdue work", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(deadlineState("2026-09-25T10:00:00Z", "not_started", now)).toBe(
      "overdue",
    );
    expect(deadlineState("2026-09-25T10:00:00Z", "completed", now)).toBe(
      "completed",
    );
    expect(deadlineState("2026-09-25T18:00:00Z", "not_started", now)).toBe(
      "due today",
    );
  });
});
