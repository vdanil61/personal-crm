INSERT INTO "groups" ("name") VALUES ('Аналитики'), ('Друзья'), ('Знакомые'), ('Семья'), ('Теннис') ON CONFLICT DO NOTHING;
