import {createZodRoute} from 'next-zod-route';
import {z} from 'zod';
import {NextResponse} from "next/server";
import {region} from "@/db/schema";
import db from "@/db/drizzle";
import * as turf from "@turf/turf";
import gMapsClient from "@/lib/googleMaps";
import {Language, PlaceType2} from "@googlemaps/google-maps-services-js";
import axios from "axios";

const bodySchema = z.object({
    polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
    creatorUUID: z.uuid(),
});


export const POST = createZodRoute()
    .body(bodySchema)
    .handler(async (request, context) => {
        const { polygon, creatorUUID } = context.body;

        const turfPolygon = turf.polygon([
            polygon.map(coord => [coord[1], coord[0]])
        ]);


        const area = turf.area(turfPolygon);
        const center = turf.center(turfPolygon);
        const {data: addressData} = await gMapsClient.reverseGeocode({
            params: {
                key: process.env.GOOGLE_MAPS_API_KEY!,
                latlng: (center.geometry.coordinates as [number, number]).reverse() as [number, number],
                language: Language.de
            }
        })

        console.log(JSON.stringify(addressData, null, 2))


        const streetAddress = addressData.results.find((e) => e.types.includes(PlaceType2.street_address))
        const city = streetAddress?.address_components.find((e) => e.types.includes(PlaceType2.locality))?.long_name || "Unbekannt"


        const poly = polygon.map(coord => coord.join(" ")).join(" ");

        let overpassQuery = `
                [out:json][timeout:25];
                (
                    node["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                    way["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                    relation["building"]["building"!~"grandstand"]["building"!~"roof"](poly: "${poly}");
                );
                out count;
               `;

        console.log(overpassQuery)


        const { data: overpassData } = await axios.get(` https://overpass-api.de/api/interpreter?data=${overpassQuery.replace("\n", "")}`)


        try {
            const id = await db?.insert(region).values({
                polygon: polygon,
                creatorUUID: creatorUUID,
                finished: false,
                type: "default",
                address: streetAddress?.formatted_address,
                city: city,
                area: area.toFixed(2),
                buildings: parseInt(overpassData?.elements[0]?.tags?.total) || 0
            }).returning({ id: region.id });
            return NextResponse.json({ id: id[0].id }, { status: 200 });
        } catch (e) {
            console.log(e)
            return NextResponse.json({ }, { status: 500 });
        }



    });