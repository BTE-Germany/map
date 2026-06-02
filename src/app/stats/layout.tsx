import { FloatingNavigationBar } from "@/components/common/NavigationBar";

export default function StatsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <FloatingNavigationBar collapsable={false} />
            {children}
        </div>
    );
}
