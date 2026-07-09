import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/use-follow";

export function FollowButton({
  userId,
  size = "sm",
  variant,
}: {
  userId: string | null | undefined;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
}) {
  const { isFollowing, canFollow, isSelf, toggle } = useFollow(userId);
  if (isSelf || !userId) return null;
  return (
    <Button
      size={size}
      variant={variant ?? (isFollowing ? "outline" : "default")}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }}
      disabled={!canFollow}
      className="gap-1"
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-3.5 w-3.5" /> Seguindo
        </>
      ) : (
        <>
          <UserPlus className="h-3.5 w-3.5" /> Seguir
        </>
      )}
    </Button>
  );
}