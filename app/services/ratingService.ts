import { eq, and, avg, count, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

// ─── Rating Service ───
// Handles course star ratings (1–5). One rating per user per course.
// Uses positional parameters (project convention).

export function findRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function upsertRating(userId: number, courseId: number, rating: number) {
  const existing = findRating(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(courseRatings.userId, userId),
          eq(courseRatings.courseId, courseId)
        )
      )
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getCourseRatingStats(
  courseId: number
): { average: number | null; count: number } {
  const result = db
    .select({
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ? Number(result.average) : null,
    count: result?.count ?? 0,
  };
}

export function getRatingStatsForCourses(
  courseIds: number[]
): Map<number, { average: number | null; count: number }> {
  const map = new Map<number, { average: number | null; count: number }>();

  if (courseIds.length === 0) return map;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    map.set(row.courseId, {
      average: row.average ? Number(row.average) : null,
      count: row.count,
    });
  }

  return map;
}
