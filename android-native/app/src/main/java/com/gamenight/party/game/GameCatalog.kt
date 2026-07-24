package com.gamenight.party.game

import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameCapabilities
import com.gamenight.party.model.GameCategory
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.LocalizedString

/**
 * The native catalog — transcribed 1:1 from each src/games/<id>/manifest.ts so the home grid
 * matches the webapp (same titles, taglines, icons, accent colors, player ranges).
 *
 * NOTE: this is static catalog metadata only. Each game's logic + screens get ported incrementally
 * (see GameRegistry, added per game). A manifest here without a registered implementation simply
 * shows on the grid as "coming soon" until its port lands.
 */
private fun ls(en: String, fa: String) = LocalizedString(en, fa)

object GameCatalog {
    val all: List<GameManifest> = listOf(
        GameManifest(
            id = "codenames",
            name = ls("Codenames", "کدنیمز"),
            tagline = ls("Two spymasters, one secret key", "دو رئیس‌جاسوس، یک کلید مخفی"),
            description = ls(
                "Two teams face a 5×5 grid of words, but only the spymasters know which ones are theirs. Armed with a single one-word clue and a number, each spymaster sends their team hunting across the board — link the right words and you look like a genius, brush the wrong one and you might hand the round to your rivals. Uncover all your agents first to win, but one tap on the assassin ends it for you instantly.",
                "دو تیم روبه‌روی شبکه‌ای ۵×۵ از کلمات می‌نشینند، اما فقط رئیس‌جاسوس‌ها می‌دانند کدام کلمات مال آن‌هاست. هر رئیس‌جاسوس با یک سرنخ تک‌کلمه‌ای و یک عدد، تیمش را به شکار کلمات می‌فرستد — کلمات درست را به هم وصل کنی نابغه به نظر می‌رسی، اشتباه بزنی شاید دور را تقدیم حریف کنی. اول همهٔ مأمورانت را پیدا کن تا ببری، اما یک ضربه به جاسوس مرگبار همان لحظه کارت را تمام می‌کند.",
            ),
            icon = "🔲", color = ColorToken.LIME, category = GameCategory.WORD,
            minPlayers = 4, maxPlayers = 16, estimatedMinutes = 10..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "dowr",
            name = ls("Dowr", "دور"),
            tagline = ls("Describe fast, beat the bomb!", "سریع توضیح بده، بمب رو ببر!"),
            description = ls(
                "In rapid-fire pairs, you describe the word any way you can while your partner blurts out guesses — and the clock never, ever stops. The instant they nail it, the phone flies to the next team, so every wasted second piles onto your running total. Beat the ticking bomb, dodge the change-word penalty, and keep it moving; the team with the lowest total time at the end takes it all.",
                "در تیم‌های دونفرهٔ تندوتیز، کلمه را هرطور شده توضیح می‌دهی و هم‌تیمی‌ات پشت‌سرهم حدس می‌زند — و کرنومتر هیچ‌وقت متوقف نمی‌شود. لحظه‌ای که گرفت، گوشی به تیم بعد پرواز می‌کند، پس هر ثانیهٔ هدررفته به زمان کل تو اضافه می‌شود. بمبِ در حال شمارش را شکست بده، از جریمهٔ تعویض کلمه فرار کن و تند پیش برو؛ تیمی که آخرِ بازی کمترین زمان کل را داشته باشد همه‌چیز را می‌برد.",
            ),
            icon = "🗣️", color = ColorToken.VIOLET, category = GameCategory.WORD,
            minPlayers = 4, maxPlayers = 10, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "heads-up",
            name = ls("Heads Up!", "حدس بزن!"),
            tagline = ls("Phone on your forehead, guess the word!", "گوشی روی پیشانی، کلمه را حدس بزن!"),
            description = ls(
                "Slap the phone on your forehead so everyone can see the word except you. The room erupts with frantic clues, wild gestures, and shouting while you guess as fast as you can before the timer dies. Nail it and tap to score, wave off the tough ones, and pile up as many words as you can in one breathless round.",
                "گوشی را روی پیشانی‌ات بگذار تا همه کلمه را ببینند جز خودت. جمع با سرنخ‌های هول‌هولکی، اشاره‌های دیوانه‌وار و داد و فریاد منفجر می‌شود و تو تا قبل از تمام شدن زمان هرچه سریع‌تر حدس می‌زنی. درست زدی بزن تا امتیاز بگیری، سخت‌ها را رد کن و در یک دور نفس‌گیر هرچه می‌توانی کلمه جمع کن.",
            ),
            icon = "🙈", color = ColorToken.SKY, category = GameCategory.PARTY,
            minPlayers = 2, maxPlayers = 16, estimatedMinutes = 5..15,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "mafia",
            name = ls("Mafia", "مافیا"),
            tagline = ls("Hidden roles, night & day", "نقش‌های پنهان، شب و روز"),
            description = ls(
                "Night falls on a town quietly torn apart by a hidden Mafia, and the phone deals everyone a secret role. As darkness comes the Mafia pick off a victim, the doctor scrambles to save a life, and the detective digs for the truth; by day the whole town argues, accuses, and votes someone to the gallows. Town wins by rooting out every last Mafioso — but trust no one, because anyone could be lying straight to your face.",
                "شب بر شهری فرود می‌آید که مافیای پنهان بی‌سروصدا از هم می‌پاشدش، و گوشی به هرکس یک نقش مخفی می‌دهد. با آمدن تاریکی مافیا قربانی می‌گیرد، دکتر تقلا می‌کند جانی را نجات دهد و کارآگاه دنبال حقیقت می‌گردد؛ روز که می‌شود کل شهر بحث و متهم و رأی‌گیری می‌کند تا یکی را پای چوبهٔ دار بفرستد. مردم‌شهر با ریشه‌کن کردن تک‌تک مافیاها برنده می‌شوند — اما به هیچ‌کس اعتماد نکن، چون هرکسی ممکن است توی چشمت دروغ بگوید.",
            ),
            icon = "🎭", color = ColorToken.ROSE, category = GameCategory.DEDUCTION,
            minPlayers = 5, maxPlayers = 20, estimatedMinutes = 15..45,
            capabilities = GameCapabilities(usesTimer = true, usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "minesweeper",
            name = ls("Mine Hunt", "مین‌یاب"),
            tagline = ls("Hunt down the hidden mines!", "مین‌های پنهان را پیدا کن!"),
            description = ls(
                "Minesweeper flipped on its head: this time the mines are buried treasure and you want every last one. Tap a square to strike a mine and score it (then tap again), or hit a safe spot that reveals a number clue and passes your turn — nothing ever explodes. Read the numbers like a detective to sniff out where the mines hide, and whoever digs up the most takes the win.",
                "مین‌یاب وارونه شده: این بار مین‌ها گنجِ دفن‌شده‌اند و تو همه‌شان را می‌خواهی. روی خانه‌ای بزن تا به مین برسی و امتیاز بگیری (و دوباره بزن)، یا به خانهٔ امنی بخوری که عددی راهنما رو می‌کند و نوبتت را رد می‌کند — هیچ‌چیز هرگز منفجر نمی‌شود. مثل یک کارآگاه عددها را بخوان تا بفهمی مین‌ها کجا پنهان‌اند، و هرکس بیشترین مین را بیرون بکشد برنده است.",
            ),
            icon = "💣", color = ColorToken.TANGERINE, category = GameCategory.DEDUCTION,
            minPlayers = 1, maxPlayers = 4, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(),
        ),
        GameManifest(
            id = "most-likely-to",
            name = ls("Most Likely To", "به احتمال زیاد"),
            tagline = ls("Point at the friend most likely to…", "به دوستی اشاره کن که به احتمال زیاد…"),
            description = ls(
                "A cheeky \"Most likely to…\" prompt drops, and every finger in the room swings toward one unlucky friend. Everyone votes in secret, the count is revealed, and the most-accused suddenly has some explaining to do. Rack up the most call-outs across the deck and you wear the crown — for better or for worse.",
                "یک سوال شیطنت‌آمیز «به احتمال زیاد…» می‌آید و همهٔ انگشت‌ها به سمت یک دوستِ بدشانس نشانه می‌رود. همه پنهانی رأی می‌دهند، شمارش رو می‌شود و پررأی‌ترین یک‌دفعه کلی توضیح برای دادن دارد. هرکس در طول بازی بیشترین رأی را جمع کند تاج را می‌گیرد — حالا خوب یا بد!",
            ),
            icon = "👉", color = ColorToken.TANGERINE, category = GameCategory.VOTING,
            minPlayers = 3, maxPlayers = 20, estimatedMinutes = 8..15,
            capabilities = GameCapabilities(usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "never-have-i-ever",
            name = ls("Never Have I Ever", "من هیچ‌وقت"),
            tagline = ls("Confess or lose a life", "اعتراف کن یا یک جان از دست بده"),
            description = ls(
                "A bold confession pops up on screen, and anyone who's actually done it has to own up — and lose a life. Secrets spill, eyebrows shoot up, and the whole table erupts every single round. The last player left with a clean record (or simply the fewest confessions) walks away the most innocent of all.",
                "یک اعتراف جسورانه روی صفحه ظاهر می‌شود و هرکس واقعاً آن را انجام داده باید قبول کند — و یک جان از دست بدهد. رازها لو می‌رود، ابروها بالا می‌پرد و هر دور کل جمع منفجر می‌شود. آخرین بازیکنی که پروندهٔ پاک (یا فقط کمترین اعتراف) را داشته باشد، بی‌گناه‌ترینِ جمع از آب درمی‌آید.",
            ),
            icon = "🙈", color = ColorToken.ROSE, category = GameCategory.PARTY,
            minPlayers = 3, maxPlayers = 16, estimatedMinutes = 10..25,
            capabilities = GameCapabilities(usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "pantomime",
            name = ls("Pantomime", "پانتومیم"),
            tagline = ls("Act it out silently", "بی‌کلام اجرا کن"),
            description = ls(
                "One actor gets a secret prompt and has to bring it to life with nothing but gestures — no words, no sounds, no cheating. Their team shouts guesses in a frenzy while the clock ticks down and the miming gets more desperate by the second. Score every prompt you can before time's up, then hand off to the next team; the most points takes the win.",
                "یک بازیگر سرنخ مخفی می‌گیرد و باید فقط با حرکت آن را زنده کند — بدون کلام، بدون صدا، بدون تقلب. تیمش دیوانه‌وار حدس می‌زند، زمان می‌گذرد و اجرا هر ثانیه ناامیدانه‌تر می‌شود. تا قبل از پایان وقت هر سرنخی که می‌توانی امتیاز بگیر، بعد نوبت را به تیم بعد بده؛ بیشترین امتیاز برنده است.",
            ),
            icon = "🎭", color = ColorToken.GRAPE, category = GameCategory.PARTY,
            minPlayers = 4, maxPlayers = 16, estimatedMinutes = 10..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "spyfall",
            name = ls("Spyfall", "جاسوس"),
            tagline = ls("Find the spy, hide the location", "جاسوس را پیدا کن، مکان را پنهان کن"),
            description = ls(
                "Everyone secretly shares the same location and a role to play — everyone except one spy, who's flying completely blind. Trade pointed questions to expose the impostor without ever naming the place out loud, because one careless answer hands the spy the win. Meanwhile the spy bluffs along and races to figure out where on earth everybody is. It's pure paranoia, in the best possible way.",
                "همه پنهانی یک مکان و یک نقش مشترک می‌گیرند — همه جز یک جاسوس که در تاریکی مطلق است. با سؤال‌های هدف‌دار جاسوس را لو بده، اما مبادا اسم مکان را بلند بگویی، چون یک جواب بی‌احتیاط برد را تقدیم جاسوس می‌کند. جاسوس هم همزمان بلوف می‌زند و تلاش می‌کند بفهمد اصلاً کجایید. سوءظنِ ناب، به بهترین شکل ممکن!",
            ),
            icon = "🕵️", color = ColorToken.VIOLET, category = GameCategory.DEDUCTION,
            minPlayers = 3, maxPlayers = 12, estimatedMinutes = 8..15,
            capabilities = GameCapabilities(usesTimer = true, usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "truth-or-dare",
            name = ls("Truth or Dare", "جرئت یا حقیقت"),
            tagline = ls("Spin, pick, reveal, pass the phone!", "بچرخون، انتخاب کن، نشون بده، گوشی رو بچرخون!"),
            description = ls(
                "Give the bottle a spin, hold your breath, and watch it land on someone. They pick Truth for a question they might regret or Dare for a challenge they definitely will, and a fresh prompt is revealed. Pass the phone and keep the secrets and stunts coming — play loose and endless, or race to a points target.",
                "بطری را بچرخان، نفست را حبس کن و ببین روی چه کسی می‌ایستد. او «حقیقت» را انتخاب می‌کند برای سوالی که شاید پشیمانش کند، یا «جرئت» را برای کاری که حتماً پشیمانش می‌کند، و یک سرنخ تازه رو می‌شود. گوشی را بچرخان و رازها و کارهای جسورانه را ادامه بده — بی‌خیال و بی‌پایان بازی کن یا به امتیاز هدف برس.",
            ),
            icon = "🌶️", color = ColorToken.GOLD, category = GameCategory.PARTY,
            minPlayers = 2, maxPlayers = 16, estimatedMinutes = 10..40,
            capabilities = GameCapabilities(usesDeck = true, usesRevealGate = true),
            supportsCustomContent = true,
        ),
        GameManifest(
            id = "would-you-rather",
            name = ls("Would You Rather", "کدوم رو ترجیح می‌دی؟"),
            tagline = ls("Two options. Pick a side. Defend it.", "دو گزینه. یک طرف رو انتخاب کن. ازش دفاع کن."),
            description = ls(
                "Every card forces an impossible choice between two unthinkable options, and there's no sitting on the fence. The whole group locks in A or B, the split is revealed, and suddenly everyone's defending the indefensible. It's the fastest way to start an argument you'll all end up laughing about — and you can keep score for siding with the majority.",
                "هر کارت تو را بین دو گزینهٔ غیرممکن گیر می‌اندازد و راه فراری هم نیست. همه پنهانی A یا B را انتخاب می‌کنند، نتیجه رو می‌شود و یک‌دفعه همه دارند از انتخاب عجیبشان دفاع می‌کنند. سریع‌ترین راه برای راه انداختن بحثی که آخرش همه‌تان به آن می‌خندید — و می‌توانید برای همراهی با اکثریت امتیاز هم بگیرید.",
            ),
            icon = "🤔", color = ColorToken.TEAL, category = GameCategory.VOTING,
            minPlayers = 2, maxPlayers = 20, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
    )

    fun byId(id: String): GameManifest? = all.firstOrNull { it.id == id }
}
