"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { setContactGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GroupOption } from "@/lib/form-state";
import { contactListHref } from "@/lib/search";

type Change = { groupId: string; member: boolean };

// The "Группы" row of the contact card: the groups of the person and a list with ticks to change them.
// A tick shows at once and is saved in the background; if saving fails, the tick goes back and a message appears.
export function ContactGroups({
  contactId,
  groups,
  memberIds,
}: {
  contactId: string;
  // All groups, in the order they are shown
  groups: GroupOption[];
  // The groups the contact is in, as the server has them
  memberIds: string[];
}) {
  const [currentIds, applyChange] = useOptimistic(memberIds, (ids, { groupId, member }: Change) =>
    member ? [...ids.filter((id) => id !== groupId), groupId] : ids.filter((id) => id !== groupId),
  );
  const [, startTransition] = useTransition();

  const memberGroups = groups.filter((group) => currentIds.includes(group.id));

  function tick(groupId: string, member: boolean) {
    startTransition(async () => {
      applyChange({ groupId, member });
      try {
        const result = await setContactGroup(contactId, groupId, member);
        if (result.status === "error") toast.error(result.message);
      } catch {
        // No connection: without the catch the error page would replace this one
        toast.error("Не удалось сохранить группы: нет связи с сервером. Попробуйте ещё раз.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {memberGroups.length === 0 ? (
        <span className="font-light text-muted-foreground">не указано</span>
      ) : (
        memberGroups.map((group) => (
          // The main page with only this group selected and nothing in the search
          <Link
            key={group.id}
            href={contactListHref({ filter: { mode: "groups", ids: [group.id] } })}
            className="inline-flex h-8 items-center bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] focus-visible:ring-2 focus-visible:ring-ring max-sm:h-9"
          >
            {group.name}
          </Link>
        ))
      )}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" className="h-8 text-sm max-sm:h-11" />}>
          <PencilIcon data-icon="inline-start" />
          Изменить группы
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-0 rounded-none p-1 shadow-card max-sm:w-[min(22rem,calc(100vw-3.5rem))]">
          {groups.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              Групп пока нет. Создайте их на странице{" "}
              <Link href="/groups" className="font-medium text-primary-strong hover:underline">
                «Группы»
              </Link>
              .
            </p>
          ) : (
            <>
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex h-10 cursor-pointer items-center gap-3 px-2 text-sm hover:bg-muted max-sm:h-12 max-sm:text-base"
                >
                  <Checkbox
                    checked={currentIds.includes(group.id)}
                    onCheckedChange={(checked) => tick(group.id, checked)}
                    className="size-4.5 rounded-none"
                  />
                  {group.name}
                </label>
              ))}
              <p className="mt-1 border-t px-2 pt-2 pb-1.5 text-xs text-muted-foreground">Отметка сохраняется сразу</p>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
