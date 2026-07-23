import GeoSecondComingGame from "../../components/GeoSecondComingGame";

export const metadata = { title: "Random Challenge | GeoStats" };

export default function RandomPage() {
  return <GeoSecondComingGame initialMode="random" initialDifficulty="easy" />;
}
