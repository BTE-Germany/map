import { FloatingNavigationBar } from "@/components/common/NavigationBar";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background text-foreground h-screen flex flex-col">
            <FloatingNavigationBar collapsable={false} />
            <div className="py-8 h-full flex-1">
                {children}
            </div>
        </div>
    );
}