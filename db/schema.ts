import { text, varchar } from "drizzle-orm/pg-core";
import { integer, pgTable, boolean } from "drizzle-orm/pg-core";

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
});

export const igUserStatusesTable = pgTable("ig_user_statuses", {
  id: varchar().primaryKey(),
  following: boolean(),
  incoming_request: boolean(),
  is_bestie: boolean(),
  is_private: boolean(),
  is_restricted: boolean(),
  outgoing_request: boolean(),
  is_feed_favorite: boolean(),
});