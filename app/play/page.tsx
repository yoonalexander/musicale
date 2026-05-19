import { PlayArena } from "@/components/play-arena";
import { getGameDeck, getViewerState } from "@/lib/data";

export default async function PlayPage() {
  const [songs, viewer] = await Promise.all([getGameDeck(), getViewerState()]);

  return (
    <PlayArena
      accountLabel={viewer.profile?.displayName ?? viewer.user?.email ?? null}
      canSaveScore={Boolean(viewer.user)}
      isSignedIn={Boolean(viewer.user)}
      songs={songs}
    />
  );
}
