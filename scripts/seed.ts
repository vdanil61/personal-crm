// Fills an empty database with realistic test contacts and notes.
// Usage: pnpm db:seed [count]   (default: 1000)
import { fakerRU as faker } from "@faker-js/faker";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { contacts, notes } from "../src/db/schema";
import { getDatabaseUrl, loadEnvFile } from "../src/db/url";

type Sex = "male" | "female";

const MALE_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим", "Василий", "Виктор", "Виталий",
  "Владимир", "Владислав", "Глеб", "Григорий", "Даниил", "Денис", "Дмитрий", "Евгений", "Егор", "Иван",
  "Игорь", "Илья", "Кирилл", "Константин", "Лев", "Леонид", "Максим", "Марк", "Матвей", "Михаил",
  "Никита", "Николай", "Олег", "Павел", "Пётр", "Роман", "Руслан", "Семён", "Сергей", "Станислав",
  "Степан", "Тимур", "Фёдор", "Юрий", "Ярослав",
];

const FEMALE_NAMES = [
  "Алёна", "Алина", "Алиса", "Анастасия", "Анна", "Валерия", "Варвара", "Вера", "Вероника", "Виктория",
  "Галина", "Дарья", "Диана", "Ева", "Екатерина", "Елена", "Елизавета", "Жанна", "Зоя", "Ирина",
  "Карина", "Ксения", "Лариса", "Лидия", "Любовь", "Людмила", "Маргарита", "Марина", "Мария", "Надежда",
  "Наталья", "Нина", "Оксана", "Ольга", "Полина", "Светлана", "София", "Таисия", "Татьяна", "Ульяна",
  "Юлия", "Яна",
];

const PROFESSIONS = [
  "дизайнер интерфейсов", "фронтенд-разработчик", "бэкенд-разработчик", "юрист", "бухгалтер", "врач-терапевт",
  "стоматолог", "фотограф", "риелтор", "тренер по плаванию", "преподаватель английского", "продакт-менеджер",
  "архитектор", "журналист", "психолог", "автомеханик", "маркетолог", "HR в IT-компании", "владелец кофейни",
  "музыкант", "переводчик", "аналитик данных", "инженер-строитель", "SMM-специалист", "нотариус",
  "мастер по ремонту квартир", "ветеринар", "сомелье", "основатель стартапа", "учитель математики",
  "финансовый консультант", "видеомонтажёр", "редактор", "пиар-менеджер", "event-менеджер", "кондитер",
];

const RELATIONS: Record<Sex, string[]> = {
  male: [
    "друг детства", "бывший коллега", "сосед по подъезду", "одногруппник", "брат жены", "двоюродный брат",
    "бывший руководитель", "клиент по фрилансу", "наставник", "партнёр по теннису", "сосед по даче",
    "друг друзей", "одноклассник",
  ],
  female: [
    "подруга детства", "бывшая коллега", "соседка по подъезду", "одногруппница", "сестра жены",
    "двоюродная сестра", "бывшая руководительница", "клиентка по фрилансу", "наставница",
    "партнёрша по теннису", "соседка по даче", "подруга друзей", "одноклассница",
  ],
};

const UNIVERSITIES = ["МГУ", "Вышке", "МФТИ", "СПбГУ", "Бауманке", "ИТМО", "УрФУ", "НГУ", "КФУ"];
const COMPANIES = [
  "агентстве «Пиксель»", "стартапе «Облако»", "банке", "издательстве «Северный ветер»", "студии «Квадрат»",
  "логистической компании", "школе программирования", "консалтинге", "редакции городского журнала",
];
const PLACES = ["в Казань", "в Калининград", "в Сочи", "на Алтай", "в Карелию", "на Байкал", "в Стамбул", "в Ереван", "в Тбилиси"];
const EVENTS = [
  "конференции по продуктовому дизайну", "хакатоне", "книжной ярмарке", "фестивале уличной еды",
  "митапе фронтендеров", "лекции в музее", "благотворительном забеге",
];
const HOBBIES = [
  "настольные игры", "горные лыжи", "джаз", "велосипед", "рыбалку", "йогу", "фотографию на плёнку",
  "кулинарию", "бег", "театр", "походы", "шахматы",
];
const TOPICS = [
  "переезд в другой город", "поиск работы", "ремонт на кухне", "идею совместного проекта", "покупку машины",
  "отпуск в Грузии", "курсы по Python", "выбор школы для ребёнка", "запуск своего дела", "ипотеку",
];
const BOOKS = ["Мастер и Маргарита", "Сто лет одиночества", "Думай медленно… решай быстро", "Атлант расправил плечи", "Шантарам"];
const MONTHS = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

const pick = <T>(items: readonly T[]): T => faker.helpers.arrayElement(items);
const chance = (probability: number) => faker.datatype.boolean({ probability });
const gender = (sex: Sex, male: string, female: string) => (sex === "male" ? male : female);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("ru") + text.slice(1);

function makeAbout(sex: Sex): string | null {
  if (chance(0.12)) return null;
  const profession = pick(PROFESSIONS);
  const relation = pick(RELATIONS[sex]);
  const variant = faker.number.int(2);
  if (variant === 0) return capitalize(profession);
  if (variant === 1) return capitalize(relation);
  return `${capitalize(profession)}, ${relation}`;
}

function makeHowWeMet(sex: Sex): string | null {
  if (chance(0.1)) return null;
  const friendSex: Sex = chance(0.5) ? "male" : "female";
  const friend = pick(friendSex === "male" ? MALE_NAMES : FEMALE_NAMES);
  const year = faker.number.int({ min: 2008, max: 2025 });
  return pick([
    () => `Учились вместе в школе №${faker.number.int({ min: 1, max: 1500 })}`,
    () => `Учились на одном потоке в ${pick(UNIVERSITIES)}`,
    () => `Работали вместе в ${pick(COMPANIES)}`,
    () => `Познакомились на ${pick(EVENTS)} в ${year} году`,
    () => `Познакомились в поездке ${pick(PLACES)}`,
    () => `Нас познакомил${gender(friendSex, "", "а")} ${friend}`,
    () => "Были вместе на свадьбе общих друзей",
    () => "Ходим в один спортзал",
    () => "Вместе играем в футбол по субботам",
    () => "Познакомились на курсах английского",
    () => "Соседи по даче",
    () => "Вместе были в летнем лагере",
    () => "Родители дружат с детства",
    () => `${gender(sex, "Продавал", "Продавала")} мне велосипед по объявлению, разговорились`,
    () => `Ходили вместе в поход на Эльбрус в ${year} году`,
  ])();
}

function makeNote(sex: Sex): string {
  const pronoun = gender(sex, "он", "она");
  return pick([
    () => `Созвонились, обсудили ${pick(TOPICS)}. Договорились вернуться к разговору в ${pick(MONTHS)}.`,
    () => `Встретились на кофе. ${gender(sex, "Рассказал", "Рассказала")} про ${pick(TOPICS)}, звучит интересно.`,
    () => `${gender(sex, "Обещал", "Обещала")} прислать контакты хорошего ${pick(["юриста", "стоматолога", "риелтора", "автомеханика", "репетитора"])}.`,
    () => `Созвонились в день рождения. Любит ${pick(HOBBIES)} — запомнить для подарка.`,
    () => `Договорились вместе сходить на ${pick(["концерт", "выставку", "матч", "спектакль", "стендап"])} в ${pick(MONTHS)}.`,
    () => `${gender(sex, "Попросил", "Попросила")} совета про ${pick(TOPICS)}. Обменялись ссылками — спросить потом, пригодились ли.`,
    () => `Переехал${gender(sex, "", "а")} в ${pick(["Москву", "Петербург", "Казань", "Новосибирск", "Екатеринбург", "Белград", "Алматы"])}. Новый номер — в карточке.`,
    () => `${gender(sex, "Помог", "Помогла")} с ${pick(["переездом", "резюме", "выбором ноутбука", "ремонтом", "документами"])}. Надо отблагодарить — ${pronoun} любит ${pick(HOBBIES)}.`,
    () => `Обсудили возможную совместную работу. Жду от ${gender(sex, "него", "неё")} предложение до конца месяца.`,
    () => `Надо вернуть ${gender(sex, "ему", "ей")} книгу «${pick(BOOKS)}».`,
    () => `Ищет ${pick(["квартиру в аренду", "новую работу", "хорошего тренера", "няню", "подрядчика на ремонт"])}. Если услышу — сказать.`,
    () => `Встретились случайно в ${pick(["метро", "торговом центре", "парке", "аэропорту"])}. Договорились созвониться на следующей неделе.`,
    () => `Списались по поводу ${pick(TOPICS)}. ${capitalize(pronoun)} пока думает, напомнить через пару недель.`,
  ])();
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const translit = (text: string) =>
  [...text.toLocaleLowerCase("ru")].map((char) => TRANSLIT[char] ?? char).join("");

function makeEmail(firstName: string, lastName: string): string {
  const first = translit(firstName);
  const last = translit(lastName);
  const local = pick([`${first}.${last}`, `${first}${last}`, `${first[0]}.${last}`, `${last}.${first}`, `${first}_${last}`]);
  const suffix = chance(0.3) ? String(faker.number.int({ min: 1, max: 99 })) : "";
  return `${local}${suffix}@${pick(["gmail.com", "yandex.ru", "mail.ru", "icloud.com", "outlook.com"])}`;
}

function makePhone(): string {
  const digits = faker.string.numeric(9);
  return `+7 9${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

function notesCount(): number {
  const roll = faker.number.float();
  if (roll < 0.4) return 0;
  if (roll < 0.7) return 1;
  if (roll < 0.9) return faker.number.int({ min: 2, max: 3 });
  return faker.number.int({ min: 4, max: 6 });
}

function buildData(total: number) {
  const now = new Date();
  const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
  const contactRows: (typeof contacts.$inferInsert)[] = [];
  const noteRows: (typeof notes.$inferInsert)[] = [];

  for (let i = 0; i < total; i++) {
    const sex: Sex = chance(0.5) ? "male" : "female";
    const firstName = pick(sex === "male" ? MALE_NAMES : FEMALE_NAMES);
    const lastName = faker.person.lastName(sex);
    const id = faker.string.uuid();
    const createdAt = faker.date.between({ from: threeYearsAgo, to: now });

    const noteDates = faker.date
      .betweens({ from: createdAt, to: now, count: notesCount() })
      .sort((a, b) => a.getTime() - b.getTime());
    for (const date of noteDates) {
      noteRows.push({ contactId: id, body: makeNote(sex), createdAt: date });
    }

    contactRows.push({
      id,
      // A few people are saved by first name only, as in a real phone book
      name: chance(0.04) ? firstName : `${firstName} ${lastName}`,
      about: makeAbout(sex),
      howWeMet: makeHowWeMet(sex),
      phone: chance(0.85) ? makePhone() : null,
      email: chance(0.7) ? makeEmail(firstName, lastName) : null,
      createdAt,
      updatedAt: noteDates.at(-1) ?? createdAt,
    });
  }

  return { contactRows, noteRows };
}

async function main() {
  loadEnvFile();
  const total = Number(process.argv[2] ?? 1000);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`Contact count must be a positive integer, got "${process.argv[2]}"`);
  }

  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const db = drizzle(pool);

  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      console.log(`Database already has ${existing} contacts, seeding skipped to keep your data intact.`);
      return;
    }

    faker.seed(2026);
    const { contactRows, noteRows } = buildData(total);

    await db.transaction(async (tx) => {
      for (let i = 0; i < contactRows.length; i += 500) {
        await tx.insert(contacts).values(contactRows.slice(i, i + 500));
      }
      for (let i = 0; i < noteRows.length; i += 1000) {
        await tx.insert(notes).values(noteRows.slice(i, i + 1000));
      }
    });

    console.log(`Seeded ${contactRows.length} contacts and ${noteRows.length} notes.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
