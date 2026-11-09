# FastLang
## О проекте

FastLang - это веб-сервис для изучения иностранных языков, который помогает сделать обучение более удобным и интересным.

Идея проекта заключается в том, чтобы объединить практику общения, интерактивные задания и учебные материалы на одной платформе. Мы считаем, что для изучения языка недостаточно только запоминать слова и учить грамматику - важно также регулярно использовать язык на практике.

## Основные возможности

- **Поиск языкового партнёра** - возможность найти человека для практики иностранного языка.
- **Интерактивные задания** - короткие упражнения для развития языковых навыков.
- **Обратная связь от ИИ** - помощь в обнаружении ошибок и улучшении знаний.
- **Курсы и учебные материалы** - дополнительные ресурсы для изучения языков.

## Используемые технологии

При разработке проекта использовались следующие технологии:

- HTML - структура страниц сайта.
- CSS и SCSS - оформление и стилизация интерфейса.
- JavaScript - интерактивность и функциональность сайта.
- Дополнительные плагины - расширение возможностей интерфейса.
- MongoDB - хранение данных.

Серверная часть отвечает за обработку запросов и взаимодействие с базой данных.

## Демо-версия

Проект размещён на платформе Railway и доступен по ссылке:
https://fastlang-production.up.railway.app/index.html

## Запуск проекта

Для запуска фронтенда локально:

1. Склонируйте репозиторий:
   ```bash
   git clone https://github.com/Narn1a/FastLang.git
   ```
2. Откройте папку проекта.
3. Откройте файл `index.html` в браузере.

Для запуска серверной части следуйте инструкциям в папке бэкенда. Перед запуском необходимо настроить переменные окружения и подключение к MongoDB.

## Команда проекта

FastLang - студенческий стартап, разработанный командой из четырёх человек.

- **Лаврушин Михаил** - [backend/frontend разработка].
- **Ерболат Молдир** - [разработка и оформление страниц сайта].
- **Базарбекова Аружан** - [роль и вклад в проект].
- **Арыстан** - [роль и вклад в проект].

## Наша цель

Мы хотим сделать изучение иностранных языков более доступным и практичным, объединив общение, упражнения и учебные материалы в одном сервисе.


## What's new in v4

- **AI tutor** - a chat bubble on every lesson and course page. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-haiku-5-5`) before `node server.js` for full AI answers. Without a key a basic built-in tutor still explains the lesson, quizzes and gives memory tips. The tutor reads the real lesson page on the server, so it always knows what you are studying.
- **Progress path** - each course overview is now a winding Duolingo-style path with locked / current / done lessons, an animated trail, XP and a day streak.
- **Reward chest** - finishing every lesson unlocks the chest at the end of the path. Opening it grants coins (150 for the main courses, 250 for the advanced ones). A chest can only be opened once per course.
- **Shop** (`shop.html`) - spend coins on Streak Freezes, path themes, chest skins and badges.
- **Advanced courses** - Advanced English, Advanced Japanese and Advanced Italian (6 lessons each), linked from `courses.html`.

Logged-in users have progress, coins and purchases saved on the server (in `data/users.json` or MongoDB). Guests keep them in the browser. All game rules live in `public/js/fl_core.js`, shared by the browser and the server. Courses and shop items are defined in `public/data/catalog.json`.

```
npm start                              # basic tutor
ANTHROPIC_API_KEY=sk-ant-... npm start # full AI tutor
```


## What's new in v5

- **Tutor that never goes silent** - if the AI key is missing or invalid (or the AI call fails), the chat now answers from ~55 predetermined, keyword-matched answers (`public/js/fl_tutor.js`): study plans, memory tricks, pronunciation, how coins/chests/the shop work, and grammar topics for English, Japanese and Italian. It also explains any word or phrase from the lesson you are on, runs quizzes and checks your answers, and offers clickable follow-up questions. A rejected key is remembered for 10 minutes so the API is not hit on every message. If the server itself cannot be reached, the same tutor runs in the browser. To add answers, edit the `KB` list in `fl_tutor.js`.
- **New courses** - Intermediate English, Introduction to Kanji and Intermediate Italian (8 lessons each, 200 coin chests). Each language now runs Introductory (10) -> Intermediate (8) -> Advanced (6). Definitions live in `public/data/catalog.json`.
- **Courses landing page** - new hero banner, patterned section backgrounds and nine custom cover illustrations (`public/images/courses_hero.svg`, `courses_pattern.svg`, `images/courses/*.svg`), with real course descriptions and lesson counts. Styles are in `styles/courses_landing.css`.
