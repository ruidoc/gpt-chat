import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StoredThreadSummary } from "@/lib/chat-thread-store";
import { MoreHorizontalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { type FC, useState } from "react";

type ThreadListProps = {
  activeThreadId: string;
  isLoading: boolean;
  threads: StoredThreadSummary[];
  onDeleteThread: (threadId: string) => void;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
};

export const ThreadList: FC<ThreadListProps> = ({
  activeThreadId,
  isLoading,
  threads,
  onDeleteThread,
  onNewThread,
  onSelectThread,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <ThreadListNew onNewThread={onNewThread} />
      {isLoading ? <ThreadListSkeleton /> : null}
      {!isLoading
        ? threads.map((thread) => (
            <ThreadListItem
              key={thread.id}
              active={thread.id === activeThreadId}
              thread={thread}
              onDeleteThread={onDeleteThread}
              onSelectThread={onSelectThread}
            />
          ))
        : null}
    </div>
  );
};

const ThreadListNew: FC<Pick<ThreadListProps, "onNewThread">> = ({
  onNewThread,
}) => {
  return (
    <Button
      variant="outline"
      className="mb-1 h-9 justify-start gap-2 rounded-lg px-3 text-sm hover:bg-muted"
      onClick={onNewThread}
    >
      <PlusIcon className="size-4" />
      新会话
    </Button>
  );
};

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading threads"
          className="aui-thread-list-skeleton-wrapper flex h-9 items-center px-3"
        >
          <Skeleton className="aui-thread-list-skeleton h-4 w-full" />
        </div>
      ))}
    </div>
  );
};

const ThreadListItem: FC<{
  active: boolean;
  thread: StoredThreadSummary;
  onDeleteThread: (threadId: string) => void;
  onSelectThread: (threadId: string) => void;
}> = ({ active, thread, onDeleteThread, onSelectThread }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex h-9 items-center rounded-lg transition-colors hover:bg-muted",
        active && "bg-muted",
      )}
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 items-center px-3 text-left text-sm"
        onClick={() => onSelectThread(thread.id)}
      >
        <span className="min-w-0 flex-1 truncate">
          {thread.title || "新聊天"}
        </span>
      </button>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "mr-1 size-7 shrink-0 p-0 transition-opacity",
              menuOpen
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteThread(thread.id);
            }}
          >
            <TrashIcon className="mr-2 size-4" />
            删除会话
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
