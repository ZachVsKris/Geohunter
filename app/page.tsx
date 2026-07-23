import { redirect } from "next/navigation";
import GeoSecondComingGame, { type GameMode } from "../components/GeoSecondComingGame";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const hasLegacyChallenge = Boolean(params.seed || params.board || params.mode);
  if (!hasLegacyChallenge) redirect("/daily");

  const initialMode: GameMode = params.mode === "daily" ? "daily" : "random";
  return <GeoSecondComingGame initialMode={initialMode} initialDifficulty="easy" />;
}
