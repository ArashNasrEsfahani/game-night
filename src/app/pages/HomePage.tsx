import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getCatalog, getGame } from '../../games/registry';
import { useSessionStore } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  Screen,
  GameCard,
  Button,
  LionSunCrest,
  MotifDivider,
  Motif,
  TileBand,
} from '../../sdk/ui';
import { stagger, staggerItem, popIn } from '../../sdk/motion';
import { useLocalize } from '../../lib/localize';
import { buildGamePath } from '../routes';
import { Leaderboard } from '../components/Leaderboard';
import { Guide } from '../components/Guide';

/** Drifting blurred disco orbs behind the page — "disco lights everywhere". */
const ORBS = [
  { c: 'teal', x: '8%', y: '12%', s: 220, dx: 26, dy: 34, d: 13 },
  { c: 'rose', x: '78%', y: '8%', s: 200, dx: -30, dy: 28, d: 16 },
  { c: 'gold', x: '64%', y: '40%', s: 180, dx: 24, dy: -26, d: 15 },
  { c: 'grape', x: '14%', y: '54%', s: 240, dx: 32, dy: 22, d: 18 },
  { c: 'sky', x: '82%', y: '72%', s: 190, dx: -24, dy: -30, d: 14 },
  { c: 'lime', x: '30%', y: '86%', s: 200, dx: 28, dy: -22, d: 17 },
] as const;

/** A decorative parade of Persian motifs (uses the full ported vocabulary). */
const DECO_MOTIFS = ['lotus', 'tulip', 'dome', 'tar', 'crown', 'nightingale', 'gereh', 'boteh'];

function OrbsLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {ORBS.map((o, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: o.x,
            top: o.y,
            width: o.s,
            height: o.s,
            background: `radial-gradient(circle, color-mix(in oklab, var(--color-game-${o.c}) 55%, transparent), transparent 70%)`,
            filter: 'blur(38px)',
            opacity: 0.5,
          }}
          animate={{ x: [0, o.dx, 0], y: [0, o.dy, 0] }}
          transition={{ duration: o.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const localize = useLocalize();
  const navigate = useNavigate();
  const catalog = getCatalog();
  const sessions = useSessionStore((s) => s.sessions);
  const gamesRef = useRef<HTMLDivElement>(null);

  // Quick toggles live in the header — no separate Settings page needed for the common ones.
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const muted = useSettingsStore((s) => s.muted);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const guidance = useSettingsStore((s) => s.guidance);
  const setGuidance = useSettingsStore((s) => s.setGuidance);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Most-recently-updated unfinished match, for a quick "Resume" strip.
  const resume = useMemo(() => {
    const open = Object.values(sessions)
      .filter((s) => s && !s.state.finished)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const top = open[0];
    if (!top) return null;
    const mod = getGame(top.gameId);
    return mod ? { id: top.gameId, name: localize(mod.manifest.name) } : null;
  }, [sessions, localize]);

  const scrollToGames = () => gamesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <OrbsLayer />
      <Screen className="relative z-10">
        <header className="flex items-center justify-between pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
            {t('common.players')}
          </Button>
          <div className="flex items-center gap-1.5">
            {[
              {
                key: 'lang',
                label: language === 'fa' ? 'EN' : 'فا',
                aria: t('settings.language'),
                onClick: () => setLanguage(language === 'fa' ? 'en' : 'fa'),
              },
              {
                key: 'theme',
                label: isDark ? '🌙' : '☀️',
                aria: t('settings.theme'),
                onClick: () => setTheme(isDark ? 'light' : 'dark'),
              },
              {
                key: 'sound',
                label: muted ? '🔇' : '🔊',
                aria: t('settings.sound'),
                onClick: () => setMuted(!muted),
              },
              {
                key: 'guide',
                label: '💡',
                aria: t('settings.guidance'),
                onClick: () => setGuidance(!guidance),
                dim: !guidance,
              },
            ].map((b) => (
              <motion.button
                key={b.key}
                onClick={b.onClick}
                aria-label={b.aria}
                whileTap={{ scale: 0.88 }}
                className={`grid h-9 min-w-9 place-items-center rounded-full bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-glow)] ${
                  'dim' in b && b.dim ? 'opacity-40' : ''
                }`}
              >
                {b.label}
              </motion.button>
            ))}
          </div>
        </header>

        {/* ───── HERO ───── the Lion & Sun (شیر و خورشید) over sweeping disco rays is the mark */}
        <motion.section
          className="flex flex-col items-center gap-2 pb-7 pt-2 text-center"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={popIn}>
            <LionSunCrest size={184} />
          </motion.div>
          <motion.h1 variants={staggerItem} className="dp-title mt-1 font-display text-5xl tracking-wide">
            Game Night
          </motion.h1>
          <motion.p variants={staggerItem} className="dp-foil font-display text-3xl leading-none">
            شب بازی
          </motion.p>
          <motion.p variants={staggerItem} className="mt-1 max-w-[18rem] text-sm text-[var(--text-muted)]">
            {t('home.heroTagline')}
          </motion.p>
          <motion.div variants={staggerItem} className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={scrollToGames}>{t('common.play')}</Button>
            <Button variant="secondary" onClick={() => navigate('/players')}>
              {t('common.players')}
            </Button>
          </motion.div>
          {resume && (
            <motion.button
              variants={staggerItem}
              onClick={() => navigate(buildGamePath(resume.id))}
              whileTap={{ scale: 0.97 }}
              className="mt-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-glow)]"
            >
              ⏵ {t('home.resume')} · {resume.name}
            </motion.button>
          )}
        </motion.section>

        {/* ───── GUIDANCE ───── step-by-step help, toggled by the 💡 button */}
        <Guide className="mt-1">{t('guide.home')}</Guide>

        {/* ───── OVERALL LEADERBOARD ───── (renders only once a match has been played) */}
        <Leaderboard />

        {/* ───── GAME GRID ───── */}
        <div ref={gamesRef} className="scroll-mt-4 pt-7">
          <MotifDivider motif="gereh" />
          <p className="mb-3 mt-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[var(--game-accent-strong)]">
            {t('home.chooseGame')}
          </p>

          {catalog.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center text-[var(--text-muted)]">
              {t('home.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {catalog.map((m, i) => (
                <GameCard
                  key={m.id}
                  manifest={m}
                  index={i}
                  title={localize(m.name)}
                  tagline={localize(m.tagline)}
                  onClick={() => navigate(buildGamePath(m.id))}
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── FOOTER ───── a parade of Persian motifs + a tilework band */}
        <footer className="mt-auto flex flex-col items-center gap-3 pb-4 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            {DECO_MOTIFS.map((m, i) => (
              <motion.span
                key={m}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <Motif name={m} size={30} color="var(--color-game-gold)" />
              </motion.span>
            ))}
          </div>
          <TileBand className="w-full max-w-[240px]" />
          <p className="dp-foil font-display text-lg leading-none">شب بازی</p>
        </footer>
      </Screen>
    </>
  );
}
