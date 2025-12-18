# Отчет по FSM (Lifecycle State Machine)

Этот документ описывает все состояния и переходы, определенные в `seed-fsm.ts` для версии **v1.0.0 Core Lifecycle FSM**.

## 1. Состояния (States)

| Код (Code) | Описание | Тип | Координаты (X, Y) |
| :--- | :--- | :--- | :--- |
| **NEW** | Lifecycle: NEW | Начальное | 0, 0 |
| **ACTIVATING** | Lifecycle: ACTIVATING | Промежуточное | 250, 0 |
| **ACTIVE_FREE** | Lifecycle: ACTIVE_FREE | Основное (Free) | 500, 0 |
| **PAYWALL** | Lifecycle: PAYWALL | Ограничение (Paywall) | 500, 300 |
| **PAID_ACTIVE** | Lifecycle: PAID_ACTIVE | Основное (Paid) | 750, 0 |
| **INACTIVE** | Lifecycle: INACTIVE | Неактивное | 500, 600 |
| **CHURNED** | Lifecycle: CHURNED | Терминальное (Отток) | 500, 900 |
| **BLOCKED** | Lifecycle: BLOCKED | Терминальное (Блок) | 1000, 900 |

---

## 2. Переходы (Transitions)

Переходы сгруппированы по логическим блокам.

### Глобальные переходы (Global)
Действуют из **любого** состояния (кроме BLOCKED/Self).

1. **ANY → PAID_ACTIVE**
   - **Триггер:** `EVENT: PAYMENT_COMPLETED`
   - **Приоритет:** 100 (Высокий)
   - **Описание:** Успешная оплата всегда активирует пользователя в платный статус.

2. **ANY → BLOCKED**
   - **Триггер:** `EVENT: USER_BLOCKED`
   - **Приоритет:** 100 (Высокий)
   - **Описание:** Блокировка пользователем из админки.

3. **ANY → INACTIVE**
   - **Триггер:** `EVENT: USER_UNBLOCKED`
   - **Приоритет:** 50
   - **Описание:** При разблокировке пользователь попадает в статус INACTIVE.

### Онбординг и Активация (Onboarding / Activation)

4. **NEW → ACTIVATING**
   - **Триггер:** `EVENT: GENERATION_COMPLETED`
   - **Условие:** `totalGenerations >= 1`
   - **Описание:** Пользователь сделал первую генерацию.

5. **ACTIVATING → ACTIVE_FREE**
   - **Триггер:** `EVENT: GENERATION_COMPLETED`
   - **Условие:** `totalGenerations >= 2`
   - **Описание:** Пользователь вовлекся (сделал 2 или более генераций).

6. **NEW → INACTIVE**
   - **Триггер:** `EVENT: LAST_ACTIVITY`
   - **Условие:** `hoursSinceLastActivity > 24`
   - **Описание:** Пользователь забросил бота сразу после старта (24ч бездействия).

7. **ACTIVATING → INACTIVE**
   - **Триггер:** `EVENT: LAST_ACTIVITY`
   - **Условие:** `hoursSinceLastActivity > 24`
   - **Описание:** Пользователь забросил бота на этапе активации.

### Цикл Free (Free Loop)

8. **ACTIVE_FREE → PAYWALL**
   - **Триггер:** `EVENT: CREDITS_CHANGED`
   - **Условие:** `credits < 5.1`
   - **Описание:** Закончились бесплатные кредиты.

9. **NEW → PAYWALL**
   - **Триггер:** `EVENT: CREDITS_CHANGED`
   - **Условие:** `credits < 5.1`
   - **Описание:** Кредиты закончились сразу на старте (редкий кейс).

10. **ACTIVATING → PAYWALL**
    - **Триггер:** `EVENT: CREDITS_CHANGED`
    - **Условие:** `credits < 5.1`
    - **Описание:** Кредиты закончились во время активации.

11. **ACTIVE_FREE → INACTIVE**
    - **Триггер:** `EVENT: LAST_ACTIVITY`
    - **Условие:** `hoursSinceLastActivity > 24`
    - **Описание:** Пользователь на Free тарифе перестал пользоваться ботом.

### Пейвол (Paywall)

12. **PAYWALL → INACTIVE**
    - **Триггер:** `EVENT: LAST_ACTIVITY`
    - **Условие:** `hoursSinceLastActivity > 24`
    - **Описание:** Пользователь уперся в пейвол и не купил в течение 24 часов.

### Цикл Paid (Paid Loop)

13. **PAID_ACTIVE → PAYWALL**
    - **Триггер:** `EVENT: CREDITS_CHANGED`
    - **Условие:** `credits < 5.1`
    - **Описание:** Закончились платные кредиты.

14. **PAID_ACTIVE → INACTIVE**
    - **Триггер:** `EVENT: LAST_ACTIVITY`
    - **Условие:** `hoursSinceLastActivity > 168` (7 дней)
    - **Описание:** Платный пользователь "остыл" (не пользовался неделю).

### Возврат и Отток (Inactivity & Churn)

15. **INACTIVE → ACTIVE_FREE**
    - **Триггер:** `EVENT: GENERATION_COMPLETED`
    - **Условие:** `credits > 0`
    - **Описание:** "Возвращенец". Пользователь вернулся и что-то сгенерировал (при наличии кредитов).

16. **INACTIVE → CHURNED**
    - **Триггер:** `TIME: 10080 минут` (7 дней)
    - **Описание:** Окончательный отток. Пользователь был неактивен еще 7 дней в статусе INACTIVE.
