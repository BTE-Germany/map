import getUser from '@/actions/minecraft/user';
import { getRegion } from '@/actions/region/GetRegions'
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Image metadata
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png'

// Image generation
export default async function Image({ params }: { params: { id: string } }) {

    const region = await getRegion(params.id);
    const poly = region?.polygon.map(e => e.reverse().join(",")).join("|");
    const imageUrl = "https://tiles.dachstein.cloud/styles/btedarklight/static/auto/500x630.png?path=" + poly + "&fill=rgba(0,128,255,0.3)&stroke=rgba(0,128,255,1)&strokeWidth=4&padding=0.1"


    const creator = await getUser(region?.creatorUUID || "");

    const outfitRegular = await readFile(
        join(process.cwd(), 'assets/outfit-v15-latin-regular.ttf')
    )

    const outfit500 = await readFile(
        join(process.cwd(), 'assets/outfit-v15-latin-500.ttf')
    )

    const outfit600 = await readFile(
        join(process.cwd(), 'assets/outfit-v15-latin-600.ttf')
    )

    const outfit700 = await readFile(
        join(process.cwd(), 'assets/outfit-v15-latin-700.ttf')
    )

    const outfit800 = await readFile(
        join(process.cwd(), 'assets/outfit-v15-latin-800.ttf')
    )


    return new ImageResponse(
        (
            <div style={{
                display: "flex",
                height: "100%",
                width: "100%",
                fontFamily: "'Outfit', sans-serif",
            }}>
                <div style={{
                    backgroundColor: "#282828ff",
                    width: 700,
                    padding: 55,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                }}>
                    <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        color: "white",
                    }}>
                        <p style={{
                            textTransform: "uppercase",
                            fontSize: 15,
                            fontWeight: 700,
                            marginBottom: 20,
                            color: "#00aaff"
                        }}>
                            Mapregion
                        </p>
                        <p style={{
                            width: "80%",
                            fontSize: 50,
                            fontWeight: 800,
                            margin: 0,
                            lineHeight: 1.1,
                        }}>

                            {region?.address}
                        </p>
                        <p style={{
                            fontSize: 25,
                            fontWeight: 500,
                            marginTop: 15,
                            color: "#cccccc"
                        }}>
                            erstellt von
                            <img src={creator?.avatar} alt="Creator Avatar" style={{ width: 30, height: 30, borderRadius: 8, marginLeft: 10, marginRight: 10, verticalAlign: "middle" }} />
                            {creator?.username}
                        </p>
                    </div>
                    <div style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 40
                    }}>
                        <img src="https://cdn.bte-germany.de/general/logos/Logo.png" alt="BTE Germany Logo" style={{ width: 32, height: 32 }} />
                        <p style={{
                            color: "white",
                            fontSize: 15,
                            fontWeight: 'bold',
                        }}>BTE Germany</p>
                    </div>

                </div>
                <img src={imageUrl} alt="" style={{ width: 500, height: "100%" }} />
            </div>
        ),
        {
            ...size,
            fonts: [
                {
                    name: 'Outfit',
                    data: outfit500,
                    weight: 500,
                    style: 'normal',
                },
                {
                    name: 'Outfit',
                    data: outfit600,
                    weight: 600,
                    style: 'normal',
                },
                {
                    name: 'Outfit',
                    data: outfit700,
                    weight: 700,
                    style: 'normal',
                },
                {
                    name: 'Outfit',
                    data: outfit800,
                    weight: 800,
                    style: 'normal',
                },
            ],
        }
    )
}