import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import type { FC } from "react";

type SidebarUserNavProps = {
  user: {
    email: string;
    name: string | null;
  };
  onLogout: () => void;
};

const getDisplayName = (user: SidebarUserNavProps["user"]) =>
  user.name?.trim() || user.email;

const getSecondaryLabel = (user: SidebarUserNavProps["user"]) =>
  user.name?.trim() ? user.email : "当前账号";

const getInitials = (label: string) => {
  const trimmed = label.trim();

  if (!trimmed) {
    return "?";
  }

  return trimmed[0]?.toUpperCase() ?? "?";
};

export const SidebarUserNav: FC<SidebarUserNavProps> = ({ user, onLogout }) => {
  const displayName = getDisplayName(user);
  const secondaryLabel = getSecondaryLabel(user);
  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-12 w-full justify-start rounded-xl px-2 transition-colors data-[state=open]:bg-muted"
        >
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {secondaryLabel}
            </span>
          </div>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-56">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {secondaryLabel}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOutIcon className="size-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
