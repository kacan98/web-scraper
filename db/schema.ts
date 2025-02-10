import { integer, pgTable, varchar, boolean } from "drizzle-orm/pg-core";

export const igUserTable = pgTable("ig_users", {
  id: integer().primaryKey(),
  username: varchar({ length: 255 }).unique(),
  full_name: varchar({ length: 255 }),
  is_private: boolean(),
  fbid_v2: varchar({ length: 255 }),
  third_party_downloads_enabled: integer(),
  strong_id__: varchar({ length: 255 }),
  profile_pic_id: varchar({ length: 255 }),
  profile_pic_url: varchar({ length: 255 }),
  is_verified: boolean(),
  has_anonymous_profile_picture: boolean(),
  account_badges: varchar({ length: 255 }),
  latest_reel_media: integer(),
});
