import axios from "axios";

export interface Player {
    meta:         Meta;
    username:     string;
    id:           string;
    raw_id:       string;
    avatar:       string;
    skin_texture: string;
    properties:   Property[];
    name_history: any[];
}

export interface Meta {
    cached_at: number;
}

export interface Property {
    name:      string;
    value:     string;
    signature: string;
}

export default async function getUser(uuid: string): Promise<Player | null> {
    const {data} = await axios.get(`https://playerdb.co/api/player/minecraft/${uuid}`)
    if(data.code === "player.found")
        return data.data.player
    else return null
}