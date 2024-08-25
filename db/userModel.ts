import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  isFollowing?: boolean;
  link: string;
  date: Date;
  followersNr?: number;
  followingNr?: number;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true },
  isFollowing: { type: Boolean, default: false },
  link: { type: String, required: true },
  date: { type: Date, default: Date.now },
  followersNr: { type: Number, default: 0 },
  followingNr: { type: Number, default: 0 },
});

export default mongoose.model<IUser>("User", UserSchema);
