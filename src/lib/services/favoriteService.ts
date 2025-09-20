import { getCollections } from '../mongodb';
import { FavoriteBusStop } from '@/types/busStop';
import { ObjectId } from 'mongodb';

export async function getUserFavorites(userId: string): Promise<FavoriteBusStop[]> {
  try {
    const { favoriteBusStops } = await getCollections();
    const favorites = await favoriteBusStops.find({ userId }).toArray();
    
    // Ensure _id is converted to string format for consistent handling
    return favorites.map(fav => ({
      ...fav,
      _id: fav._id.toString()
    })) as FavoriteBusStop[];
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    throw new Error('Failed to fetch favorites');
  }
}

export async function addFavorite(userId: string, stopId: number, customName: string): Promise<FavoriteBusStop> {
  try {
    const { favoriteBusStops } = await getCollections();
    
    // Check if stop is already favorited by this user
    const existing = await favoriteBusStops.findOne({ userId, stopId });
    if (existing) {
      throw new Error('Stop is already in favorites');
    }
    
    // Check if custom name is unique for this user
    const nameExists = await favoriteBusStops.findOne({ userId, customName });
    if (nameExists) {
      throw new Error('Custom name already exists');
    }
    
    const favorite: Omit<FavoriteBusStop, '_id'> = {
      userId,
      stopId,
      customName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await favoriteBusStops.insertOne(favorite);
    return { ...favorite, _id: result.insertedId.toString() };
  } catch (error) {
    console.error('Error adding favorite:', error);
    throw error;
  }
}

export async function removeFavorite(userId: string, stopId: number): Promise<void> {
  try {
    const { favoriteBusStops } = await getCollections();
    const result = await favoriteBusStops.deleteOne({ userId, stopId });
    
    if (result.deletedCount === 0) {
      throw new Error('Favorite not found');
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
}

export async function updateFavoriteName(userId: string, stopId: number, newCustomName: string): Promise<void> {
  try {
    const { favoriteBusStops } = await getCollections();
    
    // Check if new name is unique for this user
    const nameExists = await favoriteBusStops.findOne({ 
      userId, 
      customName: newCustomName,
      stopId: { $ne: stopId }
    });
    if (nameExists) {
      throw new Error('Custom name already exists');
    }
    
    const result = await favoriteBusStops.updateOne(
      { userId, stopId },
      { $set: { customName: newCustomName, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Favorite not found');
    }
  } catch (error) {
    console.error('Error updating favorite name:', error);
    throw error;
  }
}

export async function isStopFavorited(userId: string, stopId: number): Promise<boolean> {
  try {
    const { favoriteBusStops } = await getCollections();
    const favorite = await favoriteBusStops.findOne({ userId, stopId });
    return !!favorite;
  } catch (error) {
    console.error('Error checking if stop is favorited:', error);
    return false;
  }
}

export async function updateFavoriteById(favoriteId: string, customName: string): Promise<FavoriteBusStop | null> {
  try {
    const { favoriteBusStops } = await getCollections();
    
    // Validate ObjectId format
    if (!ObjectId.isValid(favoriteId)) {
      console.error('Invalid ObjectId format:', favoriteId);
      return null;
    }
    
    // First get the current favorite to check user and validate uniqueness
    const currentFavorite = await favoriteBusStops.findOne({ _id: new ObjectId(favoriteId) } as any);
    if (!currentFavorite) {
      console.error('Favorite not found with ID:', favoriteId);
      return null;
    }
    
    // Check if new name is unique for this user (excluding the current favorite)
    const nameExists = await favoriteBusStops.findOne({ 
      userId: currentFavorite.userId, 
      customName,
      _id: { $ne: new ObjectId(favoriteId) }
    } as any);
    if (nameExists) {
      throw new Error('Custom name already exists');
    }
    
    const result = await favoriteBusStops.findOneAndUpdate(
      { _id: new ObjectId(favoriteId) } as any,
      { $set: { customName, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      console.error('Update operation failed for favorite ID:', favoriteId);
      return null;
    }
    
    return result as FavoriteBusStop;
  } catch (error) {
    console.error('Error updating favorite by ID:', error);
    throw error;
  }
}

export async function removeFavoriteById(favoriteId: string, userId: string): Promise<boolean> {
  try {
    const { favoriteBusStops } = await getCollections();
    
    // Ensure the favorite belongs to the user before deleting
    const result = await favoriteBusStops.deleteOne({ 
      _id: new ObjectId(favoriteId),
      userId
    } as any);
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error removing favorite by ID:', error);
    throw error;
  }
}
