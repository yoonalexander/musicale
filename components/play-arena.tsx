"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";

import { signOutAction, submitGameRunAction } from "@/app/actions";
import { FocusTopbar } from "@/components/focus-topbar";
import { ImmersiveSongPanel } from "@/components/immersive-song-panel";
import { formatRating } from "@/lib/format";
import { evaluateGuess } from "@/lib/game";
import type { Song } from "@/types/domain";

interface PlayArenaProps {
  accountLabel: string | null;
  songs: Song[];
  canSaveScore: boolean;
  isSignedIn: boolean;
}

export function PlayArena({
  accountLabel,
  songs,
  canSaveScore,
  isSignedIn,
}: PlayArenaProps) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [resultState, setResultState] = useState<"idle" | "correct" | "wrong">(
    "idle",
  );
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const currentSong = songs[index] ?? null;
  const nextSong = songs[index + 1] ?? null;
  const isGameOver = resultState === "wrong";
  const runFinished =
    resultState !== "idle" && (isGameOver || !songs[index + 2]);

  useEffect(() => {
    if (!runFinished || !canSaveScore || isSaving || score <= 0 || hasSaved) {
      return;
    }

    setIsSaving(true);

    startTransition(() => {
      void submitGameRunAction({
        score,
        seedContext: currentSong?.id ?? null,
      }).then((result) => {
        setSavedMessage(result.message);
        setHasSaved(true);
        setIsSaving(false);
      });
    });
  }, [canSaveScore, currentSong?.id, hasSaved, isSaving, runFinished, score]);

  if (!currentSong || !nextSong) {
    return (
      <div className="stack">
        <div className="notice-panel">
          <strong>Not enough songs to build a game deck.</strong>
          <p>Add more active songs to the catalog and try again.</p>
        </div>
      </div>
    );
  }

  function handleGuess(guess: "higher" | "lower") {
    if (resultState !== "idle") {
      return;
    }

    const correct = evaluateGuess(currentSong, nextSong, guess);

    if (correct) {
      setScore((value) => value + 1);
      setResultState("correct");
      return;
    }

    setResultState("wrong");
  }

  function advanceRound() {
    setIndex((value) => value + 1);
    setResultState("idle");
  }

  function restart() {
    window.location.reload();
  }

  const stageMessage =
    resultState === "idle"
      ? "Will the challenger rank above or below the current song?"
      : resultState === "correct"
        ? "Correct. The next song stays in the game."
        : "Wrong guess. Curtain down on this run.";

  return (
    <section className="focus-stage">
      <FocusTopbar
        accountSlot={
          isSignedIn ? (
            <div className="focus-topbar__account-cluster">
              <span className="focus-topbar__account-label">
                {accountLabel ?? "Signed in"}
              </span>
              <form action={signOutAction}>
                <button className="focus-topbar__account-button" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link className="focus-topbar__account-button" href="/login">
              Sign in
            </Link>
          )
        }
        items={[
          { label: "Current Run", value: score },
          { label: "Status", value: stageMessage },
        ]}
        leftNav={
          <>
            <Link className="focus-topbar__nav-link focus-topbar__brand" href="/">
              musicale
            </Link>
            <Link className="focus-topbar__nav-link" href="/rank">
              Data Mode
            </Link>
          </>
        }
        modeTitle="Game Mode"
      />

      <div className="focus-stage__split">
        <ImmersiveSongPanel
          actions={
            <div className="focus-action-note">
              <span>Known rank</span>
              <strong>Use this song as your baseline.</strong>
            </div>
          }
          label="Current song"
          metric={
            <>
              <span className="focus-metric__label">Current Elo</span>
              <strong className="focus-metric__value">
                {formatRating(currentSong.eloRating)}
              </strong>
            </>
          }
          side="left"
          song={currentSong}
        />

        <div className="focus-stage__versus">VS</div>

        <ImmersiveSongPanel
          actions={
            resultState === "idle" ? (
              <div className="focus-action-stack">
                <button
                  className="focus-decision-button"
                  onClick={() => handleGuess("higher")}
                >
                  Ranked Higher
                </button>
                <button
                  className="focus-decision-button focus-decision-button--secondary"
                  onClick={() => handleGuess("lower")}
                >
                  Ranked Lower
                </button>
              </div>
            ) : resultState === "correct" && songs[index + 2] ? (
              <div className="focus-action-stack">
                <button className="focus-decision-button" onClick={advanceRound}>
                  Next Round
                </button>
              </div>
            ) : (
              <div className="focus-action-stack">
                <button className="focus-decision-button" onClick={restart}>
                  Play Again
                </button>
                <Link
                  className="focus-decision-button focus-decision-button--secondary"
                  href="/leaderboard"
                >
                  Leaderboard
                </Link>
              </div>
            )
          }
          label={resultState === "idle" ? "Your challenger" : "Revealed result"}
          metric={
            resultState === "idle" ? (
              <>
                <span className="focus-metric__label">Your call</span>
                <strong className="focus-metric__value">Higher or Lower?</strong>
              </>
            ) : (
              <>
                <span className="focus-metric__label">Actual Elo</span>
                <strong className="focus-metric__value">
                  {formatRating(nextSong.eloRating)}
                </strong>
              </>
            )
          }
          side="right"
          song={nextSong}
        />
      </div>

      <div className="focus-stage__corner focus-stage__corner--left">
        Score: {score}
      </div>
      <div className="focus-stage__corner focus-stage__corner--right">
        {canSaveScore
          ? savedMessage ?? (isSaving ? "Saving score..." : "Signed-in run")
          : "Guest run"}
      </div>

      {runFinished ? (
        <div className="focus-stage__summary">
          <strong>Final score: {score}</strong>
          <p>
            {canSaveScore
              ? savedMessage ?? "Saving your result to the global leaderboard."
              : "Sign in if you want your next run on the global leaderboard."}
          </p>
          <div className="focus-summary__actions">
            <button className="focus-summary__button" onClick={restart}>
              Play again
            </button>
            <Link className="focus-summary__button focus-summary__button--secondary" href="/leaderboard">
              View leaderboard
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
