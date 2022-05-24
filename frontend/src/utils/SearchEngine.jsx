/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + SearchEngine.jsx                                                           +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from "react";
import {BiMapPin} from "react-icons/bi";
import axios from "axios";
import {OSMTagTranslations} from "./OSMTagTranslations";
import {getIcon} from "./OSMTagIcons";

const searchInOSM = async (query, flyTo) => {
    const result = [];
    const {data} = await axios.get(`https://photon.komoot.io/api/?q=${query}`);
    data.features.forEach(feature => {
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

    console.log(result)

    return result;

}


export default searchInOSM;
