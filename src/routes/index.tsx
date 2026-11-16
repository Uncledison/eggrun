import { createFileRoute } from "@tanstack/react-router";
import { RunnerGame } from "@/components/RunnerGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <RunnerGame />;
}
