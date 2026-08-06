export default function LegalBar() {
    return (
        // The full-width strip is only a positioning frame — it must let map
        // gestures through, or it swallows a band across the bottom of the map.
        <div className={"absolute bottom-0 left-0 flex justify-center lg:justify-start items-center w-full z-30 pointer-events-none"}>
            {/* Below lg the map controls are centred enough that their
                attribution line runs straight through this pill and covers the
                legal links — so sit above it until the two separate again. */}
            <div className={"bg-neutral-950/30 backdrop-blur-xl z-50 rounded-full m-4 mb-14 lg:mb-4 text-neutral-400 text-xs px-3 py-1 pointer-events-auto"}>
                <div className={"flex items-center gap-3"}>
                    &copy; BuildTheEarth Germany e.V.
                </div>
                <div className={"flex items-center gap-3 text-[8px] justify-center"}>
                    <a href={"https://bte-germany.de/legal"} className={"underline"} target={"_blank"} rel={"noreferrer"}>Impressum</a>
                    <a href={"https://bte-germany.de/privacy"} className={"underline"} target={"_blank"} rel={"noreferrer"}>Datenschutz</a>
                </div>
            </div>
        </div>

    )
}