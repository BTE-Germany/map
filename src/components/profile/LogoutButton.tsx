"use client"

import { LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
    return (
        <Button variant="destructive" size={"sm"} onClick={() => {
            signOut({
                callbackUrl: "/"
            })
        }} className="cursor-pointer  font-normal">
            <LogOut />
            Abmelden
        </Button>
    );
}