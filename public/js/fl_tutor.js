/* FastLang built-in tutor: predetermined answers chosen by keywords.
 * Used by server.js whenever the AI is unavailable (no key, invalid key, network error) and by the browser
 * when the server cannot be reached at all. No dependencies.
 * reply(ctx, messages) -> { reply, suggest[] }
 * ctx = { name, lang, lesson, title, intro, head[], rows[][], notes[], practice, titles[], total, reward } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FLTutor = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var DEFAULT_SUGGEST = ['Explain this lesson simply', 'Quiz me on it', 'Give me a memory trick', 'How do coins work?'];

  /* ---------- keyword matching ---------- */
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function has(text, kw) {
    if (/[^\x00-\x7f]/.test(kw)) return text.indexOf(kw) !== -1;           // Japanese etc: plain substring
    var prefix = kw.slice(-1) === '*'; if (prefix) kw = kw.slice(0, -1);
    return new RegExp('(^|[^a-z0-9])' + esc(kw) + (prefix ? '' : '([^a-z0-9]|$)')).test(text);
  }
  function score(text, kws) { var n = 0; kws.forEach(function (k) { if (has(text, k)) n += k.indexOf(' ') > -1 ? 2 : 1; }); return n; }

  /* ---------- helpers on the lesson context ---------- */
  function ansCol(ctx) {
    for (var i = 1; i < (ctx.head || []).length; i++) if (/mean|english/i.test(ctx.head[i])) return i;
    return 1;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rowLine(ctx, r) {
    var c = ansCol(ctx), extra = r.filter(function (x, i) { return i !== 0 && i !== c; }).join(' / ');
    return '\u201c' + r[0] + '\u201d = ' + (r[c] || '') + (extra ? ' (' + extra + ')' : '');
  }
  function lessonOnly(ctx) { return ctx.lesson ? null : 'Open one of the lessons and ask me again - I can then use the exact phrases on that page. Meanwhile, ask about study tips, the shop or the chest.'; }

  /* ---------- answers that need the lesson on screen ---------- */
  var dyn = {
    explain: function (ctx) {
      if (!ctx.lesson) return ctx.name + ': ' + (ctx.intro || 'work through the lessons in order.') + (ctx.titles.length ? '\nLessons: ' + ctx.titles.map(function (t, i) { return (i + 1) + '. ' + t; }).join('; ') + '.' : '');
      var c = ansCol(ctx);
      return ctx.title + ': ' + (ctx.intro || '') + '\nKey items: ' + ctx.rows.slice(0, 4).map(function (r) { return r[0] + ' (' + (r[c] || '') + ')'; }).join('; ') + '.' + (ctx.notes[0] ? '\nRemember: ' + ctx.notes[0] : '');
    },
    quiz: function (ctx) {
      var m = lessonOnly(ctx); if (m) return 'Quizzes work inside a lesson. ' + m;
      if (!ctx.rows.length) return 'There is no table to quiz on in this lesson. Try the practice task instead: ' + (ctx.practice || 'write three sentences of your own.');
      var r = pick(ctx.rows);
      return 'Quiz: What does \u201c' + r[0] + '\u201d mean or how is it used? Type your answer and I will check it.';
    },
    practice: function (ctx) { return lessonOnly(ctx) || ('Your practice task: ' + (ctx.practice || 'write three sentences of your own using this lesson.') + '\nWrite it down, say it aloud, then press Complete.'); },
    notes: function (ctx) { return lessonOnly(ctx) || (ctx.notes.length ? 'Good to know:\n' + ctx.notes.map(function (n) { return '- ' + n; }).join('\n') : 'There are no extra notes on this page. Look at the table and say each item aloud.'); },
    words: function (ctx) { return lessonOnly(ctx) || ('In this lesson:\n' + ctx.rows.slice(0, 8).map(function (r) { return '- ' + rowLine(ctx, r); }).join('\n')); },
    coins: function (ctx) {
      return 'Finish every lesson in a course to unlock the chest at the end of its path. Opening it gives coins' + (ctx.reward ? ' (' + ctx.reward + ' for this course)' : ' (150 for introductory, 200 for intermediate, 250 for advanced courses)') + '. You can open each chest once. Spend coins in the Shop on streak freezes, themes, chest skins and badges.';
    },
    next: function (ctx) {
      if (ctx.lesson && ctx.total) return ctx.lesson < ctx.total ? 'Next is lesson ' + (ctx.lesson + 1) + '. Press \u201cComplete & next lesson\u201d when you are ready - lessons unlock in order.' : 'This is the last lesson! Complete it to unlock the reward chest on the course path.';
      return 'Start with the highlighted lesson on the path - lessons unlock in order. A good route is Introductory \u2192 Intermediate (or Kanji for Japanese) \u2192 Advanced.';
    }
  };

  /* ---------- the knowledge base: k = keywords, a = answer (text or function), s = follow-up chips, lang = only for that language ---------- */
  var KB = [
    { id: 'greet', k: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'ciao', 'konnichiwa', 'hola', 'yo'], a: 'Hello! I am your FastLang tutor. I can explain this lesson, quiz you, share memory tricks and study plans, or explain coins and the shop. What would you like?' },
    { id: 'thanks', k: ['thanks', 'thank you', 'thx', 'cheers', 'grazie', 'arigatou', 'appreciate'], a: 'You are welcome! Small, regular steps beat long, rare sessions. Keep going.' },
    { id: 'bye', k: ['bye', 'goodbye', 'see you', 'later', 'arrivederci', 'sayonara'], a: 'See you next time! Even five minutes tomorrow keeps your streak alive.' },
    { id: 'who', k: ['who are you', 'what are you', 'your name', 'are you ai', 'are you a bot', 'are you real', 'robot'], a: 'I am the FastLang course tutor. Right now I answer from built-in tips written for these courses, so I am best at explaining your current lesson, quizzing you and giving study advice.' },
    { id: 'help', k: ['help', 'what can you do', 'options', 'commands', 'how do you work', 'menu'], a: 'I can:\n- explain this lesson simply\n- quiz you on its phrases\n- repeat the practice task and the key notes\n- explain a word from the lesson (just type it)\n- give study plans, memory and pronunciation tips\n- explain coins, chests, streaks and the shop', s: ['Explain this lesson simply', 'Quiz me on it', 'Make me a study plan'] },
    { id: 'mode', k: ['api', 'api key', 'key', 'offline', 'mode', 'claude', 'gpt', 'chatgpt', 'smart', 'ai tutor', 'not working', 'broken', 'error'], a: 'I am currently answering from built-in tips, because the AI service is not available (no valid API key is set on this server). I can still explain lessons, quiz you and answer common questions. Site owners: set a valid ANTHROPIC_API_KEY to switch on full AI answers.' },

    { id: 'explain', k: ['explain', 'summary', 'summarize', 'summarise', 'simple', 'simply', 'overview', 'what is this lesson', 'what will i learn', 'what do i learn', 'about this', 'teach me', 'lesson about', 'what.s this'], a: dyn.explain, s: ['Quiz me on it', 'What are the key notes?', 'Show the practice task'] },
    { id: 'quiz', k: ['quiz', 'test me', 'test', 'question', 'questions', 'exam', 'check me', 'examine', 'drill', 'practise me'], a: dyn.quiz, s: ['Another quiz question', 'Explain this lesson simply'] },
    { id: 'practice', k: ['practice', 'practise', 'exercise', 'homework', 'task', 'assignment', 'what should i write'], a: dyn.practice },
    { id: 'notes', k: ['notes', 'rules', 'rule', 'key notes', 'important', 'good to know', 'careful', 'watch out', 'tips for this', 'mistakes in this', 'common mistakes'], a: dyn.notes },
    { id: 'words', k: ['words', 'phrases', 'list', 'vocabulary in', 'vocab in', 'show me the', 'examples', 'example', 'sentences'], a: dyn.words },
    { id: 'next', k: ['next', 'what now', 'what.s next', 'continue', 'finished', 'done', 'complete', 'move on', 'after this', 'which course', 'where to start', 'start', 'level', 'levels'], a: dyn.next },

    { id: 'plan', k: ['plan', 'schedule', 'routine', 'daily', 'every day', 'how often', 'how long', 'how much time', 'habit', 'timetable', 'minutes', 'study plan', 'how should i study', 'how to study', 'what should i study', 'what should i do', 'study'], a: 'A simple plan that works:\n- 10-15 minutes every day beats one long weekend session.\n- Day 1: do a new lesson and say every phrase aloud.\n- Day 2: redo yesterday\'s quiz first, then the next lesson.\n- Once a week: review the whole course path for 15 minutes.\nKeep your streak alive - it builds the habit.', s: ['Give me a memory trick', 'How do streaks work?'] },
    { id: 'motivate', k: ['stuck', 'hard', 'difficult', 'frustrated', 'frustrating', 'give up', 'tired', 'bored', 'boring', 'motivation', 'motivated', 'discouraged', 'overwhelmed', 'can.t do', 'cannot do', 'too much', 'confusing', 'confused', 'lost', 'slow'], a: 'Feeling stuck is a normal part of learning a language - it usually means your brain is building something new. Try this: shrink the goal to just one table row, say it aloud three times, then make a sentence about your own day. Take a break, then come back; progress often shows up after sleep. Small wins count.', s: ['Quiz me on it', 'Give me a memory trick', 'Make me a study plan'] },
    { id: 'memory', k: ['memorize', 'memorise', 'memory', 'remember', 'vocabulary', 'vocab', 'forget', 'forgot', 'flashcard', 'flashcards', 'learn words', 'spaced', 'trick', 'tricks', 'mnemonic', 'retain', 'stick'], a: 'Memory tricks:\n- Say each phrase aloud three times, then cover the meaning and recall it.\n- Make one real sentence about your own life with each new item.\n- Use spaced repetition: review after 1 day, 3 days, then a week.\n- Link a new word to an image or a place, not just a translation.\n- Test yourself instead of re-reading - ask me for a quiz.', s: ['Quiz me on it', 'Make me a study plan'] },
    { id: 'pron', k: ['pronounce', 'pronounced', 'pronunciation', 'accent', 'how do i say', 'sound', 'sounds', 'say it', 'speak clearly', 'intonation', 'stress'], a: 'For pronunciation: listen first, then copy. Say the phrase slowly, then at normal speed; record yourself and compare with a native speaker video. Pay attention to stress and rhythm, not just single sounds.' },
    { id: 'listen', k: ['listening', 'listen', 'understand native', 'podcast', 'podcasts', 'music', 'movies', 'films', 'tv', 'subtitles', 'native speakers', 'too fast'], a: 'To train your ears: listen to short clips (1-3 minutes) several times. First without subtitles, then with subtitles in the same language, then again without. Songs, podcasts for learners and slow news are good starting points.' },
    { id: 'speak', k: ['speaking', 'speak', 'conversation', 'conversations', 'shy', 'nervous', 'confidence', 'partner', 'talk to people', 'practise speaking', 'fluent', 'fluency'], a: 'Speaking tips:\n- Talk to yourself about your day out loud.\n- Learn complete useful sentences, not single words.\n- Find a conversation partner or tutor; mistakes are how you improve.\n- Start with short, simple sentences and build up.' },
    { id: 'write', k: ['writing', 'write', 'essay', 'diary', 'journal', 'text', 'email', 'letter', 'composition'], a: 'Writing tips: keep a short daily diary (3-5 sentences) using the newest lesson. Reuse the patterns from the table, then check them against the examples. Short and correct beats long and risky.' },
    { id: 'grammar', k: ['grammar', 'tense', 'tenses', 'conjugate', 'conjugation', 'conjugations', 'verb forms', 'structure', 'sentence structure', 'word order'], a: 'Learn grammar through examples, not rules alone: take one example sentence from the table, change one word at a time, and say each new sentence aloud. The notes in each lesson list the traps to avoid.', s: ['Explain this lesson simply', 'What are the key notes?'] },
    { id: 'mistakes', k: ['mistake', 'mistakes', 'wrong', 'error', 'errors', 'incorrect', 'correct me', 'i made', 'why did i get'], a: 'Mistakes are useful data. Write down the ones you repeat, find the matching rule in the lesson notes, and make three correct sentences with it. Most errors fade after a few days of focused practice.' },
    { id: 'translate', k: ['translate', 'translation', 'how do you say', 'in japanese', 'in italian', 'in english', 'what is the word for'], a: 'In this mode I can only explain phrases that are in your lessons. Type a word or phrase from the lesson table and I will tell you what it means and how it is used.' },
    { id: 'grade', k: ['native', 'books', 'reading', 'read', 'story', 'stories', 'graded reader'], a: 'For reading, start with graded readers or children\'s stories: short, repetitive and full of everyday words. Read a page, underline 5 new words, and use them in your own sentences.' },

    { id: 'chest', k: ['chest', 'chests', 'open the chest', 'unlock', 'unlocked', 'reward chest', 'treasure', 'end of the path'], a: dyn.coins },
    { id: 'coins', k: ['coins', 'coin', 'earn', 'earning', 'money', 'rich', 'currency', 'reward', 'rewards', 'how do coins work'], a: dyn.coins, s: ['What can I buy?', 'How do streaks work?'] },
    { id: 'shop', k: ['shop', 'buy', 'spend', 'purchase', 'theme', 'themes', 'badge', 'badges', 'skin', 'skins', 'store', 'what can i buy', 'items'], a: 'The Shop (top menu, or click your coins) sells: Streak Freezes (50 coins), path themes (Sunset, Forest, Midnight), chest skins (Golden, Crystal) and badges (Fox, Panda, Owl, Dragon). Themes and skins change how your learning path looks; badges appear next to your coins.' },
    { id: 'streak', k: ['streak', 'streaks', 'freeze', 'flame', 'fire', 'daily goal', 'missed a day', 'lost my streak', 'how do streaks work'], a: 'Your streak counts the days in a row you complete at least one lesson. If you miss a day, a Streak Freeze from the Shop (it is used automatically, you can hold up to 2) keeps the streak alive.' },
    { id: 'xp', k: ['xp', 'experience points', 'points', 'level up', 'score'], a: 'You earn 10 XP for every new lesson you complete, plus a 40 XP bonus when you finish a whole course. XP shows how much you have learned; coins come from the chests.' },
    { id: 'locked', k: ['locked', 'lock', 'can.t open', 'cannot open', 'greyed', 'grey', 'skip', 'skip ahead', 'why can.t i'], a: 'Lessons unlock in order, so you build each skill on the one before. Finish the highlighted lesson on the path and the next one opens. Completed lessons can be revisited any time.' },
    { id: 'progress', k: ['progress', 'reset', 'lost progress', 'saved', 'save', 'disappeared', 'sync', 'login', 'log in', 'account', 'register', 'sign up', 'logged in'], a: 'If you are logged in, your progress, coins and purchases are saved to your account. As a guest they are stored in this browser only, so clearing browser data removes them. Log in or register to keep them safe. \u201cReset progress\u201d restarts a course\'s lessons, but coins you already earned stay yours.' },
    { id: 'courses', k: ['advanced', 'intermediate', 'beginner', 'introductory', 'courses', 'which course', 'recommend', 'in depth', 'in-depth', 'deeper', 'harder', 'more courses', 'kanji course'], a: 'Each language has three steps: Introductory (10 lessons), then Intermediate (8 lessons; Introduction to Kanji for Japanese), then Advanced (6 lessons). Finish a course to open its chest, then move on to the next level from the end of its path.' },

    /* ----- English ----- */
    { id: 'en_articles', lang: 'English', k: ['article', 'articles', 'a an the', 'the or a', 'when to use the'], a: 'Use a / an for one of many or a first mention (I saw a dog). Use the for something specific or already known (The dog was big). Use no article for general plurals and uncountables (Dogs are loyal. Water is essential).' },
    { id: 'en_prep', lang: 'English', k: ['preposition', 'prepositions', 'in on at', 'at on in', 'in or on', 'on or at'], a: 'Time: in + month/year (in May), on + day/date (on Monday), at + clock time (at 6 pm). Place: in a city or room, on a surface, at a point (at the bus stop). Learn prepositions together with their verb or adjective: afraid of, good at, interested in.' },
    { id: 'en_perfect', lang: 'English', k: ['present perfect', 'past simple', 'have been', 'have you ever', 'has been', 'since', 'for how long'], a: 'Present perfect (have + participle) links the past to now: I have lived here for five years. Past simple is for finished actions at a stated time: I moved here in 2021. A finished time word (yesterday, in 2019) always needs the past simple.' },
    { id: 'en_phrasal', lang: 'English', k: ['phrasal', 'phrasal verb', 'phrasal verbs', 'give up', 'look forward', 'put off', 'turn down', 'run out'], a: 'Phrasal verbs = verb + small word, and the meaning often changes (give up = quit). Some are separable: turn the offer down / turn down the offer, but with a pronoun it must be in the middle: turn it down. Learn them inside a sentence, not as a list.' },
    { id: 'en_cond', lang: 'English', k: ['conditional', 'conditionals', 'if sentences', 'if clause', 'would have', 'wish', 'unless'], a: 'Conditionals: zero (If you heat ice, it melts), first (If it rains, we will stay), second (If I won, I would travel), third (If I had studied, I would have passed). Never put will or would in the if-part.' },
    { id: 'en_modal', lang: 'English', k: ['modal', 'modals', 'must', 'have to', 'mustn.t', 'should', 'can or could', 'may or might'], a: 'Must = strong personal obligation; have to = an outside rule. Mustn\'t = forbidden; don\'t have to = not necessary. Should = advice. Modals have no -s in the third person and take the bare infinitive: She can swim.' },
    { id: 'en_th', lang: 'English', k: ['th sound', 'th', 'thank', 'think', 'this and that', 'r and l', 'silent letters', 'spelling'], a: 'For the English \u201cth\u201d, put the tip of your tongue lightly between your teeth: voiceless in think, voiced in this. English spelling is irregular, so learn the pronunciation together with each new word instead of guessing from the letters.' },
    { id: 'en_relative', lang: 'English', k: ['relative', 'who or which', 'which or that', 'whose', 'defining'], a: 'Who is for people, which for things, that for either in defining clauses, whose for possession. Defining clauses have no commas (The man who called is here); non-defining ones add extra information with commas (My brother, who lives in Rome, is a chef).' },

    /* ----- Japanese ----- */
    { id: 'jp_scripts', lang: 'Japanese', k: ['hiragana', 'katakana', 'kanji', 'scripts', 'alphabet', 'writing system', 'romaji', 'characters'], a: 'Japanese uses three scripts: hiragana (native words and grammar), katakana (foreign words) and kanji (meaning-carrying characters). Romaji is only a helper. Learn hiragana first, then katakana, then add kanji a few at a time - the Introduction to Kanji course does exactly that.' },
    { id: 'jp_particles', lang: 'Japanese', k: ['particle', 'particles', 'wa and ga', 'wa ga', 'は', 'が', 'を', 'に', 'で', 'へ', 'の'], a: 'Key particles: は marks the topic, が the subject, を the object, に a time, destination or target, で the place of an action or a tool, の shows possession, も means \u201calso\u201d. The particle comes right after the word it marks: 私は学生です (watashi wa gakusei desu).' },
    { id: 'jp_polite', lang: 'Japanese', k: ['polite', 'casual', 'plain form', 'desu masu', 'formal', 'informal', 'politeness', 'keigo', 'honorific', 'humble', '敬語'], a: 'Use ます/です with teachers, colleagues and strangers, and the plain form with close friends and family. Keigo goes further: respectful forms (いらっしゃる, 召し上がる) raise the other person; humble forms (申します, いただく) lower yourself. Never use respectful forms about yourself.' },
    { id: 'jp_te', lang: 'Japanese', k: ['te form', 'te-form', 'てform', 'て形', 'kudasai', 'please do', 'te kudasai'], a: 'The te-form depends on the verb ending: う/つ/る \u2192 って, む/ぶ/ぬ \u2192 んで, く \u2192 いて, ぐ \u2192 いで, す \u2192 して. 行く is the exception (行って). With ください it makes a request: 待ってください = please wait.' },
    { id: 'jp_kanji_read', lang: 'Japanese', k: ['read kanji', 'reading kanji', 'how do i read', 'on and kun', 'kanji reading', 'kanji readings', 'on reading', 'kun reading', 'onyomi', 'kunyomi', 'on.yomi', 'kun.yomi', 'readings', 'how to read kanji', 'stroke', 'stroke order', 'radical', 'radicals'], a: 'Most kanji have two kinds of readings: on\'yomi (Chinese-derived, used in compounds like 学校 gakkou) and kun\'yomi (native Japanese, used alone or with okurigana like 食べる taberu). Learn kanji inside words, and write them top to bottom, left to right, outside before inside.' },
    { id: 'jp_counter', lang: 'Japanese', k: ['counter', 'counters', 'how to count', 'numbers', 'number', 'counting'], a: 'Japanese uses counters after numbers: 人 (nin) for people, 枚 (mai) for flat things, 本 (hon) for long things, 個 (ko) for small objects. Some are irregular: 一人 hitori, 二人 futari. Learn the common counters in whole phrases.' },
    { id: 'jp_pron', lang: 'Japanese', k: ['pitch', 'long vowel', 'long vowels', 'double consonant', 'small tsu', 'っ', 'rhythm', 'mora'], a: 'Japanese is timed by beats (mora): every kana takes about the same time. Hold long vowels twice as long (おばさん vs おばあさん) and pause briefly for the small っ (きって kitte). Vowels stay pure: a, i, u, e, o.' },
    { id: 'jp_verbs', lang: 'Japanese', k: ['verb group', 'verb groups', 'ichidan', 'godan', 'ru verb', 'u verb', 'masu form', 'dictionary form'], a: 'Verbs come in groups: ichidan (ru-verbs like 食べる) drop る and add the ending; godan (u-verbs like 飲む) change the final kana; and two irregulars, する and 来る. Learn the dictionary form first, then the ます-form and the te-form.' },

    /* ----- Italian ----- */
    { id: 'it_gender', lang: 'Italian', k: ['gender', 'masculine', 'feminine', 'il or la', 'o or a', 'plural', 'plurals', 'agree', 'agreement'], a: 'Italian nouns are masculine or feminine. Most -o nouns are masculine (il libro) and most -a nouns are feminine (la casa). Plurals: -o \u2192 -i, -a \u2192 -e, -e \u2192 -i. Adjectives agree with the noun: un ragazzo alto, una ragazza alta.' },
    { id: 'it_articles', lang: 'Italian', k: ['article', 'articles', 'il lo la', 'lo or il', 'gli', 'un uno', 'articolo', 'preposizioni articolate', 'del dello'], a: 'The: il / lo / l\' / la (singular), i / gli / le (plural). Use lo and gli before s + consonant, z, gn, ps (lo zaino, gli studenti). Prepositions merge with the article: di + il = del, a + il = al, in + la = nella, su + il = sul.' },
    { id: 'it_verbs', lang: 'Italian', k: ['essere', 'avere', 'to be', 'to have', 'sono', 'ho', 'irregular', 'andare', 'fare', 'venire'], a: 'Essere (to be): sono, sei, \u00e8, siamo, siete, sono. Avere (to have): ho, hai, ha, abbiamo, avete, hanno. Very common irregulars: andare (vado, vai, va), fare (faccio, fai, fa), venire (vengo, vieni, viene). Learn these first; they appear everywhere.' },
    { id: 'it_pron', lang: 'Italian', k: ['pronounce c', 'ci and ce', 'gli sound', 'double consonant', 'double consonants', 'doppie', 'gn', 'sc', 'h silent', 'italian sounds'], a: 'Italian is pronounced as it is written. c/g are soft before e/i (ciao, gelato) and hard otherwise (casa, gatto); ch/gh make them hard before e/i (chi, spaghetti). gli sounds like \u201cly\u201d, gn like \u201cny\u201d. Double consonants are held longer: pala vs palla. The letter h is silent.' },
    { id: 'it_pp', lang: 'Italian', k: ['passato prossimo', 'participle', 'imperfetto', 'essere or avere', 'which auxiliary', 'ho or sono', 'past tense'], a: 'Passato prossimo = avere/essere + past participle (-ato, -uto, -ito). Movement and reflexive verbs use essere and the participle agrees with the subject (siamo andate). The imperfetto describes habits and background (mangiavo); the passato prossimo tells what happened.' },
    { id: 'it_subj', lang: 'Italian', k: ['congiuntivo', 'subjunctive', 'penso che', 'credo che', 'spero che'], a: 'The congiuntivo follows opinion, wish, doubt and emotion when the subject changes: Penso che Marco sia stanco; Voglio che tu venga. If the subject stays the same, use di + infinitive: Penso di essere stanco.' },
    { id: 'it_tu', lang: 'Italian', k: ['tu or lei', 'formal', 'informal', 'polite', 'lei', 'voi', 'you formal', 'how to address'], a: 'Use tu with friends, family and young people; use Lei (with the 3rd-person verb) with strangers, older people and in formal situations: Come sta? vs Come stai? You will also hear voi for \u201cyou all\u201d.' },
    { id: 'it_pronouns', lang: 'Italian', k: ['object pronoun', 'object pronouns', 'lo la li le', 'mi ti', 'pronomi', 'ci and ne', 'ne', 'ci'], a: 'Pronouns go before a conjugated verb (Lo vedo) but attach to an infinitive (Voglio vederlo). Direct: lo, la, li, le. Indirect: mi, ti, gli, le, ci, vi. Ci replaces a place or topic (Ci vado), ne replaces a quantity or topic (Ne voglio due).' }
  ];

  var FILLER = /\b(what|does|do|is|are|mean|means|meaning|of|how|you|use|used|explain|the|this|that|a|an|tell|me|about|word|phrase|in|say|please)\b|[?!.,"\u201c\u201d]/g;

  function bestEntry(text, ctx) {
    var best = null, bs = 0;
    KB.forEach(function (e) {
      if (e.lang && e.lang !== ctx.lang) return;
      var s = score(text, e.k); if (!s) return;
      if (e.lang) s += 0.6;                       // language-specific answers win ties
      if (s > bs) { bs = s; best = e; }
    });
    return best && { e: best, s: bs };
  }

  /* finds the lesson row a message is about. strong = matched the first column; weak = matched an example or note */
  function lookupTerm(text, ctx) {
    if (!ctx.rows || !ctx.rows.length || text.length > 70) return null;
    var core = text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    var cjk = /[^\x00-\x7f]/.test(core);
    if (core.length < 2 && !cjk) return null;
    var strong = null, weak = null;
    ctx.rows.forEach(function (r) {
      var a = r[0].toLowerCase();
      if (!strong && (((a.length >= 2 || /[^\x00-\x7f]/.test(a)) && text.indexOf(a) !== -1) || ((core.length >= 3 || cjk) && a.indexOf(core) !== -1) || (core.length >= 3 && (r[1] || '').toLowerCase() === core))) strong = r;
      if (!weak && core.length >= 5 && r.slice(1).some(function (c) { return c.toLowerCase().indexOf(core) !== -1; })) weak = r;
    });
    return strong ? { row: strong, strong: true } : weak ? { row: weak, strong: false } : null;
  }

  function reply(ctx, msgs) {
    ctx = ctx || {}; ctx.rows = ctx.rows || []; ctx.head = ctx.head || []; ctx.notes = ctx.notes || []; ctx.titles = ctx.titles || []; ctx.name = ctx.name || 'this';
    var last = (msgs && msgs.length ? msgs[msgs.length - 1].content : '') || '';
    var text = last.toLowerCase().replace(/[\u2019']/g, '.').trim();
    var prev = msgs && msgs.length > 1 ? msgs[msgs.length - 2].content : '';

    // 1. answering a quiz question the tutor just asked
    var asked = /Quiz: .*?\u201c(.+?)\u201d/.exec(prev || '');
    if (asked && !/^(quiz|another|next)/.test(text)) {
      var row = ctx.rows.filter(function (r) { return r[0] === asked[1]; })[0];
      if (row) {
        var c = ansCol(ctx), ans = (row[c] || '').toLowerCase(), words = ans.match(/[a-z\u00c0-\u017f]{4,}/g) || [];
        var ok = words.some(function (w) { return text.indexOf(w) !== -1; }) || (text.length >= 3 && ans.indexOf(text) !== -1);
        return { reply: (ok ? 'Correct! ' : 'Not quite. ') + rowLine(ctx, row) + '\nWant another one?', suggest: ['Another quiz question', 'Explain this lesson simply'] };
      }
    }
    if (/^(another|next|again|one more)/.test(text) && /Quiz: /.test(prev || '')) return { reply: dyn.quiz(ctx), suggest: ['Explain this lesson simply'] };

    var hit = bestEntry(text, ctx), term = lookupTerm(text, ctx);

    // 2. a word from the lesson on screen
    if (term && (!hit || (term.strong && hit.s < 2) || hit.e.id === 'greet' || hit.e.id === 'translate')) {
      return { reply: rowLine(ctx, term.row) + (ctx.notes[0] ? '\nTip: ' + ctx.notes[0] : ''), suggest: ['Quiz me on it', 'Show the practice task'] };
    }
    // 3. predetermined answer chosen by keywords
    if (hit) {
      var a = typeof hit.e.a === 'function' ? hit.e.a(ctx) : hit.e.a;
      return { reply: a, suggest: hit.e.s || DEFAULT_SUGGEST.slice(0, 3) };
    }
    // 4. nothing matched
    return { reply: 'I am not sure about that one. I answer best about this ' + (ctx.lesson ? 'lesson' : 'course') + ', study tips, pronunciation, and how coins, chests and the shop work. You can also type a word from the lesson and I will explain it. Try one of these:', suggest: DEFAULT_SUGGEST };
  }

  return { reply: reply, kbSize: function () { return KB.length; } };
});
