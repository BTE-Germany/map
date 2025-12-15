import {AnimatePresence, motion} from "motion/react";
import {HouseIcon, LandPlotIcon, TrendingUp, XIcon} from "lucide-react";
import {useMap} from "@vis.gl/react-maplibre";
import {useEffect} from "react";
import {useRegion} from "@/dataHooks/regions/useRegion";
import useRegionPane from "@/stores/RegionPaneStore";
import {useMcUser} from "@/dataHooks/minecraft/useMcUser";
import {useSession} from "next-auth/react";
import {Badge} from "@/components/ui/badge";

export default function RegionPane() {
    const regionPageStore = useRegionPane()
    const {data: sessionData} = useSession()

    const {mainMap: map} = useMap();
    const {data: region, isLoading} = useRegion(regionPageStore.region);
    const {data: ownerData, isLoading: isOwnerDataLoading} = useMcUser(region?.creatorUUID || "");


    const isCreator = sessionData?.user?.minecraft_uuid === region?.creatorUUID

    useEffect(() => {
        if (!regionPageStore.open && regionPageStore.restoreBox) {
            map?.fitBounds(regionPageStore.restoreBox, {
                duration: 1000
            });
            return;
        }

        if (regionPageStore.open && region && map) {
            regionPageStore.setRestoreBox(map.getBounds());
            const coordinates = region.polygon;

            if (coordinates && coordinates.length > 0) {

                const lats = coordinates.map((coord: number[]) => coord[0]);
                const lngs = coordinates.map((coord: number[]) => coord[1]);

                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);


                const offsetLng = (maxLng - minLng) * 0.2;


                const bounds: [number, number, number, number] = [
                    minLng - offsetLng, // west
                    minLat,             // south
                    maxLng + offsetLng, // east
                    maxLat              // north
                ];

                const padding = 100

                map.fitBounds(bounds, {
                    padding: {
                        top: padding + 50,
                        bottom: padding,
                        left: window.innerWidth / 3 + padding,
                        right: padding
                    },
                    duration: 1000
                });
            }
        }
    }, [regionPageStore.open, region, map]);

    return (
        <AnimatePresence>
            {
                regionPageStore.open &&
                <motion.div className={"absolute top-0 left-0 h-full w-1/3 p-4 z-50"}>
                    <motion.div
                        className={` h-full w-full bg-neutral-950/60 backdrop-blur-xl  overflow-y-auto rounded-2xl z-50 p-8 text-foreground`}
                        initial={{opacity: 0, x: -50}}
                        animate={{
                            opacity: 1,
                            x: 0,
                            transition: {
                                type: "spring",
                                stiffness: 409,
                                damping: 38,
                                mass: 0.3,
                                restDelta: 0.001
                            },
                        }}
                        exit={{opacity: 0, x: -50}}>
                        <div className={"flex justify-end w-full mb-6"}>
                            <button onClick={() => regionPageStore.setOpen(false)}
                                    className={"bg-neutral-800/30 hover:bg-neutral-800/60 rounded-xl p-2 active:scale-[95%] transition"}>
                                <XIcon className={"text-foreground"}/>
                            </button>


                        </div>

                        {
                            isCreator && <Badge className={"mb-3"}>Deine Region</Badge>
                        }

                        {
                            isLoading ? <div className={"w-1/3 h-12 bg-neutral-500 animate-pulse rounded-xl"}></div> :
                                <h1 className={"text-5xl font-bold line-clamp-1 pb-1"}>{region?.address}</h1>
                        }
                        {
                            isLoading || isOwnerDataLoading ? <div className={"w-1/4 h-6 bg-neutral-500 animate-pulse rounded-xl mt-2"}></div> : <p className={"mt-2 flex items-center gap-1 text-neutral-400"}>
                                von <span className={"flex items-center gap-1"}>
                            <img src={ownerData?.avatar}
                                 alt={`${ownerData?.username}'s head`} className={"size-4 rounded-full"}/>
                                {ownerData?.username}
                        </span>
                            </p>
                        }

                        <div className={"grid grid-cols-2 gap-5 my-12"}>
                            <div className={"relative w-full min-h-32 backdrop-blur-md rounded-2xl overflow-hidden px-6 py-5 flex flex-col justify-between"}>

                                <div className={"flex flex-row gap-1 items-center text-muted-foreground"}>
                                    <HouseIcon size={15}/>
                                    <p className={"uppercase text-muted-foreground text-sm font-semibold"}>
                                        Gebäude
                                    </p>
                                </div>

                                <p className={"text-4xl font-bold"}>
                                    {region?.buildings}
                                </p>

                                <div className={"absolute left-0 bottom-0 size-32 bg-blue-800/20 blur-3xl translate-y-12 -z-10"}></div>
                            </div>

                            <div className={"relative w-full min-h-32 backdrop-blur-md rounded-2xl overflow-hidden px-6 py-5 flex flex-col justify-between"}>

                                <div className={"flex flex-row gap-1 items-center text-muted-foreground"}>
                                    <LandPlotIcon size={15}/>
                                    <p className={"uppercase text-muted-foreground text-sm font-semibold"}>
                                        Fläche
                                    </p>
                                </div>

                                <p className={"text-4xl font-bold"}>
                                    {parseFloat(region?.area || "").toLocaleString("de")} <span className={"text-xl text-muted-foreground"}>m²</span>
                                </p>

                                <div className={"absolute left-0 bottom-0 size-32 bg-blue-800/20 blur-3xl translate-y-12 -z-10"}></div>
                            </div>
                        </div>


                    </motion.div>
                </motion.div>
            }
        </AnimatePresence>

    )
}