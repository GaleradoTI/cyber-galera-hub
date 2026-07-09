import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useFollow(targetUserId: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const me = user?.id ?? null;
  const enabled = !!targetUserId;

  const { data } = useQuery({
    queryKey: ["follow", targetUserId, me],
    enabled,
    queryFn: async () => {
      const [followers, following, mine] = await Promise.all([
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", targetUserId!),
        supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", targetUserId!),
        me
          ? supabase.from("user_follows").select("follower_id").eq("follower_id", me).eq("following_id", targetUserId!).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        isFollowing: !!(mine as any).data,
      };
    },
  });

  const toggle = async () => {
    if (!me) return toast.error("Entre para seguir membros.");
    if (!targetUserId || targetUserId === me) return;
    if (data?.isFollowing) {
      const { error } = await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", me)
        .eq("following_id", targetUserId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_follows")
        .insert({ follower_id: me, following_id: targetUserId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["follow", targetUserId] });
    qc.invalidateQueries({ queryKey: ["follow-stats", me] });
  };

  return {
    followers: data?.followers ?? 0,
    following: data?.following ?? 0,
    isFollowing: !!data?.isFollowing,
    isSelf: me === targetUserId,
    canFollow: !!me && !!targetUserId && targetUserId !== me,
    toggle,
  };
}

export function useFollowStats(userId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["follow-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId!),
        supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId!),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
  return { followers: data?.followers ?? 0, following: data?.following ?? 0 };
}