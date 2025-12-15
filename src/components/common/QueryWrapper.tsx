"use client"

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";

const queryClient = new QueryClient()


export default function QueryWrapper(props: any) {
    return (
        <QueryClientProvider client={queryClient}>
            {props.children}
            <ReactQueryDevtools initialIsOpen={false} client={queryClient} buttonPosition={"top-right"} />
        </QueryClientProvider>
    )
}