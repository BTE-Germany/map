import { useQuery } from "@tanstack/react-query";
import getUser from "@/actions/minecraft/user";

const useMcUser = (mcUuid: string) => useQuery({
    queryKey: ['mcUser', mcUuid],
    queryFn: () => getUser(mcUuid),
    enabled: !!mcUuid,
});

export { useMcUser };
