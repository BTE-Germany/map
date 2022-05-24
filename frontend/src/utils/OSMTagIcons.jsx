/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + OSMTagIcons.jsx                                                            +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import {BiBuildingHouse, BiMapPin} from 'react-icons/bi';

export const getIcon = (tag) => {
    switch (tag) {
        case 'building':
            return <BiBuildingHouse size={18}/>
        default:
            return <BiMapPin size={18}/>
    }
}
