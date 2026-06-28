package com.gamenight.party.game.mafia

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.screenEntrance
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlin.random.Random

/**
 * The three Mafia screens — a Compose port of screens/{Setup,Play,Results}Screen.tsx + RoleGuide.tsx
 * built on the shared UI library. Each is wrapped in [MafiaAccent] so LocalAccent reflects this
 * game's manifest colour (rose), recolouring every control just like the webapp's per-game accent.
 */

private fun gameAccent() = ColorToken.ROSE

/** Provides this game's accent so the shared components recolour to rose. */
@Composable
private fun MafiaAccent(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAccent provides gameAccent().accent(), content = content)
}

/** Picks the EN or FA face of a small piece of UI chrome (the native i18n stand-in for mf.*). */
private fun tr(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

private fun factionLabel(f: Faction): LocalizedString = when (f) {
    Faction.TOWN -> LocalizedString("Town", "مردم‌شهر")
    Faction.MAFIA -> LocalizedString("Mafia", "مافیا")
    Faction.NEUTRAL -> LocalizedString("Neutral", "خنثی")
}

private fun factionDot(f: Faction): Color = when (f) {
    Faction.TOWN -> Accents.Teal
    Faction.MAFIA -> Accents.Rose
    Faction.NEUTRAL -> Accents.Gold
}

private fun errText(lang: Lang, code: String): String = when (code) {
    "cannotSkip" -> tr(lang, "This action can't be skipped", "این کار قابل رد کردن نیست")
    "badTarget" -> tr(lang, "Pick a living player", "یک بازیکن زنده انتخاب کن")
    "noSelf" -> tr(lang, "Can't target yourself", "نمی‌توانی خودت را هدف بگیری")
    "selfSaveUsed" -> tr(lang, "Self-save already used", "نجات خود قبلاً استفاده شده")
    "needTarget" -> tr(lang, "Choose a target first", "اول یک هدف انتخاب کن")
    "emptyBallot" -> tr(lang, "Nominate someone first", "اول کسی را نامزد کن")
    else -> code
}

private val CORE_ROLES: List<RoleId> = listOf("mafia", "godfather", "detective", "doctor")
private val EXTRA_ROLES: List<RoleId> = listOf("sniper", "bodyguard", "escort", "framer", "consigliere", "jester")
private val STEPPER_ROLES: List<RoleId> = CORE_ROLES + EXTRA_ROLES

// ──────────────────────────── Setup ────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MafiaSetupScreen(
    players: List<PlayerSeat>,
    lang: Lang,
    onExit: () -> Unit,
    onStart: (MafiaConfig) -> Unit,
) = MafiaAccent {
    val palette = LocalPalette.current
    var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }
    var counts by remember { mutableStateOf(autoComposition(players.size)) }
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var showGuide by remember { mutableStateOf(false) }
    var showSpecial by remember { mutableStateOf(false) }
    var showRules by remember { mutableStateOf(false) }

    val seats = players.filter { it.id in selected }
    val n = seats.size

    val otherTotal = STEPPER_ROLES.sumOf { counts[it] ?: 0 }
    val citizen = maxOf(0, n - otherTotal)
    val extraTotal = EXTRA_ROLES.sumOf { counts[it] ?: 0 }

    val composition: Map<RoleId, Int> = run {
        val c = LinkedHashMap<RoleId, Int>()
        STEPPER_ROLES.forEach { r -> (counts[r] ?: 0).let { if (it > 0) c[r] = it } }
        if (citizen > 0) c["citizen"] = citizen
        c
    }

    val config = MafiaConfig(
        players = seats,
        options = opts.copy(composition = composition, presetId = null),
        lang = lang,
    )
    val errors = validateConfig(config)

    fun setCount(r: RoleId, v: Int) {
        counts = counts.toMutableMap().apply { this[r] = v }
    }

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        AppBar(title = tr(lang, "Mafia", "مافیا"), onBack = onExit)

        // Players + role-guide entry
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = tr(lang, "Players", "بازیکنان") + " · $n",
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            Text(
                text = tr(lang, "Roles & how they work", "نقش‌ها و طرز کارشان"),
                color = palette.text,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                modifier = Modifier
                    .clip(PillShape)
                    .background(palette.surface2, PillShape)
                    .clickable { showGuide = !showGuide }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            players.forEach { p ->
                SelectChip(
                    selected = p.id in selected,
                    onClick = { selected = if (p.id in selected) selected - p.id else selected + p.id },
                    text = (p.emoji?.let { "$it " } ?: "") + p.name,
                )
            }
        }

        if (showGuide) {
            RoleGuide(lang = lang, roleIds = STEPPER_ROLES + "citizen")
        }

        // Auto-fill + citizen tally
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            AppButton(
                text = tr(lang, "Auto-fill roles", "پر کردن خودکار نقش‌ها"),
                onClick = { counts = autoComposition(n) },
                variant = ButtonVariant.SECONDARY,
                size = ButtonSize.SM,
            )
            Text(
                text = tr(lang, "Citizens: $citizen", "شهروندان: $citizen"),
                color = palette.textMuted,
                fontSize = 14.sp,
            )
        }

        // Core roles
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CORE_ROLES.forEach { r ->
                RoleStepperRow(
                    roleId = r,
                    lang = lang,
                    value = counts[r] ?: 0,
                    max = ROLES.getValue(r).maxInGame ?: n,
                    onValueChange = { setCount(r, it) },
                )
            }
        }

        // Special roles (collapsible)
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = (if (showSpecial) "▾ " else "▸ ") + tr(lang, "Special roles", "نقش‌های ویژه"),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .clickable { showSpecial = !showSpecial }
                    .padding(vertical = 4.dp),
            )
            if (!showSpecial) {
                Text(
                    text = if (extraTotal > 0) {
                        tr(lang, "$extraTotal added", "$extraTotal اضافه شد")
                    } else {
                        tr(
                            lang,
                            "Optional powers: Bodyguard, Escort, Framer, Consigliere, Jester",
                            "قدرت‌های اختیاری: محافظ، اغواگر، پاپوش‌دوز، مشاور، دلقک",
                        )
                    },
                    color = palette.textDim,
                    fontSize = 13.sp,
                )
            } else {
                EXTRA_ROLES.forEach { r ->
                    RoleStepperRow(
                        roleId = r,
                        lang = lang,
                        value = counts[r] ?: 0,
                        max = ROLES.getValue(r).maxInGame ?: n,
                        onValueChange = { setCount(r, it) },
                    )
                }
            }
        }

        // Mode
        Text(text = tr(lang, "Mode", "حالت"), color = palette.text, fontSize = 14.sp)
        SegmentedControl(
            value = opts.mode,
            onChange = { opts = opts.copy(mode = it) },
            options = listOf(
                SegmentOption(MafiaMode.DEVICE_NARRATOR, tr(lang, "Narrated", "روایت‌شده")),
                SegmentOption(MafiaMode.SILENT, tr(lang, "Silent", "بی‌صدا")),
            ),
            modifier = Modifier.fillMaxWidth(),
        )

        // House rules (collapsible)
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = (if (showRules) "▾ " else "▸ ") + tr(lang, "House rules", "قوانین خانه"),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .clickable { showRules = !showRules }
                    .padding(vertical = 4.dp),
            )
            if (!showRules) {
                Text(
                    text = tr(lang, "Timers, voting, and tie rules", "زمان‌ها، رأی‌گیری و قانون تساوی"),
                    color = palette.textDim,
                    fontSize = 13.sp,
                )
            } else {
                Text(text = tr(lang, "Discussion time", "زمان بحث"), color = palette.text, fontSize = 14.sp)
                SegmentedControl(
                    value = opts.discussionSeconds,
                    onChange = { opts = opts.copy(discussionSeconds = it) },
                    options = listOf(
                        SegmentOption(60, "1m"),
                        SegmentOption(120, "2m"),
                        SegmentOption(180, "3m"),
                        SegmentOption(300, "5m"),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(text = tr(lang, "Vote to eliminate", "رأی حذف"), color = palette.text, fontSize = 14.sp)
                SegmentedControl(
                    value = opts.votingMode,
                    onChange = { opts = opts.copy(votingMode = it) },
                    options = listOf(
                        SegmentOption(VotingMode.MAJORITY, tr(lang, "Majority", "اکثریت")),
                        SegmentOption(VotingMode.PLURALITY, tr(lang, "Most votes", "بیشترین رأی")),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                Stepper(
                    label = tr(lang, "Nominations to vote", "نامزد لازم برای رأی"),
                    value = opts.nominationsRequired,
                    min = 1,
                    max = 5,
                    onValueChange = { opts = opts.copy(nominationsRequired = it) },
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(text = tr(lang, "On a tie", "در تساوی"), color = palette.text, fontSize = 14.sp)
                SegmentedControl(
                    value = opts.tieRule,
                    onChange = { opts = opts.copy(tieRule = it) },
                    options = listOf(
                        SegmentOption(TieRule.NO_ELIMINATION, tr(lang, "No elimination", "بدون حذف")),
                        SegmentOption(TieRule.RANDOM, tr(lang, "Random", "تصادفی")),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(text = tr(lang, "Doctor self-save", "نجات خودِ دکتر"), color = palette.text, fontSize = 14.sp)
                SegmentedControl(
                    value = opts.allowDoctorSelfSave,
                    onChange = { opts = opts.copy(allowDoctorSelfSave = it) },
                    options = listOf(
                        SegmentOption(DoctorSelfSave.NEVER, tr(lang, "Never", "هرگز")),
                        SegmentOption(DoctorSelfSave.ONCE, tr(lang, "Once", "یک‌بار")),
                        SegmentOption(DoctorSelfSave.ALWAYS, tr(lang, "Always", "همیشه")),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                AppToggle(
                    checked = opts.optionalReveal,
                    onCheckedChange = { opts = opts.copy(optionalReveal = it) },
                    label = tr(lang, "Reveal role on death", "نمایش نقش هنگام مرگ"),
                    modifier = Modifier.fillMaxWidth(),
                )
                AppToggle(
                    checked = opts.peacefulFirstNight,
                    onCheckedChange = { opts = opts.copy(peacefulFirstNight = it) },
                    label = tr(lang, "Peaceful first night", "شب اول آرام"),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (errors != null) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                errors.forEach { e ->
                    Text(text = e.resolve(lang), color = Accents.RoseStrong, fontSize = 14.sp)
                }
            }
        }

        AppButton(
            text = tr(lang, "Start", "شروع"),
            onClick = { onStart(config) },
            size = ButtonSize.LG,
            fullWidth = true,
            enabled = errors == null,
        )
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}

/** A single labelled role count stepper used by [MafiaSetupScreen]. */
@Composable
private fun RoleStepperRow(
    roleId: RoleId,
    lang: Lang,
    value: Int,
    max: Int,
    onValueChange: (Int) -> Unit,
) {
    val role = ROLES.getValue(roleId)
    Stepper(
        label = "${role.icon} ${role.name.resolve(lang)}",
        value = value,
        min = 0,
        max = max,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
    )
}

/** The "how each role works" reference (a port of RoleGuide.tsx) shown inline on Setup. */
@Composable
private fun RoleGuide(lang: Lang, roleIds: List<RoleId>) {
    val palette = LocalPalette.current
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        roleIds.forEach { id ->
            val role = ROLES[id] ?: return@forEach
            AppCard(modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(text = role.icon, fontSize = 24.sp)
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(text = role.name.resolve(lang), color = palette.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(factionDot(role.faction), CircleShape))
                            Text(text = factionLabel(role.faction).resolve(lang), color = palette.textMuted, fontSize = 11.sp)
                        }
                        Text(
                            text = role.guide.resolve(lang),
                            color = palette.textMuted,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

// ──────────────────────────── Play ────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MafiaPlayScreen(
    state: MafiaState,
    lang: Lang,
    dispatch: (MafiaAction) -> Unit,
    onExit: () -> Unit,
    onRematch: () -> Unit,
    sound: (SoundId) -> Unit = {},
    haptics: Haptics = Haptics.none(),
) = MafiaAccent {
    val palette = LocalPalette.current
    val s = state
    fun name(id: String): String = s.playerNames[id] ?: id
    val alive = alivePlayers(s)

    var voteCursor by remember(s.phase) { mutableStateOf(0) }
    var gateOpen by remember(s.phase, s.dealCursor, voteCursor) { mutableStateOf(false) }

    when (s.phase) {
        MafiaPhase.ERROR -> AppScreen {
            AppBar(title = tr(lang, "Mafia", "مافیا"), onBack = onExit)
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = tr(lang, "Check players and role counts", "بازیکن‌ها و تعداد نقش‌ها را بررسی کن"),
                    color = palette.textMuted,
                    textAlign = TextAlign.Center,
                )
                AppButton(text = tr(lang, "Play again", "بازی دوباره"), onClick = onRematch)
            }
        }

        MafiaPhase.DEAL -> {
            val pid = currentDealId(s)
            val player = s.players.firstOrNull { it.id == pid }
            val role = player?.let { ROLES[it.roleId] }
            AppScreen {
                AppBar(onBack = onExit)
                Text(
                    text = tr(
                        lang,
                        "Dealing ${s.dealCursor + 1} / ${s.dealOrder.size}",
                        "پخش نقش ${s.dealCursor + 1} / ${s.dealOrder.size}",
                    ),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    color = palette.textMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
                Curtain(
                    open = gateOpen,
                    holderName = if (pid != null) name(pid) else "",
                    hint = tr(lang, "Only ${if (pid != null) name(pid) else ""} should look", "فقط ${if (pid != null) name(pid) else ""} باید ببیند"),
                    revealLabel = tr(lang, "Tap to reveal your role", "برای دیدن نقشت بزن"),
                    onReveal = { sound(SoundId.REVEAL); gateOpen = true },
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        AppCard(modifier = Modifier.weight(1f).fillMaxWidth()) {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(
                                    text = role?.icon ?: "",
                                    fontSize = 72.sp,
                                    modifier = Modifier.screenEntrance(translateY = 0.dp, fromScale = 0.7f),
                                )
                                Text(
                                    text = role?.name?.resolve(lang) ?: "",
                                    color = LocalAccent.current.base,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 30.sp,
                                    textAlign = TextAlign.Center,
                                )
                                Text(
                                    text = role?.reveal?.resolve(lang) ?: "",
                                    color = palette.textMuted,
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                        AppButton(
                            text = tr(lang, "Hide & pass", "پنهان کن و بده"),
                            onClick = { dispatch(MafiaAction.DealNext) },
                            size = ButtonSize.LG,
                            fullWidth = true,
                        )
                    }
                }
            }
        }

        MafiaPhase.NIGHT -> {
            val step = currentStep(s)
            if (step == null) {
                AppScreen { AppBar(onBack = onExit) }
            } else {
                val role = ROLES[step.roleId]
                val recorded = recordedTarget(s, step.key)
                val legal = alive.filter { step.canTargetSelf || !step.actorIds.contains(it.id) }
                val escortTarget = s.nightActions.firstOrNull { it.key == "escort.block" && !it.skipped }?.targetId
                val framedTarget = s.nightActions.firstOrNull { it.key == "framer.frame" && !it.skipped }?.targetId
                val actorBlocked = escortTarget != null && escortTarget == step.actorIds.firstOrNull()

                AppScreen {
                    AppBar(onBack = onExit)
                    Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        AppCard(modifier = Modifier.fillMaxWidth()) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text(text = role?.icon ?: "", fontSize = 36.sp)
                                Text(
                                    text = tr(
                                        lang,
                                        "${role?.name?.resolve(lang) ?: ""}, wake up — choose a target",
                                        "${role?.name?.resolve(lang) ?: ""}، بیدار شو — یک هدف انتخاب کن",
                                    ),
                                    color = palette.text,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                                Text(
                                    text = role?.guide?.resolve(lang) ?: "",
                                    color = palette.textMuted,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                        }
                        FlowRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            legal.forEach { p ->
                                SelectChip(
                                    selected = recorded == p.id,
                                    onClick = {
                                        dispatch(MafiaAction.RecordNightAction(actorId = step.actorIds.first(), targetId = p.id))
                                    },
                                    text = name(p.id),
                                )
                            }
                        }

                        // Live investigation result (earlier-order roles are already recorded).
                        if (recorded != null && (step.key == "detective.check" || step.key == "consigliere.check")) {
                            if (actorBlocked) {
                                Text(
                                    text = tr(lang, "You were blocked, no result tonight", "مسدود شدی؛ امشب نتیجه‌ای نداری"),
                                    modifier = Modifier.fillMaxWidth(),
                                    color = palette.textMuted,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center,
                                )
                            } else {
                                val target = s.players.first { it.id == recorded }
                                if (step.key == "detective.check") {
                                    val seen = if (recorded == framedTarget) {
                                        Faction.MAFIA
                                    } else {
                                        ROLES.getValue(target.roleId).appearsAs ?: target.faction
                                    }
                                    Text(
                                        text = tr(
                                            lang,
                                            "${name(recorded)} appears: ${factionLabel(seen).resolve(lang)}",
                                            "${name(recorded)} به نظر می‌رسد: ${factionLabel(seen).resolve(lang)}",
                                        ),
                                        modifier = Modifier.fillMaxWidth(),
                                        color = palette.text,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        textAlign = TextAlign.Center,
                                    )
                                } else {
                                    val roleName = ROLES.getValue(target.roleId).name.resolve(lang)
                                    Text(
                                        text = tr(
                                            lang,
                                            "${name(recorded)} is the $roleName",
                                            "${name(recorded)} نقشش $roleName است",
                                        ),
                                        modifier = Modifier.fillMaxWidth(),
                                        color = palette.text,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }
                        }

                        if (s.meta != null) {
                            Text(
                                text = errText(lang, s.meta),
                                modifier = Modifier.fillMaxWidth(),
                                color = Accents.RoseStrong,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center,
                            )
                        }

                        Spacer(Modifier.weight(1f))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (step.skippable) {
                                AppButton(
                                    text = tr(lang, "Skip", "رد کن"),
                                    onClick = {
                                        dispatch(MafiaAction.RecordNightAction(actorId = step.actorIds.first(), targetId = null, skipped = true))
                                    },
                                    variant = ButtonVariant.GHOST,
                                )
                            }
                            if (s.nightCursor > 0) {
                                AppButton(
                                    text = tr(lang, "Back", "قبلی"),
                                    onClick = { dispatch(MafiaAction.NightStepBack) },
                                    variant = ButtonVariant.SECONDARY,
                                )
                            }
                            AppButton(
                                text = tr(lang, "Next", "بعدی"),
                                onClick = { dispatch(MafiaAction.NightStepNext) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }

        MafiaPhase.NIGHT_RESULT -> AppScreen {
            // A somber drum thud on a night kill (no sound when everyone survives).
            if (s.lastNightDeaths.isNotEmpty()) {
                LaunchedEffect(Unit) {
                    sound(SoundId.DRUM)
                    haptics.heavy()
                }
            }
            AppBar(onBack = onExit)
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "🌅",
                    fontSize = 56.sp,
                    modifier = Modifier.screenEntrance(translateY = 0.dp, fromScale = 0.7f),
                )
                if (s.lastNightDeaths.isEmpty()) {
                    Text(text = tr(lang, "No one died last night.", "دیشب کسی کشته نشد."), color = palette.text, fontSize = 20.sp)
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(text = tr(lang, "Killed last night", "کشته‌شده دیشب"), color = palette.textMuted, fontSize = 14.sp)
                        s.lastNightDeaths.forEach { id ->
                            val reveal = if (s.options.optionalReveal) {
                                " · " + ROLES.getValue(s.players.first { it.id == id }.roleId).name.resolve(lang)
                            } else {
                                ""
                            }
                            Text(text = "💀 ${name(id)}$reveal", color = palette.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                    }
                }
                AppButton(
                    text = tr(lang, "Continue to day", "ادامه به روز"),
                    onClick = { dispatch(MafiaAction.AckNightResult) },
                    size = ButtonSize.LG,
                )
            }
        }

        MafiaPhase.DAY -> AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
            AppBar(onBack = onExit)
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(text = "☀️", fontSize = 56.sp)
                Text(
                    text = tr(lang, "The city wakes. Discuss who the mafia might be.", "شهر بیدار می‌شود. دربارهٔ مافیا بحث کنید."),
                    color = palette.text,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    s.players.forEach { p ->
                        Text(
                            text = if (p.alive) name(p.id) else "💀 ${name(p.id)}",
                            color = palette.text,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .graphicsLayer { alpha = if (p.alive) 1f else 0.4f }
                                .clip(PillShape)
                                .background(palette.surface2, PillShape)
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
                AppButton(
                    text = tr(lang, "Start nominations", "شروع نامزدی"),
                    onClick = { dispatch(MafiaAction.EndDiscussion) },
                    size = ButtonSize.LG,
                    fullWidth = true,
                )
            }
        }

        MafiaPhase.NOMINATE -> AppScreen {
            AppBar(onBack = onExit)
            Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = tr(
                        lang,
                        "Tap to nominate · ${s.options.nominationsRequired} needed for a vote",
                        "برای نامزدی بزن · ${s.options.nominationsRequired} برای رأی لازم است",
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    color = palette.textMuted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    alive.forEach { p ->
                        val count = s.nominations[p.id] ?: 0
                        SelectChip(
                            selected = s.ballot.contains(p.id),
                            onClick = { dispatch(MafiaAction.Nominate(p.id)) },
                            text = name(p.id) + if (count > 0) " ($count)" else "",
                        )
                    }
                }
                if (s.meta != null) {
                    Text(
                        text = errText(lang, s.meta),
                        modifier = Modifier.fillMaxWidth(),
                        color = Accents.RoseStrong,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                Spacer(Modifier.weight(1f))
                AppButton(
                    text = tr(lang, "Go to vote", "برو به رأی‌گیری"),
                    onClick = { dispatch(MafiaAction.OpenVote) },
                    size = ButtonSize.LG,
                    fullWidth = true,
                    enabled = s.ballot.isNotEmpty(),
                )
            }
        }

        MafiaPhase.VOTE -> {
            val voter = alive.getOrNull(voteCursor)
            AppScreen {
                AppBar(onBack = onExit)
                if (voteCursor >= alive.size || voter == null) {
                    Column(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(text = tr(lang, "Everyone has voted", "همه رأی دادند"), color = palette.textMuted, fontSize = 18.sp)
                        AppButton(
                            text = tr(lang, "Reveal result", "نمایش نتیجه"),
                            onClick = { sound(SoundId.REVEAL); dispatch(MafiaAction.ResolveVote(Random.nextInt())) },
                            size = ButtonSize.LG,
                        )
                    }
                } else {
                    Curtain(
                        open = gateOpen,
                        holderName = name(voter.id),
                        hint = tr(lang, "Only ${name(voter.id)} should look", "فقط ${name(voter.id)} باید ببیند"),
                        revealLabel = tr(lang, "Tap to reveal your role", "برای دیدن نقشت بزن"),
                        onReveal = { gateOpen = true },
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                text = tr(lang, "Who do you vote out?", "به حذف چه کسی رأی می‌دهی؟"),
                                modifier = Modifier.fillMaxWidth(),
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                textAlign = TextAlign.Center,
                            )
                            FlowRow(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                s.ballot.forEach { id ->
                                    SelectChip(
                                        selected = false,
                                        onClick = {
                                            dispatch(MafiaAction.CastVote(voterId = voter.id, nomineeId = id))
                                            voteCursor += 1
                                        },
                                        text = name(id),
                                    )
                                }
                            }
                            AppButton(
                                text = tr(lang, "Abstain", "رأی نمی‌دهم"),
                                onClick = { voteCursor += 1 },
                                variant = ButtonVariant.GHOST,
                            )
                        }
                    }
                }
            }
        }

        MafiaPhase.VOTE_RESULT -> AppScreen {
            AppBar(onBack = onExit)
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                val eliminated = s.lastVoteEliminated
                if (eliminated != null) {
                    Text(
                        text = "⚖️",
                        fontSize = 56.sp,
                        modifier = Modifier.screenEntrance(translateY = 0.dp, fromScale = 0.7f),
                    )
                    val reveal = if (s.options.optionalReveal) {
                        " · " + ROLES.getValue(s.players.first { it.id == eliminated }.roleId).name.resolve(lang)
                    } else {
                        ""
                    }
                    Text(text = "${name(eliminated)}$reveal", color = palette.text, fontWeight = FontWeight.Bold, fontSize = 20.sp, textAlign = TextAlign.Center)
                    Text(text = tr(lang, "was voted out", "با رأی حذف شد"), color = palette.textMuted)
                } else {
                    Text(text = tr(lang, "No one was eliminated.", "کسی حذف نشد."), color = palette.text, fontSize = 20.sp)
                }
                AppButton(
                    text = tr(lang, "Next night", "شب بعد"),
                    onClick = { dispatch(MafiaAction.AckVoteResult) },
                    size = ButtonSize.LG,
                )
            }
        }

        MafiaPhase.ENDED -> Unit // routed to the Results screen by the host
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun MafiaResultsScreen(
    state: MafiaState,
    lang: Lang,
    onExit: () -> Unit,
    onRematch: () -> Unit,
    sound: (SoundId) -> Unit = {},
    haptics: Haptics = Haptics.none(),
) = MafiaAccent {
    val palette = LocalPalette.current
    val s = state

    // Victory flourish once on arrival (mirrors ResultsScreen.tsx's useEffect win cue).
    LaunchedEffect(Unit) {
        sound(SoundId.WIN)
        haptics.success()
    }

    val title = when (s.winner) {
        MafiaWinner.TOWN -> tr(lang, "Town wins! 🎉", "مردم‌شهر برنده شد! 🎉")
        MafiaWinner.MAFIA -> tr(lang, "Mafia wins! 🔪", "مافیا برنده شد! 🔪")
        MafiaWinner.JESTER -> tr(lang, "The Jester wins! 🃏", "دلقک برنده شد! 🃏")
        else -> tr(lang, "It's a draw.", "مساوی شد.")
    }

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AppBar(title = tr(lang, "Results", "نتایج"), onBack = onExit)
        WinnerBanner(title = title, names = emptyList())
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            s.players.forEach { p ->
                val role = ROLES.getValue(p.roleId)
                val factionColor = when (role.faction) {
                    Faction.MAFIA -> Accents.RoseStrong
                    Faction.NEUTRAL -> Accents.GoldStrong
                    Faction.TOWN -> palette.textMuted
                }
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(text = role.icon, fontSize = 20.sp)
                        Text(text = s.playerNames[p.id] ?: p.id, color = palette.text, fontWeight = FontWeight.Medium, fontSize = 15.sp, modifier = Modifier.weight(1f))
                        Text(text = role.name.resolve(lang), color = factionColor, fontSize = 12.sp)
                        Text(text = if (p.alive) "🟢" else "💀", fontSize = 14.sp)
                    }
                }
            }
        }
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AppButton(text = tr(lang, "Play again", "بازی دوباره"), onClick = onRematch, size = ButtonSize.LG, fullWidth = true)
            AppButton(text = tr(lang, "Home", "خانه"), onClick = onExit, variant = ButtonVariant.SECONDARY, fullWidth = true)
        }
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}
