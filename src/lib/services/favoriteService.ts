import { getCollections } from '../mongodb';
import { FavoriteBusStop } from '@/types/busStop';

export async function getUserFavorites(userId: string): Promise<FavoriteBusStop[]> {
  try {
    const { favoriteBusStops } = await getCollections();
    const favorites = await favoriteBusStops.find({ userId }).toArray();
    return favorites as FavoriteBusStop[];
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
