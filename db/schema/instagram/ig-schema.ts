import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgSchema, text, unique, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

export const instagramSchema = pgSchema("instagram");

export const userRoleEnum = instagramSchema.enum("scrapedFrom_type", [
  "user",
  "hashtag",
  "location",
]);

export const igUserTable = instagramSchema.table("ig_users", {
  id: varchar().primaryKey(),
  username: varchar({ length: 255 }).unique(),
  full_name: varchar({ length: 255 }),
  is_private: boolean(),
  fbid_v2: text(),
  third_party_downloads_enabled: integer(),
  strong_id__: text(),
  profile_pic_id: text(),
  profile_pic_url: text(),
  is_verified: boolean(),
  has_anonymous_profile_picture: boolean(),
  latest_reel_media: integer(),

  followers: integer(),
  following: integer(),
  posts: integer(),

  scrapedFrom_full_name: varchar().notNull(),
  scrapedFrom_type: userRoleEnum().notNull().default("user"),
});

//This is different from what we get from IG - because of some custom fields
//It's important to keep them separated so that we get the right errors when saving in db
export type IgUserTableType = typeof igUserTable.$inferInsert;

export const scrapedOriginRelation = relations(igUserTable, ({ one }) => ({
  scraped_from: one(igUserTable, {
    fields: [igUserTable.scrapedFrom_full_name],
    references: [igUserTable.full_name],
  }),
}));

export const igUserStatusesTable = instagramSchema.table(
  "ig_user_statuses",
  {
    //oficial IG fields:
    id: varchar().primaryKey(),
    following: boolean(),
    incoming_request: boolean(),
    is_bestie: boolean(),
    is_private: boolean(),
    is_restricted: boolean(),
    outgoing_request: boolean(),
    is_feed_favorite: boolean(),

    //custom fields:
    me: varchar().notNull().default(process.env.IG_LOGIN),
    follower: boolean(),
    i_followed_in_the_past: boolean(),
    notWorthFollowing: boolean(),
  },
  (t) => [unique("combination of me and id").on(t.me, t.id)]
);

export type IGStatusesTableType = typeof igUserStatusesTable.$inferInsert;

export const userStatusRelation = relations(igUserStatusesTable, ({ one }) => ({
  statusUserRelation: one(igUserTable, {
    fields: [igUserStatusesTable.id],
    references: [igUserTable.id],
  }),
}));

export const numberFollowedTodayTable = instagramSchema.table(
  "number_followed_today",
  {
    id: varchar({ length: 10 }).primaryKey(), //date in format YYYY-MM-DD
    number: integer(),
    me: varchar().notNull(),
  },
  (t) => [
    unique("only_one_me_and_id_combo").on(t.me, t.id),
    //check the format of the date
    check("date_format", sql`${t.id} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  ]
);


export const linkedinSchema = pgSchema("linkedin");

export const jobPostsTable = linkedinSchema.table("job_posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  company: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  jobDetails: text().notNull(),
  skills: text().notNull(),
  linkedinId: varchar({ length: 255 }).notNull().unique(),
  somethingElse: text(),
});