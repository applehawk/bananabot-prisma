# BananaBot Prisma Schema

Shared Prisma schema and database client for BananaBot ecosystem.

## Структура

```
bananabot-prisma/
├── schema.prisma       # Prisma schema definition
├── migrations/         # Database migrations
├── package.json        # Package configuration
└── README.md          # This file
```

## Использование

### Как git submodule

Этот репозиторий используется как git submodule в:
- `bananabot` - основной Telegram бот
- `bananabot-admin` - административная панель

### Установка

```bash
npm install
# или
pnpm install
```

### Генерация Prisma Client

```bash
npm run generate
# или
pnpm generate
```

### Миграции

```bash
# Применить миграции (production)
npm run migrate

# Создать новую миграцию (development)
npm run migrate:dev

# Push изменений schema напрямую в БД (development)
npm run db:push
```

### Prisma Studio

Запустить Prisma Studio для просмотра/редактирования данных:

```bash
npm run studio
```

## Переменные окружения

Создайте файл `.env` с подключением к базе данных:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bananabot?schema=public"
```

## Обновление submodules

После внесения изменений в schema, обновите submodules в родительских репозиториях:

```bash
# В bananabot
cd /path/to/bananabot
git submodule update --remote prisma

# В bananabot-admin
cd /path/to/bananabot-admin
git submodule update --remote prisma
```

## Schema

Prisma schema включает модели для:
- `User` - пользователи бота
- `ImageGeneration` - история генераций изображений
- `Transaction` - транзакции и платежи
- `Package` - тарифные планы
- `AdminUser` - пользователи админ-панели
- И другие...

## Связанные репозитории

- **BananaBot:** [applehawk/pb-bananabot](https://github.com/applehawk/pb-bananabot)
- **BananaBot Admin:** [applehawk/bananabot-admin](https://github.com/applehawk/bananabot-admin)
