import { ObjectId } from 'mongodb';
import { getCollections } from '../mongodb';
import { User, CreateUserData, UpdateUserData, UserLoginData } from '@/types/user';
import bcrypt from 'bcryptjs';

export class UserService {
  private static async getUsersCollection() {
    const { users } = await getCollections();
    return users;
  }

  // Create a new user
  static async createUser(userData: CreateUserData): Promise<User> {
    const users = await this.getUsersCollection();
    
    // Check if user already exists
    const existingUser = await users.findOne({ username: userData.username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser: Omit<User, '_id'> = {
      username: userData.username,
      password: hashedPassword,
      favoriteBusStops: userData.favoriteBusStops || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  }

  // Get user by ID
  static async getUserById(id: string): Promise<User | null> {
    const users = await this.getUsersCollection();
    return await users.findOne({ _id: new ObjectId(id) });
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    const users = await this.getUsersCollection();
    return await users.findOne({ username });
  }

  // Update user
  static async updateUser(id: string, updateData: UpdateUserData): Promise<User | null> {
    const users = await this.getUsersCollection();
    
    const updateFields: any = {
      ...updateData,
      updatedAt: new Date(),
    };

    // Hash password if it's being updated
    if (updateData.password) {
      updateFields.password = await bcrypt.hash(updateData.password, 10);
    }

    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Delete user
  static async deleteUser(id: string): Promise<boolean> {
    const users = await this.getUsersCollection();
    const result = await users.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Add favorite bus stop
  static async addFavoriteBusStop(userId: string, busStopId: string): Promise<User | null> {
    const users = await this.getUsersCollection();
    
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $addToSet: { favoriteBusStops: busStopId },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Remove favorite bus stop
  static async removeFavoriteBusStop(userId: string, busStopId: string): Promise<User | null> {
    const users = await this.getUsersCollection();
    
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $pull: { favoriteBusStops: busStopId },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Verify user login
  static async verifyLogin(loginData: UserLoginData): Promise<User | null> {
    try {
      const user = await this.getUserByUsername(loginData.username);
      if (!user) {
        console.log('User not found:', loginData.username);
        return null;
      }

      const isPasswordValid = await bcrypt.compare(loginData.password, user.password);
      if (!isPasswordValid) {
        console.log('Invalid password for user:', loginData.username);
        return null;
      }

      console.log('Login successful for user:', loginData.username);
      return user;
    } catch (error) {
      console.error('Error in verifyLogin:', error);
      throw error;
    }
  }

  // Get all users (for admin purposes)
  static async getAllUsers(): Promise<User[]> {
    const users = await this.getUsersCollection();
    return await users.find({}).toArray();
  }
}
