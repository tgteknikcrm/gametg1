import { AuthGate } from "@/components/auth/AuthGate";
import { GameShell } from "@/components/game/GameShell";
import { AppProviders } from "@/components/providers/AppProviders";

export default function Page() {
  return (
    <AppProviders>
      <AuthGate>
        <GameShell />
      </AuthGate>
    </AppProviders>
  );
}
