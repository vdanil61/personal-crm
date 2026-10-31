import { connection } from "next/server";
import { Suspense } from "react";

import { BackToList } from "@/components/contacts/back-to-list";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { DeleteGroupButton } from "@/components/groups/delete-group-button";
import { RenameGroupDialog } from "@/components/groups/rename-group-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";
import { listGroups } from "@/lib/groups";

export default function GroupsPage() {
  return (
    <>
      <BackToList />
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:mb-8">
        <h1 className="text-page-title lg:text-page-title-lg">Группы</h1>
        <CreateGroupDialog />
      </div>
      <Suspense fallback={<GroupListSkeleton />}>
        <GroupList />
      </Suspense>
    </>
  );
}

async function GroupList() {
  // Read at request time, never from a build-time prerender: the build has no database
  await connection();
  const groups = await listGroups();

  if (groups.length === 0) {
    return (
      <p className="bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Групп пока нет. Нажмите «Создать группу».
      </p>
    );
  }

  return (
    <ul className="divide-y bg-card">
      {groups.map((group) => (
        <li key={group.id} className="flex min-h-17 items-center gap-2 py-3 pr-3 pl-4 sm:gap-3 lg:pr-5 lg:pl-5">
          {/* The name and the number of people: one under the other on phones, in a line on wide screens */}
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <span className="truncate font-medium">{group.name}</span>
            <span className="shrink-0 text-sm font-light text-muted-foreground">
              <span aria-hidden className="max-sm:hidden">
                {"· "}
              </span>
              {pluralize(group.peopleCount, ["человек", "человека", "человек"])}
            </span>
          </div>
          <RenameGroupDialog group={{ id: group.id, name: group.name }} />
          <DeleteGroupButton group={group} />
        </li>
      ))}
    </ul>
  );
}

function GroupListSkeleton() {
  return (
    <div aria-busy aria-label="Загружаю группы" className="divide-y bg-card">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex min-h-17 items-center gap-3 px-4 py-3 lg:px-5">
          <Skeleton className="h-5 w-40" />
        </div>
      ))}
    </div>
  );
}
