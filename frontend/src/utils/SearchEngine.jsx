/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + SearchEngine.jsx                                                           +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from "react";
import {BiMapPin} from "react-icons/bi";
import axios from "axios";
import {OSMTagTranslations} from "./OSMTagTranslations";
import {getIcon} from "./OSMTagIcons";
import {MeiliSearch} from "meilisearch";
import {TbPolygon} from "react-icons/tb";

const meilisearch = new MeiliSearch({host: import.meta.env.SEARCH_URL, apiKey: import.meta.env.SEARCH_KEY})

export const searchInOSM = async (query, flyTo) => {
    const result = [];
    const {data} = await axios.get(`https://photon.komoot.io/api/?q=${query}`);
    data.features.slice(0, 5).forEach(feature => {
        let featureType = feature.properties.osm_key;
        let tagTranslation = OSMTagTranslations["tag:" + featureType];
        let name = feature.properties.name;
        if (feature.properties.state) {
            name += ", " + feature.properties.state;
        }
        if (!feature.properties.name) {
            name = feature.properties.street + " " + feature.properties.housenumber;

            if (feature.properties.city) {
                name += ", " + feature.properties.city;
            }
            if (!feature.properties.city && feature.properties.district) {
                name += ", " + feature.properties.district;
            }
        }

        result.push({
            title: name,
            description: tagTranslation ? tagTranslation.message : featureType,
            onTrigger: () => flyTo(feature.geometry.coordinates[1], feature.geometry.coordinates[0]),
            icon: getIcon(featureType),
            group: "OpenStreetMap",
        })
    });


    return result;

}

export const searchInRegions = async (query, flyTo) => {
    console.log(query)
    const results = await meilisearch.index(import.meta.env.SEARCH_INDEX).search(query, {limit: 5})
    let end = [];
    if (results?.hits) {
        end = results.hits.map((region) => {
            return {
                title: `${region.city}`,
                description: `${region.osmDisplayName} by ${region.username}`,
                onTrigger: () => flyTo(region._geo.lat, region._geo.lng),
                icon: <TbPolygon size={18}/>,
                group: "Regions",
            }
        })
    }

    console.log(end)

    return end;
}


