import { unique } from "drizzle-orm/pg-core";
import { PgColumn, pgEnum, text, varchar } from "drizzle-orm/pg-core";
import { integer, pgTable, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

export const userRoleEnum = pgEnum("scrapedFrom_type", [
  "user",
  "hashtag",
  "location",
]);

export const igUserTable = pgTable("ig_users", {
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

  scrapedFrom_full_name: varchar().notNull(),
  scrapedFrom_type: userRoleEnum().notNull(),
});

export const usersRelations = relations(igUserTable, ({ one }) => ({
  invitee: one(igUserTable, {
    fields: [igUserTable.scrapedFrom_full_name],
    references: [igUserTable.full_name],
  }),
}));

export const igUserStatusesTable = pgTable(
  "ig_user_statuses",
  {
    me: varchar().notNull().default(process.env.IG_LOGIN),

    //oficial IG fields:
    id: varchar().primaryKey(),
    following: boolean(),
    incoming_request: boolean(),
    is_bestie: boolean(),
    is_private: boolean(),
    is_restricted: boolean(),
    outgoing_request: boolean(),
    is_feed_favorite: boolean(),
  },
  (t) => [unique("combination of me and id").on(t.me, t.id)]
);

export const followStatus = pgTable(
  "ig_follow_status",
  {
    me: varchar().primaryKey().default(process.env.IG_LOGIN),
    them: varchar().notNull(),
    iFollow: boolean(),
    theyFollow: boolean(),
    iFollowedInThePast: boolean(),
  },
  (t) => [unique("combination of me and them").on(t.me, t.them)]
);

export const followStatusRelations = relations(followStatus, ({ one }) => ({
  user: one(igUserTable, {
    fields: [followStatus.me, followStatus.them],
    references: [igUserTable.full_name, igUserTable.full_name],
  }),
}));
