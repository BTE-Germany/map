import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPrivacy, setHideOnMap, type PrivacyState } from "@/actions/privacy/Privacy";

export function usePrivacy() {
    const qc = useQueryClient();
    const query = useQuery<PrivacyState>({
        queryKey: ["privacy"],
        queryFn: () => getPrivacy(),
        staleTime: 60_000,
    });
    const mutation = useMutation({
        mutationFn: (hide: boolean) => setHideOnMap(hide),
        onSuccess: (data) => qc.setQueryData(["privacy"], data),
    });
    return {
        ...query,
        setHideOnMap: mutation.mutate,
        isUpdating: mutation.isPending,
    };
}
