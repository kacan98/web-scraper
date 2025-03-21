import {
    boolean,
    integer,
    pgSchema,
    text,
    timestamp,
    varchar
} from "drizzle-orm/pg-core";
import { jobAIAnalysis, linkedinSchema } from "./linkedin-schema";

export const skill = linkedinSchema.table("skill", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
})

export const skillJobMapping = linkedinSchema.table("skill_job_mapping", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => jobAIAnalysis.id),
  technologyId: integer()
    .notNull()
    .references(() => skill.id),
  isRequired: boolean().notNull(), // Indicates if the technology is required or optional
});

export type Skill = typeof skill.$inferInsert;
export type SkillJobMapping = typeof skillJobMapping.$inferInsert;