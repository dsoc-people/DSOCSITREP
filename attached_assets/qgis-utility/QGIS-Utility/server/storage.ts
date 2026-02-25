import { db } from "./db";
import {
  locations,
  type CreateLocationRequest,
  type LocationResponse
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getLocations(): Promise<LocationResponse[]>;
  createLocation(location: CreateLocationRequest): Promise<LocationResponse>;
  deleteLocation(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getLocations(): Promise<LocationResponse[]> {
    return await db.select().from(locations);
  }

  async createLocation(location: CreateLocationRequest): Promise<LocationResponse> {
    const [created] = await db.insert(locations)
      .values(location)
      .returning();
    return created;
  }

  async deleteLocation(id: number): Promise<void> {
    await db.delete(locations)
      .where(eq(locations.id, id));
  }
}

export const storage = new DatabaseStorage();
