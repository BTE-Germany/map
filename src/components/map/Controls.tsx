import {useMap} from "@vis.gl/react-maplibre";
import {MinusIcon, PlusIcon} from "lucide-react";
import {useEffect, useState} from "react";


export default function MapControls() {
    const {mainMap: map} = useMap();

    const [mapHeading, setMapHeading] = useState<number>(0);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStartX, setDragStartX] = useState<number>(0);
    const [dragStartBearing, setDragStartBearing] = useState<number>(0);

    useEffect(() => {
        if (!map) return;

        const updateHeading = () => {
            setMapHeading(map.getBearing());
        };

        map.on('rotate', updateHeading);
        map.on('load', updateHeading);

        return () => {
            map.off('rotate', updateHeading);
            map.off('load', updateHeading);
        };
    }, [map]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!map) return;

        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartBearing(map.getBearing());

        // Prevent the click event from firing immediately
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !map) return;

        const deltaX = e.clientX - dragStartX;
        const sensitivity = 0.5; // Adjust rotation sensitivity
        const newBearing = dragStartBearing + (deltaX * sensitivity);

        map.setBearing(newBearing);
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (!isDragging) return;

        setIsDragging(false);

        // If the mouse hasn't moved much, treat it as a click to reset bearing
        const deltaX = Math.abs(e.clientX - dragStartX);
        if (deltaX < 5 && map) {
            map.setBearing(0);
        }
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStartX, dragStartBearing, map]);

    if (!map) {
        return null;
    }

    return (
        <div className={"absolute bottom-0 right-0 z-40 m-4 flex flex-col gap-2 items-end text-xs text-neutral-400"}>
            <div
                className={"rounded-xl overflow-hidden flex flex-col divide-y divide-neutral-600/30 text-foreground bg-neutral-950/30 backdrop-blur-xl"}>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"}
                     onMouseDown={handleMouseDown}
                     style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                    <div
                        className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s] relative flex items-center justify-center size-6 p-1"}>
                        <div className={"w-full h-full border-2 border-foreground rounded-full"}></div>
                        <div className={"absolute top-0 left-1/2 -translate-x-1/2"} style={{
                            transform: `rotate(${-mapHeading}deg)`,
                            transition: isDragging ? "none" : "transform 0.1s",
                            transformOrigin: "50% 12px"
                        }}>
                            <div
                                className={"w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-6 border-b-red-500"}></div>
                        </div>
                    </div>
                </div>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"} onClick={() => map?.zoomIn()}>
                    <PlusIcon className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s]"}/>
                </div>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"}>
                    <MinusIcon className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s]"}
                               onClick={() => map?.zoomOut()}/>
                </div>
            </div>

            <div className={"rounded-xl overflow-hidden text-neutral-400 bg-neutral-950/30 backdrop-blur-xl px-2 py-1"}>
                <span><a href="https://www.maptiler.com/copyright/">© OpenMapTiles</a> <a
                    href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a></span>
            </div>
        </div>
    )
}
