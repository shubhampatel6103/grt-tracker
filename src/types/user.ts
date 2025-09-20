import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string;
  password: string; // You'll want to hash this
  favoriteBusStops: string[];
  searchRadius?: number; // radius in meters for nearby stops search
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  username: string;
  password: string;
  favoriteBusStops?: string[];
  searchRadius?: number;
}

export interface UpdateUserData {
  username?: string;
  password?: string;
  favoriteBusStops?: string[];
  searchRadius?: number;
}

export interface UserLoginData {
  username: string;
  password: string;
}
