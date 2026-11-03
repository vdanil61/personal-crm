import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

// The email of the signed-in user and "Выйти" in the header. Pages without a login show neither.
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 lg:gap-3">
      {/* A long email is cut off with an ellipsis, so "Выйти" always stays in view */}
      <span className="min-w-0 truncate text-sm text-muted-foreground lg:text-base">{user.email}</span>
      <form action={signOut} className="shrink-0">
        <Button type="submit" variant="outline" className="h-11 px-3 lg:px-4 lg:text-base">
          Выйти
        </Button>
      </form>
    </div>
  );
}
