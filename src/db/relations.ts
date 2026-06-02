import { relations } from "drizzle-orm/relations";
import { region, regionImage } from "./schema";

export const regionRelations = relations(region, ({ many }) => ({
	images: many(regionImage),
}));

export const regionImageRelations = relations(regionImage, ({ one }) => ({
	region: one(region, {
		fields: [regionImage.regionId],
		references: [region.id]
	}),
}));
