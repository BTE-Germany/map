import { relations } from "drizzle-orm/relations";
import { region, additionalBuilder, image, user } from "./schema";

export const additionalBuilderRelations = relations(additionalBuilder, ({one}) => ({
	region: one(region, {
		fields: [additionalBuilder.regionId],
		references: [region.id]
	}),
}));

export const regionRelations = relations(region, ({one, many}) => ({
	additionalBuilders: many(additionalBuilder),
	images: many(image),
	user: one(user, {
		fields: [region.ownerId],
		references: [user.id]
	}),
}));

export const imageRelations = relations(image, ({one}) => ({
	region: one(region, {
		fields: [image.regionId],
		references: [region.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	regions: many(region),
}));