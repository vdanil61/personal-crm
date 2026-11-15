ALTER TABLE "contacts" ADD COLUMN "birthday_day" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_month" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_year" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_check" CHECK (case
      when "contacts"."birthday_day" is null and "contacts"."birthday_month" is null and "contacts"."birthday_year" is null then true
      when "contacts"."birthday_day" is null or "contacts"."birthday_month" is null then false
      when "contacts"."birthday_day" not between 1 and 31 or "contacts"."birthday_month" not between 1 and 12 then false
      when "contacts"."birthday_year" is not null and "contacts"."birthday_year" not between 1 and 9999 then false
      else "contacts"."birthday_day" <= extract(day from (make_date(coalesce("contacts"."birthday_year", 2000), "contacts"."birthday_month", 1) + interval '1 month - 1 day'))
    end);