import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Curtain, Stepper } from '../../../sdk/ui';
import { ITEM_BY_ID } from '../content';
import { currentItemId, currentVoterId, everyoneVoted } from '../logic';
import type { Side, WyrAction, WyrState } from '../logic';

/** A labelled option card for the "would you rather" prompt — the A/B badge gives each side identity. */
function OptionCard({ letter, text }: { letter: string; text: string }) {
  return (
    <Card className="relative w-full px-5 py-6 text-center text-xl font-extrabold">
      <span className="absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-black text-[var(--game-accent-strong)]">
        {letter}
      </span>
      {text}
    </Card>
  );
}

function OptionButtons({
  a,
  b,
  onPick,
  disabled,
}: {
  a: string;
  b: string;
  onPick: (side: Side) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full gap-3">
      <Button size="lg" fullWidth disabled={disabled} onClick={() => onPick('A')}>
        {a}
      </Button>
      <div className="text-center text-sm font-bold text-[var(--text-muted)]">—</div>
      <Button size="lg" variant="secondary" fullWidth disabled={disabled} onClick={() => onPick('B')}>
        {b}
      </Button>
    </div>
  );
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<WyrState, WyrAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);
  const [qa, setQa] = useState(0);
  const [qb, setQb] = useState(0);

  const voterId = currentVoterId(s);
  useEffect(() => {
    setGateOpen(false);
  }, [voterId]);
  useEffect(() => {
    if (s.phase === 'collecting') {
      setQa(0);
      setQb(0);
    }
  }, [s.phase, s.index]);

  const itemId = currentItemId(s);
  const item = itemId ? ITEM_BY_ID[itemId] : undefined;
  const a = item ? ctx.localize(item.optionA) : '';
  const b = item ? ctx.localize(item.optionB) : '';

  // Active-play header with an "End game" action that ends the match and jumps to Results-so-far.
  const header = (
    <AppBar
      onBack={() => nav.exit()}
      right={
        s.history.length > 0 ? (
          <button onClick={() => nav.endGame()} className="text-sm text-[var(--text-muted)]">
            {t('common.endGame')}
          </button>
        ) : undefined
      }
    />
  );

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('wyr.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('wyr.errorDeck')}</p>
          <Button onClick={() => nav.playAgain()}>{t('wyr.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'prompt') {
    return (
      <Screen>
        {header}
        <p className="py-1 text-center text-sm font-semibold text-[var(--text-muted)]">
          {t('wyr.progress', { done: s.index + 1, total: s.total })}
        </p>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg font-bold">{t('wyr.wouldYouRather')}</p>
          <div className="flex w-full flex-col items-center">
            <OptionCard letter="A" text={a} />
            <div className="z-10 -my-3.5 grid h-10 w-10 place-items-center rounded-full bg-[var(--game-accent-strong)] text-sm font-black text-[var(--game-on-accent)] shadow-[var(--shadow-pop)] ring-4 ring-[var(--bg)]">
              {t('wyr.or')}
            </div>
            <OptionCard letter="B" text={b} />
          </div>
          <div className="mt-2 flex w-full flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'BEGIN_COLLECTION' }); }}>
              {s.options.mode === 'vote' ? t('wyr.startVoting') : t('wyr.countHands')}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'SKIP' })}>
              {t('wyr.skip')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'collecting' && s.options.mode === 'vote') {
    const done = everyoneVoted(s);
    const voterName = voterId ? s.playerNames[voterId] : '';
    if (done) {
      return (
        <Screen>
          {header}
          <div className="grid flex-1 place-items-center gap-4 text-center">
            <p className="text-lg text-[var(--text-muted)]">{t('wyr.passBack')}</p>
            <Button size="lg" onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'REVEAL' }); }}>
              {t('wyr.revealSplit')}
            </Button>
          </div>
        </Screen>
      );
    }
    return (
      <Screen>
        {header}
        <p className="py-1 text-center text-xs text-[var(--text-muted)]">
          {t('wyr.votedProgress', { done: s.handoffIndex, total: s.playerIds.length })}
        </p>
        <Curtain
          open={gateOpen}
          holderName={voterName}
          hint={t('wyr.imReady', { name: voterName })}
          revealLabel={t('wyr.reveal')}
          onReveal={() => setGateOpen(true)}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-base font-bold">{t('wyr.wouldYouRather')}</p>
            <OptionButtons
              a={a}
              b={b}
              onPick={(side) => {
                ctx.haptics.light();
                if (voterId) dispatch({ type: 'CHOOSE', playerId: voterId, side });
                dispatch({ type: 'ADVANCE_HANDOFF' });
              }}
            />
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'collecting' && s.options.mode === 'quick') {
    return (
      <Screen>
        {header}
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-center text-base font-bold">{t('wyr.wouldYouRather')}</p>
          <Card className="px-4 py-4 text-center text-lg font-extrabold">{a}</Card>
          <Stepper label={t('wyr.handsForA')} value={qa} min={0} max={s.playerIds.length} onChange={setQa} />
          <Card className="px-4 py-4 text-center text-lg font-extrabold">{b}</Card>
          <Stepper label={t('wyr.handsForB')} value={qb} min={0} max={s.playerIds.length} onChange={setQb} />
          <Button
            size="lg"
            fullWidth
            disabled={qa + qb === 0}
            onClick={() => {
              ctx.sound.play('reveal');
              dispatch({ type: 'SET_QUICK_COUNTS', A: qa, B: qb });
              dispatch({ type: 'REVEAL' });
            }}
          >
            {t('wyr.revealSplit')}
          </Button>
        </div>
      </Screen>
    );
  }

  // reveal
  const cur = s.current ?? { countA: 0, countB: 0, majority: 'tie' as const };
  const totalVotes = cur.countA + cur.countB || 1;
  const pctA = Math.round((cur.countA / totalVotes) * 100);
  const last = s.index + 1 >= s.total;
  return (
    <Screen>
      {header}
      <div className="flex flex-1 flex-col justify-center gap-4">
        <p className="text-center text-sm text-[var(--text-muted)]">{t('wyr.wouldYouRather')}</p>
        <div className="overflow-hidden rounded-2xl">
          <motion.div
            className="flex items-center justify-between bg-[var(--game-accent-strong)] px-4 py-4 text-[var(--game-on-accent)]"
            style={{ minWidth: '30%' }}
            initial={{ width: '30%' }}
            animate={{ width: `${Math.max(20, pctA)}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="truncate font-bold">{a}</span>
            <span className="ms-2 font-black">{cur.countA}</span>
          </motion.div>
          <div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-4">
            <span className="truncate font-bold">{b}</span>
            <span className="ms-2 font-black">{cur.countB}</span>
          </div>
        </div>
        <motion.p
          className="text-center text-lg font-extrabold"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 225, damping: 26 }}
        >
          {cur.majority === 'tie' ? t('wyr.tie') : cur.majority === 'A' ? `${a} ✓` : `${b} ✓`}
        </motion.p>
        {item?.note && <p className="text-center text-sm text-[var(--text-muted)]">{ctx.localize(item.note)}</p>}
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NEXT' }); }}>
          {last ? t('wyr.seeResults') : t('wyr.next')}
        </Button>
      </div>
    </Screen>
  );
}
