import getUser from "@/actions/minecraft/user";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import NavigationBar from "@/components/profile/NavigationBar";
import { getSession } from "@/lib/auth";
import Image from "next/image";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {

    const session = await getSession();

    const minecraftProfile = await getUser(session?.user.minecraft_uuid || "")
    const discordUsername = session?.user.discord_username
    const isPlus = session?.user.realm_access?.roles.includes("plus");

    if (!session) {
        return (
            <div className="p-8">
                <h1 className="text-2xl md:text-5xl font-bold mb-1">Nicht eingeloggt</h1>
                <p className="text-muted-foreground">Bitte melde dich an, um dein Profil zu sehen.</p>
            </div>
        );
    }

    return (
        <div className="bg-background text-foreground">
            <FloatingNavigationBar collapsable={false} />
            <div className="py-6 sm:py-8">

                <div className="relative w-full min-h-64 flex items-center">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,130,246,0.08)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(18,60,126,0.06)_0%,transparent_40%)]"></div>
                    <div className="absolute inset-0 opacity-50 bg-[linear-gradient(rgba(30,45,66,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(30,45,66,0.4)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                    <div className="container mx-auto z-50 flex w-full flex-1 flex-col items-center gap-4 px-4 text-center sm:flex-row sm:text-left">
                        <div className="border-3 relative size-24 shrink-0 rounded-2xl sm:size-28">
                            <Image
                                src={`https://minotar.net/helm/${session.user.minecraft_uuid}`}
                                alt="Avatar"
                                className="rounded-2xl"
                                width={128}
                                height={128}
                            />
                            {
                                isPlus && (
                                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-orange-400 to-yellow-500 text-white shadow border-2 rounded-md px-2 py-1 text-xs font-bold">
                                        Plus
                                    </div>
                                )
                            }
                        </div>

                        <div className="min-w-0 sm:ml-2">
                            <h1 className="mb-1 break-words text-2xl font-bold md:text-4xl">{minecraftProfile?.username}</h1>
                            {discordUsername && (
                                <p className="break-words text-muted-foreground">
                                    @{discordUsername}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <NavigationBar />

                <div className="px-4 py-6 sm:py-8 md:px-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
